import { CatalogCard, InteractiveCard } from "@yaklabs/catalog";
import type { Carried } from "@yaklabs/catalog/carry";
import type { SharedCard } from "@yaklabs/catalog/share";
import {
  closeLane,
  insertLane,
  lanesOf,
  moveLane,
  newCardLaneId,
  quoteFor,
  reopenLane,
  resizeLane,
  titleFor,
  type Lane,
  type Runtime,
  type ThreadId,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import { useSidebar } from "@yaklabs/ui/components/sidebar";
import { useEffect } from "react";
import { inBackground, useRuntime } from "../runtime";
import { Canvas, type LaneView } from "./canvas";
import { ThreadPane } from "./thread-pane";

// What a thread started without a title is called until someone names it.
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

// A child of `main` whose lane lands at `at`: a highlight's first line as its title and the
// highlight quoted as its opening draft, or a blank one.
function startChild(runtime: Runtime, main: ThreadId, at: number, text: string): void {
  const item = {
    kind: "child",
    parentId: main,
    at,
    title: titleFor(text) || NEW_THREAD,
    draft: text.trim() === "" ? "" : quoteFor(text),
  } as const;
  inBackground(runtime.create(item), "Starting a thread");
}

// What a carry leaves where it lands: a highlight starts a child thread there; a card opens
// large in a lane of its own.
function land(runtime: Runtime, main: ThreadId, carried: Carried, at: number): void {
  if (carried.kind === "text") {
    startChild(runtime, main, at, carried.text);
    return;
  }
  const { card, title } = carried;
  const lane: Lane = { id: newCardLaneId(), width: null, kind: "card", card, title };
  arrangeFrom(runtime, main, (current) => insertLane(current, at, lane));
}

/**
 * A main thread's compose canvas (ADR-089, ADR-092), drawn from the snapshot: its lanes, left
 * to right, each thread lane loading its own turns. Close, reorder, widths and a card dropped
 * between lanes all set the lanes through `arrange`; a highlight or Create blank thread makes
 * a child with its lane in place. Each visit to a child's address brings its lane into view and
 * flashes it, and gives the lane back first if it was closed.
 */
export function MainCanvas({
  main,
  workspace,
  focus,
  visit,
}: {
  main: ThreadId;
  workspace: Workspace;
  focus: ThreadId | null;
  visit: string;
}) {
  const runtime = useRuntime();
  const { isMobile } = useSidebar();
  const lanes = lanesOf(workspace, main);
  const threads = new Map(workspace.threads.map((thread) => [thread.id, thread] as const));
  // Each visit to a child's address opens its lane, a second click on a row the address already
  // names included: that click changes the visit and nothing else.
  useEffect(() => {
    if (focus !== null) arrangeFrom(runtime, main, (current) => reopenLane(current, focus));
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `visit` is what runs it again
  }, [runtime, main, focus, visit]);
  const focused = lanes.find((lane) => lane.kind === "thread" && lane.threadId === focus);
  return (
    <Canvas
      lanes={lanes.flatMap((lane) => laneView(lane, threads))}
      focus={focused?.id ?? null}
      visit={visit}
      actions={{
        onClose: (id) => {
          arrangeFrom(runtime, main, (current) => closeLane(current, id));
        },
        onMove: (id, to) => {
          arrangeFrom(runtime, main, (current) => moveLane(current, id, to));
        },
        onResize: (id, px) => {
          arrangeFrom(runtime, main, (current) => resizeLane(current, id, px));
        },
      }}
      onBlank={() => {
        startChild(runtime, main, lanes.length, "");
      }}
      onCarry={(carried, at) => {
        land(runtime, main, carried, at);
      }}
      reorderable={!isMobile}
    />
  );
}
