import {
  applyMark,
  insertLane,
  lanesOf,
  reopenLane,
  type NewItem,
  type Runtime,
  type Workspace,
} from "@yaklabs/runtime";
import { renamed, shared, summary, withLanes, withNewThread, withThread } from "./edits";
import { ids } from "./ids";
import type { Stage } from "./stage";

const NEW_THREAD = "New thread";

// Runs `work` as a verb's answer: its value resolves, and what it throws rejects.
function promised<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

// A main thread in a project, or a child on a main's canvas with its lane at `at`; answered
// by the lab stand-in.
function createThread(stage: Stage, item: Exclude<NewItem, { kind: "project" }>): string {
  const id = ids.freshThread(stage.count());
  const at = stage.stamp();
  if (item.kind === "main") {
    if (!stage.workspace().projects.some((each) => each.id === item.projectId))
      throw new Error(`There is no project "${item.projectId}" in this demo`);
    const place = { kind: "main", projectId: item.projectId } as const;
    const made = summary({ id, title: item.title ?? NEW_THREAD, place, draft: "", at });
    stage.commit((ws) => withLanes(id, [])(withNewThread(made)(ws)));
    return id;
  }
  if (stage.thread(item.parentId).place.kind !== "main")
    throw new Error(`"${item.parentId}" is not a main thread, so it takes no children`);
  const place = { kind: "child", parentId: item.parentId } as const;
  const made = summary({ id, title: item.title, place, draft: item.draft, at });
  const [lane] = reopenLane([], id); // → the child's lane, the only one
  const lanes = (ws: Workspace) => insertLane(lanesOf(ws, item.parentId), item.at, lane);
  stage.commit((ws) => withLanes(item.parentId, lanes(ws))(withNewThread(made)(ws)));
  return id;
}

function create(stage: Stage, item: NewItem): string {
  if (item.kind !== "project") return createThread(stage, item);
  const id = ids.freshProject(stage.count());
  const project = { id, name: item.name, createdAt: stage.stamp() };
  stage.commit((ws) => ({ ...ws, projects: [...ws.projects, project] }));
  return id;
}

/**
 * The verbs that read and arrange the overlay's workspace, each refusing what it lacks. The
 * shell document is the worker's to keep, so `saveShell` refuses.
 */
export function workspaceVerbs(
  stage: Stage,
): Pick<Runtime, "open" | "create" | "rename" | "arrange" | "saveShell"> {
  return {
    open: (id) => promised(() => [...stage.turnsOf(id)]),
    create: (item) => promised(() => create(stage, item)),
    rename: (target, name) =>
      promised(() => {
        if (target.kind === "thread") stage.thread(target.id);
        else if (!stage.workspace().projects.some((each) => each.id === target.id))
          throw new Error(`There is no project "${target.id}" in this demo`);
        stage.commit(renamed(target, name));
      }),
    arrange: (mainId, lanes) =>
      promised(() => {
        if (stage.thread(mainId).place.kind !== "main")
          throw new Error(`"${mainId}" is not a main thread, so it has no canvas`);
        stage.commit(withLanes(mainId, lanes));
      }),
    saveShell: () => Promise.reject(new Error("The scripted demo keeps no shell document")),
  };
}

/** The thread menu's verbs (ADR-126), in memory: a delete keeps its tomb until a restore. */
export function menuVerbs(
  stage: Stage,
): Pick<Runtime, "mark" | "delete" | "restore" | "share" | "unshare"> {
  return {
    mark: (id, change) =>
      promised(() => {
        const marked = applyMark(stage.thread(id), change, stage.stamp()); // throws on a past snooze
        stage.commit(withThread(id, () => marked));
      }),
    delete: (id) =>
      promised(() => {
        stage.bury(id);
      }),
    restore: (id) =>
      promised(() => {
        stage.exhume(id);
      }),
    share: (share) =>
      promised(() => {
        stage.thread(share.threadId);
        stage.commit(shared(share));
      }),
    unshare: (shareId) =>
      promised(() => {
        stage.commit((ws) => ({ ...ws, shares: ws.shares.filter((each) => each.id !== shareId) }));
      }),
  };
}
