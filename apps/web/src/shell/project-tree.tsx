import { sidebarTree, type ProjectNode, type ThreadId, type ThreadSummary } from "@yaklabs/runtime";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@yaklabs/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react";
import { useState, type PointerEvent, type ReactElement } from "react";
import { Link } from "react-router";
import { QuietButton } from "../components/quiet-button";
import { usePaths, useRestart, useRuntimeState } from "../runtime";
import { useShell, type Shell } from "./model";

// Fixed widths, so a loading screenshot is the same every time.
const SKELETON_WIDTHS = [168, 132, 150];

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

// Ids folded by hand: projects, and mains with their children. Nothing is folded at first.
type Folds = { folded: Set<string>; toggle: (id: string) => void };

function useFolds(): Folds {
  const [folded, setFolded] = useState<Set<string>>(new Set());
  return {
    folded,
    toggle: (id) => {
      setFolded((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    },
  };
}

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

// A thread row: a link named by its title, indented under its project. A child reads
// "↳ title", one step further in than its main.
function ThreadRow({
  thread,
  active,
  child,
  counted,
}: {
  thread: ThreadSummary;
  active: boolean;
  child: boolean;
  /** Whether the row's item holds the count that folds its children. */
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
          data-thread={child ? "child" : "main"}
          className={`${THREAD_ROW} ${counted ? "" : NO_ACTION} text-soft-ink data-active:text-ink`}
        >
          {child && (
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

// A main thread, its children below it, and the count that folds them ("^ 2").
function MainRows({
  node,
  shell,
  folds,
}: {
  node: ProjectNode["mains"][number];
  shell: Shell;
  folds: Folds;
}) {
  const { main, children } = node;
  const open = !folds.folded.has(main.id);
  const at: ThreadId | null = shell.active?.focus ?? shell.active?.main ?? null;
  return (
    <>
      <SidebarMenuItem>
        <ThreadRow
          thread={main}
          active={at === main.id}
          child={false}
          counted={children.length > 0}
        />
        {children.length > 0 && (
          <SidebarMenuAction
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} the threads in ${main.title}`}
            className="top-1.5 right-1 aspect-auto h-5 w-auto gap-0.5 rounded-[var(--radius)] px-1 text-xs text-soft-ink tabular-nums"
            onClick={() => {
              folds.toggle(main.id);
            }}
          >
            {open ? <ChevronUp className="size-3.5!" /> : <ChevronDown className="size-3.5!" />}
            {children.length}
          </SidebarMenuAction>
        )}
      </SidebarMenuItem>
      {open &&
        children.map((thread) => (
          <SidebarMenuItem key={thread.id}>
            <ThreadRow thread={thread} active={at === thread.id} child counted={false} />
          </SidebarMenuItem>
        ))}
    </>
  );
}

// The project's own row: "name >" folded; open, no chevron at rest and a down chevron while
// the pointer is on the row.
function ProjectButton({
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

// A project and its main threads; the "+" at its right starts a main thread in it.
function ProjectRows({ node, shell, folds }: { node: ProjectNode; shell: Shell; folds: Folds }) {
  const { project, mains } = node;
  const open = !folds.folded.has(project.id);
  return (
    <SidebarMenuItem>
      <ProjectButton
        name={project.name}
        open={open}
        onToggle={() => {
          folds.toggle(project.id);
        }}
      />
      <SidebarMenuAction
        aria-label={`New thread in ${project.name}`}
        className="top-1.5 rounded-[var(--radius)] text-soft-ink hover:text-ink"
        onClick={() => {
          shell.newThread(project.id);
        }}
      >
        <Plus />
      </SidebarMenuAction>
      {open && (
        <SidebarMenu className="mt-0.5">
          {mains.map((each) => (
            <MainRows key={each.main.id} node={each} shell={shell} folds={folds} />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  );
}

// What the tree says while there is no tree: rows on their way, a failed start, or nothing yet.
function TreeState({ shell }: { shell: Shell | null }) {
  const state = useRuntimeState();
  const restart = useRestart();
  if (shell !== null) {
    return (
      <div className="flex flex-col items-start gap-2 px-2 py-1 text-sm">
        <p className="text-soft-ink">No projects yet</p>
        <QuietButton
          onClick={() => {
            shell.newProject();
          }}
        >
          New project
        </QuietButton>
      </div>
    );
  }
  if (state.kind !== "broken") {
    return SKELETON_WIDTHS.map((width) => <SidebarMenuSkeleton key={width} width={width} />);
  }
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-1 text-sm">
      <p className="text-soft-ink">Your threads could not be opened.</p>
      {restart && <QuietButton onClick={restart}>Try again</QuietButton>}
    </div>
  );
}

/**
 * The projects, their main threads and each main's children (ADR-092, ADR-093), newest main
 * first and children in lane order. Rows open threads by address; the URL's thread is marked.
 * Hidden in the collapsed rail, where only places show.
 */
export function ProjectTree() {
  const shell = useShell();
  const folds = useFolds();
  const tree = shell === null ? [] : sidebarTree(shell.workspace);
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-soft-ink">Projects</SidebarGroupLabel>
      {shell === null || tree.length === 0 ? (
        <TreeState shell={shell} />
      ) : (
        <SidebarMenu className="gap-2">
          {tree.map((node) => (
            <ProjectRows key={node.project.id} node={node} shell={shell} folds={folds} />
          ))}
        </SidebarMenu>
      )}
    </SidebarGroup>
  );
}
