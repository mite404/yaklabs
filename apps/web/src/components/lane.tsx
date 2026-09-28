import type { LaneId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { ChevronsLeftRight, ChevronsRightLeft, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { LaneHandlers } from "./lane-reorder";

/**
 * One lane on the canvas: its name, the width it was left at (null: the default), whether it is
 * collapsed to a strip (ADR-124), and its content.
 */
export type LaneView = {
  id: LaneId;
  title: string;
  width: number | null;
  collapsed: boolean;
  node: ReactNode;
};

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never wider than the pane less a strip of ground, so its close
// is always on screen and the ground beside it says there is more row to the right.
const LANE_WIDTH = "min(560px, calc(100% - 48px))";

// The row above a lane: its collapse at the near end and its close at the far end. Collapsed,
// only the expand stays, in the same place, so a second click undoes the first. The button is
// the same element either way, so the focus stays on it as it flips.
function LaneTop({
  title,
  collapsed,
  onCollapse,
  onClose,
}: {
  title: string;
  collapsed: boolean;
  onCollapse: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)] text-soft-ink hover:text-ink"
        aria-label={collapsed ? "Expand lane" : "Collapse lane"}
        data-lane-toggle=""
        onClick={onCollapse}
      >
        {collapsed ? <ChevronsLeftRight /> : <ChevronsRightLeft />}
      </Button>
      {!collapsed && (
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
      )}
    </div>
  );
}

// A collapsed lane's body (ADR-124): a slim strip down the rest of the lane's height with the
// grip, always shown, and the title turned to read top to bottom, clipped with an ellipsis.
// The whole strip takes hold of the lane (lane-reorder.ts).
function LaneStrip({ title }: { title: string }) {
  return (
    <div
      data-lane-strip=""
      className="lane-strip flex min-h-0 flex-1 flex-col items-center gap-2 rounded-[var(--radius-card)] border border-hairline bg-paper py-3"
    >
      <span data-lane-strip-grip="" aria-hidden="true" className="lane-strip-grip" />
      <span data-lane-strip-title="" className="lane-strip-title">
        {title}
      </span>
    </div>
  );
}

/** What a lane reports: its collapse flipped, and its close. */
export type LaneReports = {
  onCollapse: (id: LaneId, collapsed: boolean) => void;
  onClose: (id: LaneId) => void;
};

/** One lane in the canvas's row: open at its width, or collapsed to a strip (ADR-124). */
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
  const { collapsed } = lane;
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the pointer takes hold of the lane by its title bar or its strip; the keyboard moves it from the gap after it
    <article
      className={`lane lane-shift flex h-full shrink-0 flex-col${collapsed ? " w-8" : ""}`}
      style={collapsed ? style : { width: width ?? LANE_WIDTH, ...style }}
      data-lane={lane.id}
      data-collapsed={collapsed || undefined}
      data-lifted={lifted || undefined}
      aria-label={lane.title}
      {...handlers}
    >
      <LaneTop
        title={lane.title}
        collapsed={collapsed}
        onCollapse={() => {
          reports.onCollapse(lane.id, !collapsed);
        }}
        onClose={() => {
          reports.onClose(lane.id);
        }}
      />
      {collapsed && <LaneStrip title={lane.title} />}
      {/* Kept while collapsed, only hidden, so a draft or a scroll inside survives the fold. */}
      <div
        hidden={collapsed}
        className="min-h-0 flex-1"
        style={{ ["--thread-height" as string]: "100%" }}
      >
        {lane.node}
      </div>
    </article>
  );
}
