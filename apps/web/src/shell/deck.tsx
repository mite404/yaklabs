import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@yaklabs/ui/components/resizable";
import {
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

/** The id of the tab panel that holds a main thread's workspace, for the tab that controls it. */
export function panelId(main: ThreadId): string {
  return `panel-${main}`;
}

// Mounts its children the first time it is shown and keeps them until it goes. Hidden, they
// keep their state, scroll and running replies, take no input (inert), and skip rendering
// (content-visibility, from [data-retained] in index.css), which keeps what display: none drops.
function Retain({
  shown,
  children,
  ...rest
}: { shown: boolean; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const [seen, setSeen] = useState(shown);
  if (shown && !seen) setSeen(true);
  if (!seen) return null;
  return (
    <div
      {...rest}
      inert={!shown}
      data-retained={shown ? undefined : ""}
      className="min-h-0 min-w-0 [grid-area:1/1]"
    >
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

// One tab's panes: the main thread, then a panel holding the browser and the canvas, each
// retained so a layout switch never stops a lane's reply. The thread alone collapses that
// panel (and only then may it collapse, so a drag never does); the split is kept on release.
function Workspace({
  shell,
  thread,
  view,
  focus,
}: {
  shell: Shell;
  thread: ThreadSummary;
  view: View;
  focus: ThreadId | null;
}) {
  const group = useRef<GroupHandle>(null);
  const alone = view.pane === "thread";
  useEffect(() => {
    group.current?.setLayout(layoutFor(view.pane, view.split));
  }, [view.pane, view.split]);
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full"
      groupRef={group}
      defaultLayout={layoutFor(view.pane, view.split)}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        const split = new Map(Object.entries(layout)).get("thread"); // → number | undefined
        if (isUserInteraction && !alone && split !== undefined) shell.setSplit(thread.id, split);
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
        collapsible={alone}
        collapsedSize="0"
        className="grid"
      >
        <Retain shown={view.pane === "browser"}>
          <BrowserPane shell={shell} main={thread.id} browser={view.browser} />
        </Retain>
        <Retain shown={view.pane === "canvas"}>
          <MainCanvas main={thread.id} workspace={shell.workspace} focus={focus} />
        </Retain>
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
          focus={shown ? (active?.focus ?? null) : null}
        />
      </Retain>
    );
  });
}
