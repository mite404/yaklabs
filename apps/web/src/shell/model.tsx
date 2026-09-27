import {
  locate,
  sidebarTree,
  type Located,
  type ProjectId,
  type Runtime,
  type Source,
  type ThreadId,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMatch, useNavigate } from "react-router";
import { toast } from "sonner";
import { inBackground, reasonOf, usePaths, useRuntimeState, useStartedRuntime } from "../runtime";
import {
  browse,
  closeTab,
  markRead,
  parseShell,
  resume,
  setPane,
  setSplit,
  unreadCount,
  visit,
  type BrowserStep,
  type PaneKind,
  type ShellState,
} from "./state";

/** What the shell can change: tabs, threads, projects, panes and the bell. */
export type ShellVerbs = {
  /** Goes to a thread's address, main or child; the address keeps the scenario. */
  open(id: ThreadId): void;
  /** Closes a tab; the one on screen gives way to its right neighbour, else its left, else home. */
  close(main: ThreadId): void;
  /** Starts a main thread in the project (else the active one's, else the first) and opens it. */
  newThread(projectId?: ProjectId): void;
  /** Starts a project with its first main thread and opens it. */
  newProject(): void;
  /** Shows a pane beside a main; leaving the canvas on a child's address goes to its main's. */
  setPane(main: ThreadId, pane: PaneKind): void;
  setSplit(main: ThreadId, split: number): void;
  browse(main: ThreadId, step: BrowserStep): void;
  markRead(ids: string[]): void;
};

/**
 * The shell once the runtime is ready: the snapshot, the saved document with the URL's thread
 * visited, and the verbs that change what the shell shows. Every part of the frame reads it.
 */
export type Shell = ShellVerbs & {
  source: Source;
  workspace: Workspace;
  doc: ShellState;
  /** The URL's thread; null on "/", on /lab, and for a thread the workspace lacks. */
  active: Located | null;
  /** The open main threads, left to right. */
  tabs: ThreadSummary[];
  /** Where "/" goes, or null when nothing is open. */
  resumeTo: ThreadId | null;
  unread: number;
};

// What the verbs need: the runtime, where the page is, and how to go somewhere else.
type Deps = {
  runtime: Runtime | null;
  workspace: Workspace;
  active: Located | null;
  go: (to: ThreadId | null) => void;
};

// What a project started from the shell is called until someone names it.
const NEW_PROJECT = "New project";

const ShellContext = createContext<Shell | null>(null);

