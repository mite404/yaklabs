import { threads, type Thread, type ThreadMessage } from "@yaklabs/catalog/thread";
import type { Transcript } from "./conversation";
import type { RenameTarget } from "./protocol";
import { DEMO_PROJECT, PROFIT } from "./schema";
import type {
  Lane,
  Notification,
  Place,
  Project,
  ShellState,
  ThreadId,
  ThreadSummary,
  Workspace,
} from "./workspace";

/** A thread as it is first written. */
export type NewThread = {
  id: ThreadId;
  title: string;
  place: Place;
  createdAt: string;
  updatedAt: string;
  draft: string;
  messages: ThreadMessage[];
};

/**
 * The worker's one store (ADR-081, ADR-086). Its calls are synchronous, as SQLite's are, so a
 * read-modify-write can never interleave with another; each write is one transaction, and the
 * schema refuses what the workspace's rules forbid.
 */
export type Store = {
  /** The whole snapshot the page draws from. */
  workspace(): Workspace;
  /** A thread's turns and draft; undefined for an id it has never held. */
  transcript(id: ThreadId): Transcript | undefined;
  /**
   * Threads with a message holding every word of `query`, newest first. Words match as
   * prefixes, ignoring case and accents; a query with no words finds nothing.
   */
  search(query: string): ThreadSummary[];
  /** @throws When the id is taken. */
  addProject(project: Project): void;
  /**
   * Adds a thread in its place and, for a child given `laneAt`, its lane at that index on its
   * parent's canvas, in one transaction.
   * @throws When the id is taken, the place breaks a rule (say, a child of a child), or a main
   *   is given a lane.
   */
  addThread(thread: NewThread, laneAt?: number): void;
  /** Rewrites a thread's turns, draft and `updatedAt` from what they are now. @throws For an unknown thread. */
  changeTranscript(id: ThreadId, change: (transcript: Transcript) => Transcript): void;
  /** @throws For an unknown project or thread. */
  rename(target: RenameTarget, name: string): void;
  /**
   * Sets a main thread's canvas to exactly `lanes`, left to right.
   * @throws When `mainId` is not a main, or a thread lane is not one of its own children.
   */
  arrange(mainId: ThreadId, lanes: Lane[]): void;
  /** Keeps the page's shell whole, over any earlier one. */
  saveShell(shell: ShellState): void;
  /** @throws When the id is taken or the thread is unknown. */
  addNotification(notification: Notification): void;
  /** Closes the file; open it again elsewhere only after this. */
  close(): void;
};

/**
 * One of the catalog's seed threads by name.
 * @throws When the catalog has no thread by that name.
 */
export function seedThread(name: string): Thread {
  const thread = new Map(Object.entries(threads)).get(name); // → Thread | undefined
  if (thread === undefined) throw new Error(`The catalog has no seed thread named ${name}`);
  return thread;
}

/**
 * Gives an empty device store the Demo store project and its `profit` main thread, seeded from
 * the catalog's profit thread, as the page used to. A store with any thread is left alone, so
 * running it again changes nothing.
 * @throws When the catalog has no profit thread, or the store refuses the project or thread.
 */
export function ensureStarter(store: Store, at: string): void {
  const { projects, threads: existing } = store.workspace();
  if (existing.length > 0) return;
  if (!projects.some((project) => project.id === DEMO_PROJECT.id)) {
    store.addProject({ ...DEMO_PROJECT, createdAt: at });
  }
  const { title, messages } = seedThread("profit");
  const place = { kind: "main", projectId: DEMO_PROJECT.id } as const;
  store.addThread({ id: PROFIT, title, place, createdAt: at, updatedAt: at, draft: "", messages });
}
