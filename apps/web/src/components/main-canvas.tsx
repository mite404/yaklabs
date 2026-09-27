import { CatalogCard, InteractiveCard } from "@yaklabs/catalog";
import type { SharedCard } from "@yaklabs/catalog/share";
import {
  closeLane,
  lanesOf,
  moveLane,
  resizeLane,
  type Lane,
  type Runtime,
  type ThreadId,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import { inBackground, useRuntime } from "../runtime";
import { Canvas, type LaneView } from "./canvas";
import { ThreadPane } from "./thread-pane";

// What a blank thread is called until someone names it.
const NEW_THREAD = "New thread";

function Artifact({ card }: { card: SharedCard }) {
  return card.kind === "interactive" ? (
    <InteractiveCard payload={card.payload} turnId="canvas" onChoose={() => {}} />
  ) : (
    <CatalogCard payload={card.payload} context="thread" />
  );
}

// A lane as the canvas draws it: a child thread, or a card opened large. A thread lane whose
// thread the snapshot lacks is left out rather than drawn empty.
function laneView(lane: Lane, threads: Map<string, ThreadSummary>): LaneView[] {
  if (lane.kind === "card") {
    const { id, title, width, card } = lane;
    return [{ id, title, width, node: <Artifact card={card} /> }];
  }
  const thread = threads.get(lane.threadId);
  if (thread === undefined) return [];
  return [
    {
      id: lane.id,
      title: thread.title,
      width: lane.width,
      node: <ThreadPane key={thread.id} thread={thread} />,
    },
  ];
}

// Sets the main thread's lanes to `edit` of the lanes the runtime holds right now, so two quick
// edits build on each other instead of on the lanes this render saw.
function arrangeFrom(runtime: Runtime, main: ThreadId, edit: (lanes: Lane[]) => Lane[]): void {
  const now = runtime.state();
  if (now.kind !== "ready") return;
  const before = lanesOf(now.workspace, main);
  const after = edit(before);
  if (after !== before) inBackground(runtime.arrange(main, after), "Arranging the canvas");
}

/**
 * A main thread's compose canvas (ADR-089, ADR-092), drawn from the snapshot: its lanes, left
 * to right, each thread lane loading its own turns. Close, reorder and widths all set the lanes
 * through `arrange`; a blank thread is a new child with its lane at the end.
 */
export function MainCanvas({ main, workspace }: { main: ThreadId; workspace: Workspace }) {
  const runtime = useRuntime();
  const lanes = lanesOf(workspace, main);
  const threads = new Map(workspace.threads.map((thread) => [thread.id, thread] as const));
  return (
    <Canvas
      lanes={lanes.flatMap((lane) => laneView(lane, threads))}
      onClose={(id) => {
        arrangeFrom(runtime, main, (current) => closeLane(current, id));
      }}
      onMove={(id, to) => {
        arrangeFrom(runtime, main, (current) => moveLane(current, id, to));
      }}
      onResize={(id, px) => {
        arrangeFrom(runtime, main, (current) => resizeLane(current, id, px));
      }}
      onBlank={() => {
        const item = {
          kind: "child",
          parentId: main,
          at: lanes.length,
          title: NEW_THREAD,
          draft: "",
        } as const;
        inBackground(runtime.create(item), "Starting a thread");
      }}
    />
  );
}
