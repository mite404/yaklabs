import type { ThreadSummary } from "@yaklabs/runtime";
import { SidebarMenuButton } from "@yaklabs/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { usePaths } from "../runtime";

// A row: the hover fill stays inside the sidebar's padding, with the site's 4px corners.
const ROW = "h-8 rounded-[var(--radius)] text-sm";

// A project's threads sit one step in under its name, so the name reads as the label of the
// group below it. The fill still spans the row; only the words move in. A child's "↳" stands
// where its main's title starts, and its own title one step further in.
const THREAD_ROW = `${ROW} pl-6`;

// A row's own title, truncated to whatever room its row leaves it. `block` matters here: as a
// flex item's child it would otherwise stay inline and ignore that width.
const LABEL = "block truncate";

// Whether the row's label is cut short, so its tooltip has something to add.
function isCut(row: Element | undefined): boolean {
  const label = row?.querySelector("[data-label]") ?? null;
  return label !== null && label.scrollWidth > label.clientWidth;
}

// A row whose label may be cut short: the whole name shows beside it, and only when it is cut.
// The cut is measured as the tooltip asks to open, so the first hover and a keyboard focus
// count as much as a second hover.
function Named({ name, row }: { name: string; row: ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next, { trigger }) => {
        setOpen(next && isCut(trigger));
      }}
    >
      <TooltipTrigger render={row} />
      <TooltipContent side="right" className="max-w-80 wrap-anywhere">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

// The fold arrow a project's row and a main thread's fold button share: ">" while folded, and
// open, a "v" that only shows while the pointer or keyboard focus rests somewhere on the row -
// each wraps this in its own `group/fold`, whether that group is the whole row (a project) or
// just spans it (a thread row's stretched link and separate button both sit inside one).
function FoldChevron({ open }: { open: boolean }): ReactElement {
  const common = "size-3.5! shrink-0 text-soft-ink";
  return open ? (
    <ChevronDown
      data-slot="fold-chevron"
      aria-hidden="true"
      className={`${common} opacity-0 transition-opacity group-hover/fold:opacity-100 group-focus-within/fold:opacity-100 motion-reduce:transition-none`}
    />
  ) : (
    <ChevronRight data-slot="fold-chevron" aria-hidden="true" className={common} />
  );
}

/**
 * A main thread with sub-threads: the stretched-link pattern (Bootstrap's recipe), so a click
 * anywhere on the row still opens the thread while a separate button folds the children. The
 * link stays un-positioned and sized to its title; its `::after` is what stretches, to the
 * row's own edges, since that is the nearest positioned ancestor. The button sits after the
 * title in flow, lifted above that layer by its own stacking context (`relative z-10`) so it
 * still receives its own clicks.
 */
function FoldableMainRow({
  thread,
  active,
  open,
  onToggle,
}: {
  thread: ThreadSummary;
  active: boolean;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const { pathTo } = usePaths();
  return (
    <Named
      name={thread.title}
      row={
        <div
          data-slot="thread-row"
          data-active={active || undefined}
          className={`${THREAD_ROW} group/fold relative flex items-center gap-2 text-soft-ink hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-ink`}
        >
          <Link
            to={pathTo(thread.id)}
            aria-current={active ? "page" : undefined}
            data-thread="main"
            className="min-w-0 text-inherit outline-hidden after:absolute after:inset-0 after:rounded-[var(--radius)] focus-visible:after:ring-2 focus-visible:after:ring-sidebar-ring"
          >
            <span data-label="" className={LABEL}>
              {thread.title}
            </span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} the threads in ${thread.title}`}
            onClick={onToggle}
            className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
          >
            <FoldChevron open={open} />
          </button>
        </div>
      }
    />
  );
}

/**
 * A thread row: a link named by its title, indented under its project. A main with sub-threads
 * takes `fold`, and becomes a {@link FoldableMainRow} instead; a child reads "↳ title", one
 * step further in than its main.
 */
export function ThreadRow({
  thread,
  active,
  kind,
  fold,
}: {
  thread: ThreadSummary;
  active: boolean;
  kind: "main" | "child";
  fold?: { open: boolean; onToggle: () => void };
}): ReactElement {
  const { pathTo } = usePaths();
  if (fold) {
    return (
      <FoldableMainRow thread={thread} active={active} open={fold.open} onToggle={fold.onToggle} />
    );
  }
  return (
    <Named
      name={thread.title}
      row={
        <SidebarMenuButton
          render={<Link to={pathTo(thread.id)} />}
          isActive={active}
          aria-current={active ? "page" : undefined}
          data-thread={kind}
          className={`${THREAD_ROW} text-soft-ink data-active:text-ink`}
        >
          {kind === "child" && (
            <span aria-hidden="true" className="shrink-0 text-soft-ink">
              ↳
            </span>
          )}
          <span data-label="" className={LABEL}>
            {thread.title}
          </span>
        </SidebarMenuButton>
      }
    />
  );
}

/**
 * The project's own row, the label of the group below it: "name >" folded; open, no chevron at
 * rest and a down chevron while the pointer is on the row.
 */
export function ProjectButton({
  name,
  open,
  onToggle,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <Named
      name={name}
      row={
        <SidebarMenuButton
          aria-expanded={open}
          className={`${ROW} group/fold text-ink`}
          onClick={onToggle}
        >
          <span data-label="" className="min-w-0 truncate">
            {name}
          </span>
          <FoldChevron open={open} />
        </SidebarMenuButton>
      }
    />
  );
}
