import { selectionSchema } from "@yaklabs/catalog/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { Runtime, ThreadSummary } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@yaklabs/ui/components/dialog";
import { Input } from "@yaklabs/ui/components/input";
import { Plug } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { reasonOf } from "../runtime";

const sessionSchema = z.strictObject({
  code: z.uuid(),
  browserToken: z.uuid(),
  expiresAt: z.iso.datetime(),
});
const deliverySchema = z.strictObject({ insertionId: z.uuid(), card: selectionSchema }).nullable();
type Connection =
  | { kind: "off" }
  | { kind: "opening" }
  | { kind: "failed"; reason: string }
  | { kind: "connected"; session: z.infer<typeof sessionSchema> };

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`/mcp-bridge${path}`, { ...options, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("This connection expired. Connect again for a new code.");
    throw new Error(
      "The local MCP connection is unavailable. Check that Claude Desktop's Bonsai server is running and its browser origin matches this page.",
    );
  }
  return response;
}

// Read the worker's saved turn rather than constructing a second version in the page.
async function savedCard(
  runtime: Runtime,
  threadId: ThreadSummary["id"],
  delivery: NonNullable<z.infer<typeof deliverySchema>>,
): Promise<ThreadMessage> {
  await runtime.insertCard(threadId, delivery.insertionId, delivery.card);
  const messageId = `mcp:${delivery.insertionId}`;
  const message = (await runtime.open(threadId)).find((turn) => turn.id === messageId);
  if (message === undefined) throw new Error("The saved card could not be read back.");
  return message;
}

// Consent and retry share the same state; a connected session shows its credentials instead.
function Consent({
  connection,
  connect,
}: {
  connection: Exclude<Connection, { kind: "connected" }>;
  connect: () => Promise<void>;
}) {
  return (
    <>
      <p>
        Start the Bonsai MCP server in Claude Desktop first. This connection works only with your
        local development app.
      </p>
      {connection.kind === "failed" && <p role="alert">{connection.reason}</p>}
      <Button
        size="sm"
        disabled={connection.kind === "opening"}
        onClick={() => {
          void connect();
        }}
      >
        {connection.kind === "opening" ? "Connecting…" : "Allow card insertion"}
      </Button>
    </>
  );
}

/**
 * Grants one local MCP session card insertion into this thread, until disconnect, unmount or expiry.
 * Receives only cards, never exports the transcript. The worker's save completes before acknowledgement.
 */
export function ExternalAgent({
  runtime,
  thread,
  receive,
}: {
  runtime: Runtime;
  thread: ThreadSummary;
  receive: (message: ThreadMessage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<Connection>({ kind: "off" });
  const [copied, setCopied] = useState(false);
  const { id, title } = thread;

  useEffect(() => {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- consistent-return requires an explicit absent cleanup
    if (connection.kind !== "connected") return undefined;
    const { code, browserToken } = connection.session;
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${browserToken}`, "Content-Type": "application/json" };
    const path = `/sessions/${code}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (error: unknown) => {
      if (!controller.signal.aborted) setConnection({ kind: "failed", reason: reasonOf(error) });
    };
    const deliver = async (delivery: NonNullable<z.infer<typeof deliverySchema>>) => {
      const { insertionId } = delivery;
      let ack;
      try {
        const message = await savedCard(runtime, id, delivery);
        if (controller.signal.aborted) return;
        receive(message);
        ack = { insertionId, ok: true, threadId: id, messageId: message.id };
      } catch (error: unknown) {
        ack = { insertionId, ok: false, error: reasonOf(error).slice(0, 1000) };
      }
      if (controller.signal.aborted) return;
      await request(`${path}/ack`, {
        method: "POST",
        headers,
        body: JSON.stringify(ack),
        signal: controller.signal,
      });
    };
    const poll = async () => {
      try {
        const response = await request(`${path}/next`, { headers, signal: controller.signal });
        const delivery = deliverySchema.parse(await response.json());
        if (controller.signal.aborted) return;
        if (delivery !== null) await deliver(delivery);
        schedule();
      } catch (error: unknown) {
        fail(error);
      }
    };
    const schedule = () => {
      if (controller.signal.aborted) return;
      timer = setTimeout(() => {
        void poll();
      }, 500);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      void fetch(`/mcp-bridge${path}`, { method: "DELETE", headers, keepalive: true }).catch(
        () => {},
      );
    };
  }, [connection, runtime, id, receive]);

  const connect = async () => {
    setConnection({ kind: "opening" });
    setCopied(false);
    try {
      const response = await request("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: id, title }),
      });
      setConnection({ kind: "connected", session: sessionSchema.parse(await response.json()) });
    } catch (error: unknown) {
      setConnection({ kind: "failed", reason: reasonOf(error) });
    }
  };
  const copyPrompt = async (code: string) => {
    try {
      await navigator.clipboard.writeText(
        `Use Bonsai's MCP tools to insert a card into my connected thread. Connection code: ${code}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const connected = connection.kind === "connected";
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plug aria-hidden="true" />
        {connected ? "External agent connected" : "Connect external agent"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect an external agent</DialogTitle>
            <DialogDescription>
              Allow Claude Desktop to insert catalog cards into "{title}". It cannot read your
              conversations or write to other threads.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-4 pb-4 text-xs text-soft-ink">
            {connected ? (
              <>
                <label htmlFor={`mcp-${id}`}>Connection code</label>
                <Input
                  id={`mcp-${id}`}
                  readOnly
                  value={connection.session.code}
                  className="font-mono"
                />
                <p>
                  Share this code only with your external agent. Access expires in 15 minutes, or
                  when this thread closes or you disconnect.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void copyPrompt(connection.session.code);
                    }}
                  >
                    {copied ? "Copied" : "Copy prompt for Claude"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConnection({ kind: "off" });
                      setOpen(false);
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <Consent connection={connection} connect={connect} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
