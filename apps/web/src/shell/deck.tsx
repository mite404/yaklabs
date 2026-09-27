import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@yaklabs/ui/components/resizable";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { trackHintLine } from "../components/divider";
import { MainCanvas } from "../components/main-canvas";
import { ThreadPane } from "../components/thread-pane";
import { BrowserPane } from "./browser-pane";
import { useShell, type Shell } from "./model";
import { SPLIT, viewOf, type PaneKind, type View } from "./state";

// The panel group's imperative handle, named through the ui primitive's own props so the app
// needs no direct dependency on the panel library.
type GroupRef = NonNullable<ComponentProps<typeof ResizablePanelGroup>["groupRef"]>;
type GroupHandle = GroupRef extends Ref<infer Handle> ? NonNullable<Handle> : never;

// The panels' shares for a pane: the thread alone fills the width.
function layoutFor(pane: PaneKind, split: number): Record<string, number> {
  return pane === "thread" ? { thread: 100, side: 0 } : { thread: split, side: 100 - split };
}

// The thread's share a drag left behind, or null when the drag closed the side pane at the far
// edge, which only the layout switch may do.
function keptSplit(layout: Record<string, number>): number | null {
  const sizes = new Map(Object.entries(layout)); // → Map<panel id, percent>
  const thread = sizes.get("thread");
  return thread === undefined || sizes.get("side") === 0 ? null : thread;
}

/** The id of the tab panel that holds a main thread's workspace, for the tab that controls it. */
export function panelId(main: ThreadId): string {
  return `panel-${main}`;
}

// Whether something has been on screen at least once.
function useSeen(shown: boolean): boolean {
  const [seen, setSeen] = useState(shown);
  if (shown && !seen) setSeen(true);
  return seen || shown;
}

// Mounts its children the first time it is shown and keeps them until it goes. Hidden, they
// keep their state, scroll and running replies, take no input (inert), and skip rendering
// (content-visibility, from [data-retain][inert] in index.css), which keeps what display: none
// drops.
function Retain({
  shown,
  children,
  ...rest
}: { shown: boolean; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const seen = useSeen(shown);
  if (!seen) return null;
  return (
    <div {...rest} inert={!shown} data-retain="" className="min-h-0 min-w-0 [grid-area:1/1]">
      {children}
    </div>
  );
}

// The main thread, centred in its pane at the thread's own measure.
function MainPane({ thread }: { thread: ThreadSummary }) {
  return (
    <div
      className="flex h-full min-w-0 justify-center p-4"
      style={{ ["--thread-height" as string]: "100%" }}
    >
      <ThreadPane key={thread.id} thread={thread} />
    </div>
  );
}

// What a tab shows beside its thread.
type Beside = { shell: Shell; thread: ThreadSummary; view: View; focus: ThreadId | null };

// The browser and the canvas, each retained so a layout switch never stops a lane's reply.
function SidePanes({ shell, thread, view, focus }: Beside) {
  return (
    <>
      <Retain shown={view.pane === "browser"}>
        <BrowserPane shell={shell} main={thread.id} browser={view.browser} />
      </Retain>
      <Retain shown={view.pane === "canvas"}>
        <MainCanvas
          main={thread.id}
          workspace={shell.workspace}
          focus={focus}
          visit={shell.visitKey}
        />
      </Retain>
    </>
  );
}

// One tab's panes: the main thread, then a panel holding the browser and the canvas. The
// thread alone collapses that panel; the split is kept on release. The panel's limits never
// change: the library takes new limits a render late, so a panel made collapsible in the
// render that collapses it refused to close and left a fifth of the tab blank. A drag can
// only close it by reaching the far edge, and then the view's layout comes back, since the
// layout switch alone decides what sits beside the thread.
function Workspace(beside: Beside) {
  const { shell, thread, view } = beside;
  const group = useRef<GroupHandle>(null);
  const alone = view.pane === "thread";
  const place = useCallback(() => {
    group.current?.setLayout(layoutFor(view.pane, view.split));
  }, [view.pane, view.split]);
  useEffect(() => {
    place();
  }, [place]);
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full"
      groupRef={group}
      defaultLayout={layoutFor(view.pane, view.split)}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (!isUserInteraction) return;
        const split = keptSplit(layout);
        if (split === null) place();
        else shell.setSplit(thread.id, split);
      }}
    >
      {/* Strings are percentages to the panel library; a bare number would be pixels. */}
      <ResizablePanel id="thread" minSize={`${SPLIT.min}`}>
        <MainPane thread={thread} />
      </ResizablePanel>
      {/* Above the panes, so nothing positioned in them can cover its hit area. */}
      <ResizableHandle
        aria-label="Resize the thread and the pane beside it"
        disabled={alone}
        className={alone ? "hidden" : "drag-hint z-10"}
        onPointerMove={trackHintLine}
      />
      <ResizablePanel
        id="side"
        minSize={`${100 - SPLIT.max}`}
        collapsible
        collapsedSize="0"
        collapsedThreshold={`${100 - SPLIT.max}`}
        className="grid"
      >
        <SidePanes {...beside} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * The open tabs, stacked in one grid cell: each is a tab panel named by its thread, mounted
 * the first time it is shown and kept until its tab closes, so replies, drafts and scroll
 * survive a switch. Only the URL's tab is on screen; the rest are inert.
 */
export function Deck() {
  const shell = useShell();
  if (shell === null) return null;
  const { active } = shell;
  return shell.tabs.map((thread) => {
    const shown = active?.main === thread.id;
    return (
      <Retain
        key={thread.id}
        shown={shown}
        id={panelId(thread.id)}
        role="tabpanel"
        aria-label={thread.title}
      >
        <Workspace
          shell={shell}
          thread={thread}
          view={viewOf(shell.doc, thread.id)}
          focus={shown ? active.focus : null}
        />
      </Retain>
    );
  });
}
