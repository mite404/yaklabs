import {
  locate,
  sidebarTree,
  type Located,
  type ProjectId,
  type Runtime,
  type ThreadId,
  type Workspace,
} from "@yaklabs/runtime";
import { toast } from "sonner";
import { inBackground, reasonOf } from "../runtime";
import {
  browse,
  closeTab,
  leavesChild,
  markRead,
  parseShell,
  setPane,
  setSplit,
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

/** Goes to a thread's address, or home for null. */
export type Go = (to: ThreadId | null) => void;

// What the verbs need: the runtime, where the page is, and how to go somewhere else.
type Deps = { runtime: Runtime; workspace: Workspace; active: Located | null; go: Go };

// What a project started from the shell is called until someone names it.
const NEW_PROJECT = "New project";

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

/** Saves `change` of the document the runtime holds now; the snapshot shows it at once. */
export function edit(
  runtime: Runtime,
  active: Located | null,
  change: (doc: ShellState) => ShellState,
): void {
  const before = docNow(runtime, active);
  if (before === null) return;
  const after = change(before);
  if (after !== before) inBackground(runtime.saveShell(after), "Keeping your tabs");
}

// Starts a thread (and its project, when it needs one), then opens it.
function startThread(deps: Deps, project: (runtime: Runtime) => Promise<ProjectId>): void {
  const { runtime, go } = deps;
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

/** The shell's verbs over the document the runtime keeps, as the page shows it in `doc`. */
export function verbs(deps: Deps, doc: ShellState): ShellVerbs {
  const { runtime, workspace, active, go } = deps;
  const change = (update: (current: ShellState) => ShellState) => {
    edit(runtime, active, update);
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
      startThread(deps, (started) =>
        known === undefined ? newProjectIn(started) : Promise.resolve(known),
      );
    },
    newProject: () => {
      startThread(deps, newProjectIn);
    },
    setPane: (main, pane) => {
      change((current) => setPane(current, main, pane));
      if (leavesChild(active, main, pane)) go(main);
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
