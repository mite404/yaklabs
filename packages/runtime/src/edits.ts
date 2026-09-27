import type { RenameTarget } from "./protocol";
import {
  lanesOf,
  mergeLanes,
  type Lane,
  type LaneId,
  type ShellState,
  type ThreadId,
  type Workspace,
} from "./workspace";

// A page edit `state()` shows before the worker confirms it.
export type Edit = (workspace: Workspace) => Workspace;

/** The project or thread under its new name. */
export function renamed(target: RenameTarget, name: string): Edit {
  return target.kind === "project"
    ? (ws) => ({
        ...ws,
        projects: ws.projects.map((each) => (each.id === target.id ? { ...each, name } : each)),
      })
    : (ws) => ({
        ...ws,
        threads: ws.threads.map((each) =>
          each.id === target.id ? { ...each, title: name } : each,
        ),
      });
}

/** The page's lanes over whatever the canvas holds by then, merged as the worker merges them. */
export function arranged(mainId: ThreadId, lanes: Lane[], base: LaneId[]): Edit {
  return (ws) => ({
    ...ws,
    lanes: { ...ws.lanes, [mainId]: mergeLanes(lanesOf(ws, mainId), base, lanes) },
  });
}

/** The page's shell, whole, over any earlier one. */
export function withShell(shell: ShellState): Edit {
  return (ws) => ({ ...ws, shell });
}
