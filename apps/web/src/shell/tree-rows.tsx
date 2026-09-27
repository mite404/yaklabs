import type { ThreadSummary } from "@yaklabs/runtime";
import { SidebarMenuAction, SidebarMenuButton } from "@yaklabs/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useState, type PointerEvent, type ReactElement } from "react";
import { Link } from "react-router";
import { usePaths } from "../runtime";

// A row: the hover fill stays inside the sidebar's padding, with the site's 4px corners.
const ROW = "h-8 rounded-[var(--radius)] text-sm";

// A project's threads sit one step in under its name, so the name reads as the label of the
// group below it. The fill still spans the row; only the words move in. A child's "↳" stands
// where its main's title starts, and its own title one step further in.
const THREAD_ROW = `${ROW} pl-6`;

// shadcn leaves room at a row's right end when its item holds an action. The project's "+"
// shares its item with the project's threads, so that room reaches every thread row; a row
// with no count of its own takes it back for its title.
const NO_ACTION = "group-has-data-[sidebar=menu-action]/menu-item:pr-2";

// Whether the row's label is cut short, so its tooltip has something to add.
function isCut(event: PointerEvent<HTMLElement>): boolean {
  const label = event.currentTarget.querySelector("[data-label]");
  return label !== null && label.scrollWidth > label.clientWidth;
}

// A row whose label may be cut short: the whole name shows beside it, and only when it is cut.
function Named({ name, row }: { name: string; row: ReactElement }) {
  const [cut, setCut] = useState(false);
  return (
    <Tooltip disabled={!cut}>
      <TooltipTrigger
        render={row}
        onPointerEnter={(event) => {
          setCut(isCut(event));
        }}
      />
      <TooltipContent side="right" className="max-w-80">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A thread row: a link named by its title, indented under its project. A child reads
 * "↳ title", one step further in than its main.
 * @param counted Whether the row's item holds the count that folds its children.
 */
export function ThreadRow({
  thread,
  active,
  kind,
  counted,
}: {
  thread: ThreadSummary;
  active: boolean;
  kind: "main" | "child";
  counted: boolean;
}) {
  const { pathTo } = usePaths();
  return (
    <Named
      name={thread.title}
      row={
        <SidebarMenuButton
          render={<Link to={pathTo(thread.id)} />}
          isActive={active}
          aria-current={active ? "page" : undefined}
          data-thread={kind}
          className={`${THREAD_ROW} ${counted ? "" : NO_ACTION} text-soft-ink data-active:text-ink`}
        >
          {kind === "child" && (
            <span aria-hidden="true" className="shrink-0 text-soft-ink">
              ↳
            </span>
          )}
          <span data-label="" className="truncate">
            {thread.title}
          </span>
        </SidebarMenuButton>
      }
    />
  );
}

/** The small count beside a main ("^ 2") that folds its children and shows them again. */
export function CountToggle({
  open,
  count,
  title,
  onToggle,
}: {
  open: boolean;
  count: number;
  title: string;
  onToggle: () => void;
}) {
  return (
    <SidebarMenuAction
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} the threads in ${title}`}
      className="top-1.5 right-1 aspect-auto h-5 w-auto gap-0.5 rounded-[var(--radius)] px-1 text-xs text-soft-ink tabular-nums"
      onClick={onToggle}
    >
      {open ? <ChevronUp className="size-3.5!" /> : <ChevronDown className="size-3.5!" />}
      {count}
    </SidebarMenuAction>
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
}) {
  return (
    <Named
      name={name}
      row={
        <SidebarMenuButton
          aria-expanded={open}
          className={`${ROW} group/project text-ink`}
          onClick={onToggle}
        >
          <span data-label="" className="min-w-0 truncate">
            {name}
          </span>
          <span
            data-slot="project-chevron"
            aria-hidden="true"
            className={`flex shrink-0 text-soft-ink transition-opacity motion-reduce:transition-none ${
              open ? "opacity-0 group-hover/project:opacity-100" : "opacity-100"
            }`}
          >
            {open ? <ChevronDown className="size-3.5!" /> : <ChevronRight className="size-3.5!" />}
          </span>
        </SidebarMenuButton>
      }
    />
  );
}
