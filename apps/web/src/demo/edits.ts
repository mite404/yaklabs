import {
  lanesOf,
  reopenLane,
  threadIdSchema,
  type Lane,
  type Notification,
  type RenameTarget,
  type ThreadId,
  type ThreadShare,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { z } from "zod";
import { START_PAGE } from "../shell/browser";
import type { Script } from "./script";

/** A change to the demo's workspace: the workspace before, the workspace after. */
export type Edit = (ws: Workspace) => Workspace;

/** What a delete took away, so a restore can put it back. */
export type Tomb = {
  threads: ThreadSummary[];
  notifications: Notification[];
  shares: ThreadShare[];
};

/** A child thread a script names: its workspace id, the script's name for it, and its words. */
export type ChildOf = { id: ThreadId; local: string; title: string; request: string };

/** The runtime package keeps its own schema private; this is the same zod brand. */
export const projectIdSchema = z.string().min(1).brand<"ProjectId">();

// Oldest first, as the workspace lists threads; the id breaks ties.
const oldestFirst = (a: ThreadSummary, b: ThreadSummary) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

// Newest first, as the workspace lists notifications.
const newestFirst = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

/** The script's main thread id: the same on every load of the script. */
export function mainIdOf(script: Script): ThreadId {
  return threadIdSchema.parse(`demo-${script.id}`);
}

/**
 * The child a script names, with its workspace id.
 * @throws When the script names no such child.
 */
export function childOf(script: Script, local: string): ChildOf {
  const named = new Map(Object.entries(script.children)).get(local);
  if (named === undefined) throw new Error(`The script names no child "${local}"`);
  return { id: threadIdSchema.parse(`demo-${script.id}-${local}`), local, ...named };
}

// A thread's one-line preview: its last turn's first line.
function previewOf(turns: ThreadMessage[]): string {
  return turns.at(-1)?.text.split("\n")[0] ?? "";
}

/** The thread `id` changed by `change`. */
export function withThread(id: string, change: (thread: ThreadSummary) => ThreadSummary): Edit {
  return (ws) => ({
    ...ws,
    threads: ws.threads.map((thread) => (thread.id === id ? change(thread) : thread)),
  });
}

/** A main thread's canvas set to `lanes`. */
export function withLanes(main: ThreadId, lanes: Lane[]): Edit {
  return (ws) => ({ ...ws, lanes: { ...ws.lanes, [main]: lanes } });
}

/** A thread's summary as its turns now stand, at `at`. */
export function touched(
  turns: ThreadMessage[],
  at: string,
): (thread: ThreadSummary) => ThreadSummary {
  return (thread) => ({
    ...thread,
    turnCount: turns.length,
    preview: previewOf(turns),
    updatedAt: at,
  });
}

/** A new thread's summary, made at `at`, with no turns and no marks. */
export function summary(
  fields: Pick<ThreadSummary, "id" | "title" | "place" | "draft"> & { at: string },
): ThreadSummary {
  const { at, ...named } = fields;
  return {
    ...named,
    createdAt: at,
    updatedAt: at,
    preview: "",
    turnCount: 0,
    pinnedAt: null,
    snoozedUntil: null,
    archivedAt: null,
  };
}

/** A thread added, oldest first as the workspace keeps them. */
export function withNewThread(thread: ThreadSummary): Edit {
  return (ws) => ({ ...ws, threads: [...ws.threads, thread].toSorted(oldestFirst) });
}

/** The child a step first names, under the main, holding `turns`, its lane at the canvas's end. */
export function addChild(child: ChildOf, main: ThreadId, turns: ThreadMessage[], at: string): Edit {
  const place = { kind: "child", parentId: main } as const;
  const thread = touched(
    turns,
    at,
  )(summary({ id: child.id, title: child.title, place, draft: "", at }));
  return (ws) =>
    withLanes(main, reopenLane(lanesOf(ws, main), child.id))(withNewThread(thread)(ws));
}

/** A note for the bell, newest first. */
export function notified(note: Notification): Edit {
  return (ws) => ({ ...ws, notifications: [note, ...ws.notifications] });
}

/** The workspace without a thread and its children, and what the delete took. */
export function removal(ws: Workspace, id: string): { ws: Workspace; tomb: Tomb } {
  const gone = new Set<string>(
    ws.threads
      .filter(
        (each) => each.id === id || (each.place.kind === "child" && each.place.parentId === id),
      )
      .map((each) => each.id),
  );
  const kept = <T extends { threadId: string }>(list: T[]) =>
    list.filter((each) => !gone.has(each.threadId));
  const taken = <T extends { threadId: string }>(list: T[]) =>
    list.filter((each) => gone.has(each.threadId));
  return {
    tomb: {
      threads: ws.threads.filter((each) => gone.has(each.id)),
      notifications: taken(ws.notifications),
      shares: taken(ws.shares),
    },
    ws: {
      ...ws,
      threads: ws.threads.filter((each) => !gone.has(each.id)),
      notifications: kept(ws.notifications),
      shares: kept(ws.shares),
    },
  };
}

/** A tomb's threads, notes and shares back in the workspace, in their lists' own orders. */
export function restored(tomb: Tomb): Edit {
  return (ws) => ({
    ...ws,
    threads: [...ws.threads, ...tomb.threads].toSorted(oldestFirst),
    notifications: [...ws.notifications, ...tomb.notifications].toSorted(newestFirst),
    shares: [...tomb.shares, ...ws.shares],
  });
}

/** The project or thread under its new name. */
export function renamed(target: RenameTarget, name: string): Edit {
  return target.kind === "project"
    ? (ws) => ({
        ...ws,
        projects: ws.projects.map((each) => (each.id === target.id ? { ...each, name } : each)),
      })
    : withThread(target.id, (thread) => ({ ...thread, title: name }));
}

/** A share recorded, newest first, over any earlier record of the same share. */
export function shared(share: ThreadShare): Edit {
  return (ws) => ({
    ...ws,
    shares: [share, ...ws.shares.filter((each) => each.id !== share.id)],
  });
}

/**
 * The workspace a script opens on: its project, and its main thread with no turns yet, open as
 * the one tab on the thread layout.
 */
export function seed(script: Script, at: string): Workspace {
  const project = projectIdSchema.parse(`demo-${script.id}-project`);
  const main = mainIdOf(script);
  const place = { kind: "main", projectId: project } as const;
  const browser = { back: [], current: START_PAGE, forward: [] };
  return {
    projects: [{ id: project, name: script.project, createdAt: at }],
    threads: [summary({ id: main, title: script.thread, place, draft: "", at })],
    lanes: { [main]: [] },
    shell: {
      version: 1,
      tabs: [main],
      views: { [main]: { pane: "thread", split: 52, browser } },
      read: [],
    },
    notifications: [],
    shares: [],
  };
}
