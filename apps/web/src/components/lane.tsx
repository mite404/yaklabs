import type { LaneId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { ChevronsLeftRight, ChevronsRightLeft, X } from "lucide-react";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { LaneHandlers } from "./lane-reorder";

/**
 * One lane on the canvas: its name, the width it was left at (null: the default), whether it is
 * collapsed to a strip (ADR-133), and its content, drawn with the lane's collapse (`leading`)
 * before the title in its own title bar, or without it while the lane is collapsed.
 */
export type LaneView = {
  id: LaneId;
  title: string;
  width: number | null;
  collapsed: boolean;
  render: (leading: ReactNode) => ReactNode;
};

/** What a lane reports: its collapse flipped, and its close. */
export type LaneReports = {
  onCollapse: (id: LaneId, collapsed: boolean) => void;
  onClose: (id: LaneId) => void;
};

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never wider than the pane less a strip of ground, so its close
// is always on screen and the ground beside it says there is more row to the right.
const LANE_WIDTH = "min(560px, calc(100% - 48px))";

// The lane's collapse, in the container it folds (ADR-134): the thread's or the card's title
// bar while it is open, the head of its strip while it is collapsed. It says what it will do.
function CollapseToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-[var(--radius)] text-soft-ink hover:text-ink"
      aria-label={collapsed ? "Expand lane" : "Collapse lane"}
      data-lane-toggle=""
      onClick={onClick}
    >
      {collapsed ? <ChevronsLeftRight /> : <ChevronsRightLeft />}
    </Button>
  );
}

// The row above an open lane: its close, at the far end.
function LaneTop({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-end">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)]"
        aria-label={`Close ${title}`}
        data-lane-close=""
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );
}

// A collapsed lane (ADR-133): a slim strip down the lane's whole height with its
// expand at the head, the grip always shown beneath, and the title turned to read top to
// bottom, clipped with an ellipsis. The whole strip but its expand takes hold of the lane
// (lane-reorder.ts).
function LaneStrip({ title, toggle }: { title: string; toggle: ReactNode }) {
  return (
    <div
      data-lane-strip=""
      className="lane-strip flex min-h-0 flex-1 flex-col items-center gap-2 rounded-[var(--radius-card)] border border-hairline bg-paper pt-0.5 pb-3"
    >
      {toggle}
      <span data-lane-strip-grip="" aria-hidden="true" className="lane-strip-grip" />
      <span data-lane-strip-title="" className="lane-strip-title">
        {title}
      </span>
    </div>
  );
}

// The toggle moves between the title bar and the strip as the lane flips, so it is a new
// element each time: a toggle pressed with the focus on it hands the focus to the new one once
// the flip lands. `pressed` is the state the lane was in at that press, or null.
function useToggleFocus(lane: RefObject<HTMLElement | null>, collapsed: boolean) {
  const pressed = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (pressed.current === null || pressed.current === collapsed) return;
    pressed.current = null;
    const toggle = lane.current?.querySelector("[data-lane-toggle]");
    if (toggle instanceof HTMLElement) toggle.focus();
  }, [lane, collapsed]);
  return () => {
    const focused = lane.current?.contains(document.activeElement) === true;
    pressed.current = focused ? collapsed : null;
  };
}

// The lane's toggle, flipping it and keeping the focus on the toggle as it moves.
function useCollapseToggle(
  article: RefObject<HTMLElement | null>,
  lane: LaneView,
  onCollapse: LaneReports["onCollapse"],
): ReactNode {
  const { id, collapsed } = lane;
  const noteFocus = useToggleFocus(article, collapsed);
  return (
    <CollapseToggle
      collapsed={collapsed}
      onClick={() => {
        noteFocus();
        onCollapse(id, !collapsed);
      }}
    />
  );
}

// What the lane shows, the thread or the card, filling the rest of its height, with the
// toggle in its title bar. Collapsed, it is kept, only hidden and without the toggle, so a
// draft or a scroll inside survives the fold.
function LaneBody({ lane, toggle }: { lane: LaneView; toggle: ReactNode }) {
  return (
    <div
      hidden={lane.collapsed}
      className="min-h-0 flex-1"
      style={{ ["--thread-height" as string]: "100%" }}
    >
      {lane.render(lane.collapsed ? undefined : toggle)}
    </div>
  );
}

// The head of the lane: the strip, toggle and all, while it is collapsed, else the row with its
// close above its content.
function LaneHead({
  lane,
  toggle,
  onClose,
}: {
  lane: LaneView;
  toggle: ReactNode;
  onClose: LaneReports["onClose"];
}) {
  if (lane.collapsed) return <LaneStrip title={lane.title} toggle={toggle} />;
  return (
    <LaneTop
      title={lane.title}
      onClose={() => {
        onClose(lane.id);
      }}
    />
  );
}

/** One lane in the canvas's row: open at its width, or collapsed to a strip (ADR-133). */
export function Lane({
  lane,
  width,
  lifted,
  style,
  handlers,
  reports,
}: {
  lane: LaneView;
  width: number | null;
  lifted: boolean;
  style: CSSProperties;
  handlers: LaneHandlers;
  reports: LaneReports;
}) {
  const article = useRef<HTMLElement>(null);
  const toggle = useCollapseToggle(article, lane, reports.onCollapse);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the pointer takes hold of the lane by its title bar or its strip; the keyboard moves it from the gap after it
    <article
      ref={article}
      className="lane lane-shift flex h-full shrink-0 flex-col"
      style={{ ["--lane-width" as string]: width === null ? LANE_WIDTH : `${width}px`, ...style }}
      data-lane={lane.id}
      data-collapsed={lane.collapsed}
      data-lifted={lifted || undefined}
      aria-label={lane.title}
      {...handlers}
    >
      <LaneHead lane={lane} toggle={toggle} onClose={reports.onClose} />
      <LaneBody lane={lane} toggle={toggle} />
    </article>
  );
}
