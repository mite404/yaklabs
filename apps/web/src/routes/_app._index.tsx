import { ChatThreadPanel } from "@yaklabs/catalog";
import { threads } from "@yaklabs/catalog/thread";
import { startRuntime, type Conversation, type Runtime, type StorageKind } from "@yaklabs/runtime";
import { useEffect, useState } from "react";
import { env } from "../env";
import { useSession } from "../session";

// The one conversation the slice shows; a new browser starts it from the seed thread.
const CONVERSATION_ID = "profit";

// The page's side of the worker (ADR-076): starting, open, or failed, never half-open.
type Thread =
  | { kind: "opening" }
  | { kind: "open"; runtime: Runtime; conversation: Conversation; storage: StorageKind }
  | { kind: "failed"; reason: string };

export function meta() {
  return [{ title: "Kay" }];
}

// Starts the worker for this visit, asks the browser to keep its data (ADR-081), and opens the
// conversation; leaving the page stops the worker.
function useThread(): Thread {
  const [thread, setThread] = useState<Thread>({ kind: "opening" });
  useEffect(() => {
    let live = true;
    const runtime = startRuntime({ agent: env.agent });
    void navigator.storage.persist?.();
    const open = async () => {
      try {
        const [{ storage }, conversation] = await Promise.all([
          runtime.ready,
          runtime.open(CONVERSATION_ID, threads.profit),
        ]); // → [{ storage }, Conversation]
        if (live) setThread({ kind: "open", runtime, conversation, storage });
      } catch (error: unknown) {
        if (live) setThread({ kind: "failed", reason: String(error) });
      }
    };
    void open();
    return () => {
      live = false;
      runtime.dispose();
    };
  }, []);
  return thread;
}

/** The thread: the profit card with its stepped slider, answered through the worker. */
export default function ThreadPage() {
  const session = useSession();
  const thread = useThread();
  if (thread.kind === "opening") {
    return <p className="p-4 text-soft-ink">Opening your conversation…</p>;
  }
  if (thread.kind === "failed") {
    return (
      <div className="p-4">
        <p className="text-ink">The conversation could not be opened.</p>
        <p className="text-sm text-soft-ink">{thread.reason}</p>
      </div>
    );
  }
  const { runtime, conversation, storage } = thread;
  return (
    <div
      className="flex flex-col items-center gap-2 overflow-hidden p-4"
      style={{ ["--thread-height" as string]: "calc(100svh - 104px)" }}
    >
      {storage === "memory" && (
        <output className="text-sm text-soft-ink">
          This browser cannot keep conversations, so this one lasts until the tab closes.
        </output>
      )}
      <ChatThreadPanel
        key={conversation.id}
        thread={{ title: conversation.title, messages: conversation.messages }}
        agent={runtime.agent(conversation.id, session)}
      />
    </div>
  );
}
