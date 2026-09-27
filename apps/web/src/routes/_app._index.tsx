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
import {
  hide,
  laneId,
  loadHidden,
  loadOrder,
  moveItem,
  quoteFor,
  saveOrder,
  sortByOrder,
  titleFor,
  type Drop,
} from "../canvas";
import { Canvas, type LaneView } from "../components/canvas";
import { trackHintLine } from "../components/divider";
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
  | { id: string; kind: "artifact"; card: SharedCard; title: string };

export function meta() {
  return [{ title: "Kay" }];
}

// Starts the worker for this visit, asks the browser to keep its data (ADR-081), and opens the
// conversation; leaving the page stops the worker. `rename` gives the open conversation a new
// title, kept by the worker.
function useThread(): [Thread, (title: string) => void] {
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
  const rename = (title: string) => {
    if (thread.kind !== "open") return;
    void thread.runtime.rename(thread.conversation.id, title);
    setThread({ ...thread, conversation: { ...thread.conversation, title } });
  };
  return [thread, rename];
}

// What the canvas can do to its lanes.
type LaneActions = {
  lanes: Lane[];
  drop: (drop: Drop) => void;
  close: (id: string) => void;
  move: (id: string, to: number) => void;
  rename: (id: string, title: string) => void;
};

// The canvas's lanes: every other conversation the worker holds, in the order they were left
// (oldest first for the rest), less the ones closed by hand, plus the cards opened large during
// this visit.
function useLanes(runtime: Runtime): LaneActions {
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
          sortByOrder(conversations, loadOrder()).map((conversation) => ({
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
      setLanes((current) => [
        ...current,
        { id: laneId(), kind: "artifact", card: drop.card, title: drop.title },
      ]);
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

  // A slot off either end is no move at all.
  function move(id: string, to: number) {
    const from = lanes.findIndex((lane) => lane.id === id);
    if (from === -1 || to < 0 || to >= lanes.length) return;
    const moved = moveItem(lanes, from, to); // → Lane[]
    saveOrder(moved.filter((lane) => lane.kind === "thread").map((lane) => lane.id));
    setLanes(moved);
  }

  function rename(id: string, title: string) {
    void runtime.rename(id, title);
    setLanes((current) =>
      current.map((lane) =>
        lane.kind === "thread" && lane.id === id
          ? { ...lane, conversation: { ...lane.conversation, title } }
          : lane,
      ),
    );
  }

  return { lanes, drop: (drop) => void add(drop), close, move, rename };
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
function Workspace({
  runtime,
  conversation,
  onRename,
}: {
  runtime: Runtime;
  conversation: Conversation;
  onRename: (title: string) => void;
}) {
  const session = useSession();
  const { lanes, drop, close, move, rename } = useLanes(runtime);
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
              onRename={(title) => {
                rename(lane.id, title);
              }}
            />
          ),
        }
      : { id: lane.id, title: lane.title, node: <Artifact card={lane.card} /> },
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
            onRename={onRename}
          />
        </div>
      </ResizablePanel>
      {/* Above the panes, so nothing positioned in them can cover its hit area. */}
      <ResizableHandle
        aria-label="Resize the thread and the canvas"
        className="drag-hint z-10"
        onPointerMove={trackHintLine}
      />
      <ResizablePanel minSize="20">
        <Canvas
          lanes={views}
          onDrop={drop}
          onClose={close}
          onMove={move}
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
  const [thread, renameThread] = useThread();
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
      <Workspace runtime={runtime} conversation={conversation} onRename={renameThread} />
    </div>
  );
}