function sameDoc(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The project a new thread goes in: the one asked for, else the active thread's, else the
// first; undefined when there is none yet.
function projectFor(
  ws: Workspace,
  active: Located | null,
  asked?: ProjectId,
): ProjectId | undefined {
  if (asked !== undefined) return asked;
  const main = ws.threads.find((thread) => thread.id === active?.main);
  if (main?.place.kind === "main") return main.place.projectId;
  return sidebarTree(ws).at(0)?.project.id;
}

// A project `create` just made, found by its id in the state it already lists.
function createdProject(runtime: Runtime, id: string): ProjectId {
  const state = runtime.state();
  const project =
    state.kind === "ready" ? state.workspace.projects.find((each) => each.id === id) : undefined;
  if (project === undefined) throw new Error(`The runtime does not list project ${id}`);
  return project.id;
}

// A thread `create` just made, found the same way.
function createdThread(runtime: Runtime, id: string): ThreadId {
  const state = runtime.state();
  const located = state.kind === "ready" ? locate(state.workspace, id) : undefined;
  if (located === undefined) throw new Error(`The runtime does not list thread ${id}`);
  return located.focus ?? located.main;
}

// The document as the runtime holds it right now, the URL's thread visited, so a verb builds
// on the latest write rather than on the one the last render saw.
function docNow(runtime: Runtime, active: Located | null): ShellState | null {
  const state = runtime.state();
  if (state.kind !== "ready") return null;
  const saved = parseShell(state.workspace.shell, state.workspace);
  return active === null ? saved : visit(saved, active);
}

// Saves `change` of the latest document; the snapshot shows it at once.
function edit(deps: Pick<Deps, "runtime" | "active">, change: (doc: ShellState) => ShellState) {
  const { runtime, active } = deps;
  const before = runtime === null ? null : docNow(runtime, active);
  if (runtime === null || before === null) return;
  const after = change(before);
  if (after !== before) inBackground(runtime.saveShell(after), "Keeping your tabs");
}

// Starts a thread (and its project, when it needs one), then opens it.
function startThread(deps: Deps, project: (runtime: Runtime) => Promise<ProjectId>): void {
  const { runtime, go } = deps;
  if (runtime === null) return;
  const run = async () => {
    try {
      const projectId = await project(runtime);
      go(createdThread(runtime, await runtime.create({ kind: "main", projectId })));
    } catch (error: unknown) {
      toast.error("Starting a thread did not work", { description: reasonOf(error) });
    }
  };
  void run();
}

async function newProjectIn(runtime: Runtime): Promise<ProjectId> {
  return createdProject(runtime, await runtime.create({ kind: "project", name: NEW_PROJECT }));
}

// The shell's verbs over the document the runtime keeps.
function verbs(deps: Deps, doc: ShellState): ShellVerbs {
  const { workspace, active, go } = deps;
  const change = (update: (current: ShellState) => ShellState) => {
    edit(deps, update);
  };
  return {
    open: (id) => {
      go(id);
    },
    close: (main) => {
      const { next } = closeTab(doc, main);
      change((current) => closeTab(current, main).state);
      if (active?.main === main) go(next);
    },
    newThread: (projectId) => {
      const known = projectFor(workspace, active, projectId);
      startThread(deps, (runtime) =>
        known === undefined ? newProjectIn(runtime) : Promise.resolve(known),
      );
    },
    newProject: () => {
      startThread(deps, newProjectIn);
    },
    setPane: (main, pane) => {
      change((current) => setPane(current, main, pane));
      if (active?.main === main && active.focus !== null && pane !== "canvas") go(main);
    },
    setSplit: (main, split) => {
      change((current) => setSplit(current, main, split));
    },
    browse: (main, step) => {
      change((current) => browse(current, main, step));
    },
    markRead: (ids) => {
      change((current) => markRead(current, ids));
    },
  };
}

// Keeps the runtime's document in step with the page: the canonical one whenever it differs
// (nothing saved yet, or a thread gone), and a visit each time the address names a new thread.
// Only a new address visits: a state push must not re-add a tab closed a moment ago while the
// address still names it on its way to the neighbour.
function useKeepShell(
  runtime: Runtime | null,
  ws: Workspace | null,
  saved: ShellState | null,
  named: string | undefined,
): void {
  useEffect(() => {
    if (runtime !== null && ws !== null && saved !== null && !sameDoc(saved, ws.shell))
      inBackground(runtime.saveShell(saved), "Keeping your tabs");
  }, [runtime, ws, saved]);

  const isReady = ws !== null;
  useEffect(() => {
    const now = runtime?.state();
    if (!isReady || named === undefined || now?.kind !== "ready") return;
    const at = locate(now.workspace, named);
    if (at !== undefined) edit({ runtime, active: at }, (current) => visit(current, at));
  }, [runtime, isReady, named]);
}

/**
 * Provides the shell to the frame and the routes: the document with the URL's thread visited
 * in render, so what shows never waits for the save, and the verbs that change it. A tab
 * appears once per thread, and a child's main turns to its canvas.
 */
export function ShellProvider({ children }: { children: ReactNode }) {
  const state = useRuntimeState();
  const runtime = useStartedRuntime();
  const navigate = useNavigate();
  const { pathTo, hrefTo } = usePaths();
  const named = useMatch("/t/:threadId")?.params.threadId; // → string | undefined
  const ready = state.kind === "ready" ? state : null;
  const ws = ready?.workspace ?? null;
  const saved = useMemo(() => (ws === null ? null : parseShell(ws.shell, ws)), [ws]);
  const active = useMemo(
    () => (ws === null || named === undefined ? null : (locate(ws, named) ?? null)),
    [ws, named],
  );
  const doc = saved !== null && active !== null ? visit(saved, active) : saved;
  const [lastShown, setLastShown] = useState<ThreadId | null>(null);
  if (active !== null && active.main !== lastShown) setLastShown(active.main);
  useKeepShell(runtime, ws, saved, named);

  const shell = useMemo<Shell | null>(() => {
    if (ready === null || doc === null) return null;
    const { workspace, source } = ready;
    const go = (to: ThreadId | null) => {
      void navigate(to === null ? hrefTo("/") : pathTo(to));
    };
    const byId = new Map(workspace.threads.map((thread) => [thread.id, thread] as const));
    return {
      source,
      workspace,
      doc,
      active,
      tabs: doc.tabs.flatMap((id) => byId.get(id) ?? []),
      resumeTo: resume(doc, workspace, lastShown),
      unread: unreadCount(doc, workspace),
      ...verbs({ runtime, workspace, active, go }, doc),
    };
  }, [ready, doc, active, runtime, navigate, pathTo, hrefTo, lastShown]);

  return <ShellContext value={shell}>{children}</ShellContext>;
}

/** The shell, or null while the runtime is starting or broken. */
export function useShell(): Shell | null {
  return useContext(ShellContext);
}
