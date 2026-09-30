import {
  applyMark,
  insertLane,
  lanesOf,
  reopenLane,
  threadIdSchema,
  type NewItem,
  type Runtime,
  type Workspace,
} from "@yaklabs/runtime";
import {
  projectIdSchema,
  removal,
  renamed,
  restored,
  shared,
  summary,
  withLanes,
  withNewThread,
  withThread,
} from "./edits";
import type { Script } from "./script";
import { promised, type Store } from "./store";

const NEW_THREAD = "New thread";

// A main thread in a project, or a child on a main's canvas with its lane at `at`; answered
// by the lab stand-in.
function createThread(store: Store, script: Script, item: Exclude<NewItem, { kind: "project" }>) {
  const id = threadIdSchema.parse(`demo-${script.id}-new-t${++store.live.made}`);
  const at = store.stamp();
  store.live.transcripts.set(id, []);
  if (item.kind === "main") {
    if (!store.workspace().projects.some((each) => each.id === item.projectId))
      throw new Error(`There is no project "${item.projectId}" in this demo`);
    const place = { kind: "main", projectId: item.projectId } as const;
    const made = summary({ id, title: item.title ?? NEW_THREAD, place, draft: "", at });
    store.commit((ws) => withLanes(id, [])(withNewThread(made)(ws)));
    return id;
  }
  if (store.thread(item.parentId).place.kind !== "main")
    throw new Error(`"${item.parentId}" is not a main thread, so it takes no children`);
  const place = { kind: "child", parentId: item.parentId } as const;
  const made = summary({ id, title: item.title, place, draft: item.draft, at });
  const [lane] = reopenLane([], id); // → the child's lane, the only one
  const lanes = (ws: Workspace) => insertLane(lanesOf(ws, item.parentId), item.at, lane);
  store.commit((ws) => withLanes(item.parentId, lanes(ws))(withNewThread(made)(ws)));
  return id;
}

function create(store: Store, script: Script, item: NewItem): string {
  if (item.kind !== "project") return createThread(store, script, item);
  const id = projectIdSchema.parse(`demo-${script.id}-new-p${++store.live.made}`);
  const project = { id, name: item.name, createdAt: store.stamp() };
  store.commit((ws) => ({ ...ws, projects: [...ws.projects, project] }));
  return id;
}

/** The verbs that read and arrange the workspace, each refusing what the workspace lacks. */
export function workspaceVerbs(
  store: Store,
  script: Script,
): Pick<Runtime, "open" | "create" | "rename" | "arrange" | "saveShell"> {
  return {
    open: (id) => promised(() => [...store.turnsOf(id)]),
    create: (item) => promised(() => create(store, script, item)),
    rename: (target, name) =>
      promised(() => {
        if (target.kind === "thread") store.thread(target.id);
        else if (!store.workspace().projects.some((each) => each.id === target.id))
          throw new Error(`There is no project "${target.id}" in this demo`);
        store.commit(renamed(target, name));
      }),
    arrange: (mainId, lanes) =>
      promised(() => {
        if (store.thread(mainId).place.kind !== "main")
          throw new Error(`"${mainId}" is not a main thread, so it has no canvas`);
        store.commit(withLanes(mainId, lanes));
      }),
    saveShell: (shell) =>
      promised(() => {
        store.commit((ws) => ({ ...ws, shell }));
      }),
  };
}

/** The thread menu's verbs (ADR-126), in memory: a delete keeps its tomb until a restore. */
export function menuVerbs(
  store: Store,
): Pick<Runtime, "mark" | "delete" | "restore" | "share" | "unshare"> {
  return {
    mark: (id, change) =>
      promised(() => {
        const marked = applyMark(store.thread(id), change, store.stamp()); // throws on a past snooze
        store.commit(withThread(id, () => marked));
      }),
    delete: (id) =>
      promised(() => {
        store.thread(id);
        const { ws, tomb } = removal(store.workspace(), id);
        store.live.tombs.set(id, tomb);
        store.commit(() => ws);
      }),
    restore: (id) =>
      promised(() => {
        const tomb = store.live.tombs.get(id);
        if (tomb === undefined) throw new Error(`There is no deleted thread "${id}" to restore`);
        store.live.tombs.delete(id);
        store.commit(restored(tomb));
      }),
    share: (share) =>
      promised(() => {
        store.thread(share.threadId);
        store.commit(shared(share));
      }),
    unshare: (shareId) =>
      promised(() => {
        store.commit((ws) => ({ ...ws, shares: ws.shares.filter((each) => each.id !== shareId) }));
      }),
  };
}
