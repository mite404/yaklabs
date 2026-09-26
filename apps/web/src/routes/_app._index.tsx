import { CatalogCard, ChatThreadPanel, InteractiveCard } from "@yaklabs/catalog";
import type { SharedCard } from "@yaklabs/catalog/share";
import { threads } from "@yaklabs/catalog/thread";
import { startRuntime, type Conversation, type Runtime, type StorageKind } from "@yaklabs/runtime";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@yaklabs/ui/components/resizable";
import { useEffect, useState } from "react";
import { hide, laneId, loadHidden, quoteFor, titleFor, type Drop } from "../canvas";
import { Canvas, type LaneView } from "../components/canvas";
import { env } from "../env";
import { useSession } from "../session";

// The conversation the page opens with; a new browser starts it from the seed thread.
const CONVERSATION_ID = "profit";

// The page's side of the worker (ADR-076): starting, open, or failed, never half-open.
type Thread =
  | { kind: "opening" }
  | { kind: "open"; runtime: Runtime; conversation: Conversation; storage: StorageKind }
  | { kind: "failed"; reason: string };

// A lane on the canvas (ADR-089): another thread of this project, or a card opened large.
type Lane =
  | { id: string; kind: "thread"; conversation: Conversation; draft: string }
  | { id: string; kind: "artifact"; card: SharedCard };

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
    void navigator.storage.persist();
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

// The canvas's lanes: every other conversation the worker holds, oldest first, less the ones
// closed by hand, plus the cards opened large during this visit.
function useLanes(runtime: Runtime): [Lane[], (drop: Drop) => void, (id: string) => void] {
  const [lanes, setLanes] = useState<Lane[]>([]);
  useEffect(() => {
    let live = true;
    const hidden = loadHidden();
    const restore = async () => {
      const summaries = await runtime.list(); // → ConversationSummary[], newest first
      const ids = summaries
        .map((summary) => summary.id)
        .filter((id) => id !== CONVERSATION_ID && !hidden.has(id))
        .toReversed();
      const conversations = await Promise.all(ids.map((id) => runtime.open(id))); // → Conversation[]
      if (live)
        setLanes(
          conversations.map((conversation) => ({
            id: conversation.id,
            kind: "thread",
            conversation,
            draft: "",
          })),
        );
    };
    void restore();
    return () => {
      live = false;
    };
  }, [runtime]);

  async function add(drop: Drop) {
    if (drop.kind === "card") {
      setLanes((current) => [...current, { id: laneId(), kind: "artifact", card: drop.card }]);
      return;
    }
    const id = laneId();
    const conversation = await runtime.open(id, { title: titleFor(drop.text), messages: [] });
    setLanes((current) => [
      ...current,
      { id, kind: "thread", conversation, draft: quoteFor(drop.text) },
    ]);
  }

  function close(id: string) {
    hide(id);
    setLanes((current) => current.filter((lane) => lane.id !== id));
  }

  return [lanes, (drop) => void add(drop), close];
}

function Artifact({ card }: { card: SharedCard }) {
  return card.kind === "interactive" ? (
    <InteractiveCard payload={card.payload} turnId="canvas" onChoose={() => {}} />
  ) : (
    <CatalogCard payload={card.payload} context="thread" />
  );
}

// The primary thread beside the canvas; the divider between them drags anywhere along its
// length, the canvas takes what is dropped on it.
function Workspace({ runtime, conversation }: { runtime: Runtime; conversation: Conversation }) {
  const session = useSession();
  const [lanes, drop, close] = useLanes(runtime);
  const views: LaneView[] = lanes.map((lane) =>
    lane.kind === "thread"
      ? {
          id: lane.id,
          title: lane.conversation.title,
          node: (
            <ChatThreadPanel
              key={lane.id}
              thread={{ title: lane.conversation.title, messages: lane.conversation.messages }}
              agent={runtime.agent(lane.id, session)}
              initialDraft={lane.draft}
            />
          ),
        }
      : { id: lane.id, title: "Card", node: <Artifact card={lane.card} /> },
  );
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* Strings are percentages to the panel library; a bare number would be pixels. */}
      <ResizablePanel defaultSize="52" minSize="28">
        <div
          className="flex h-full min-w-0 justify-center p-4"
          style={{ ["--thread-height" as string]: "100%" }}
        >
          <ChatThreadPanel
            key={conversation.id}
            thread={{ title: conversation.title, messages: conversation.messages }}
            agent={runtime.agent(conversation.id, session)}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle
        aria-label="Resize the thread and the canvas"
        className="transition-colors hover:bg-olive data-[resize-handle-active]:bg-olive"
      />
      <ResizablePanel minSize="20">
        <Canvas
          lanes={views}
          onDrop={drop}
          onClose={close}
          onBlank={() => {
            drop({ kind: "text", text: "" });
          }}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/** The thread and, beside it, the compose canvas (ADR-089). */
export default function ThreadPage() {
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
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {storage === "memory" ? (
        <output className="px-4 pt-2 text-sm text-soft-ink">
          This browser cannot keep conversations, so this one lasts until the tab closes.
        </output>
      ) : (
        <span />
      )}
      <Workspace runtime={runtime} conversation={conversation} />
    </div>
  );
}
