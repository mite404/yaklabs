import {
  UNDO_MS,
  type Located,
  type Runtime,
  type ThreadId,
  type ThreadSummary,
} from "@yaklabs/runtime";
import { toast } from "sonner";
import { inBackground, reasonOf } from "../runtime";
import { wakeText } from "./snooze";
import { awayFrom, type ShellState } from "./state";

/** What the thread's menu does (ADR-124), besides Share. */
export type ThreadVerbs = {
  /** Copies the thread's address, its scenario kept, and says so. */
  copyUrl(id: ThreadId): void;
  /** Pins or unpins; the view stays where it is (ADR-125). */
  pin(id: ThreadId, pinned: boolean): void;
  /** Opens the snooze card in the thread (ADR-126); null closes it. */
  askSnooze(id: ThreadId | null): void;
  /** Snoozes until an instant, or wakes with null, and says when (ADR-126). */
  snooze(id: ThreadId, until: string | null): void;
  /** Archives or unarchives, with Undo; the view stays where it is (ADR-127). */
  archive(id: ThreadId, archived: boolean): void;
  /** Deletes a thread and its sub-threads, with Undo while the worker keeps its tombstone (ADR-128). */
  remove(id: ThreadId): void;
};

/** What the thread verbs need: the runtime, where the page is, and how to move it. */
export type ThreadDeps = {
  runtime: Runtime;
  threads: ThreadSummary[];
  active: Located | null;
  doc: ShellState;
  go: (to: ThreadId | null) => void;
  /** The thread's address as a whole URL, its scenario kept. */
  href: (id: ThreadId) => string;
  /** Saves a change to the shell's document, as the shell's own verbs do. */
  change: (update: (doc: ShellState) => ShellState) => void;
  setSnoozing: (id: ThreadId | null) => void;
};

// A thread's title in quotes, for a toast; the id when the snapshot lacks it.
function named(threads: ThreadSummary[], id: ThreadId): string {
  return `“${threads.find((each) => each.id === id)?.title ?? id}”`;
}

async function copy(href: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(href);
    toast.success("Thread URL copied");
  } catch (error: unknown) {
    toast.error("Copying did not work", { description: `${reasonOf(error)} ${href}` });
  }
}

// Deletes, moves the page off the thread if it showed it, and offers Undo for as long as the
// worker keeps the tombstone. Undo puts the thread back and returns to it if it was on screen.
function removeWithUndo(deps: ThreadDeps, id: ThreadId): void {
  const { runtime, threads, active, doc, go, change } = deps;
  const title = named(threads, id);
  const { next } = awayFrom(doc, active, id);
  inBackground(runtime.delete(id), "Deleting");
  change((current) => awayFrom(current, active, id).state);
  if (next !== undefined) go(next);
  const undo = async () => {
    await runtime.restore(id);
    if (next !== undefined) go(id);
  };
  toast(`Deleted ${title}`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        inBackground(undo(), "Undoing the delete");
      },
    },
  });
}

/** The thread menu's verbs over the runtime (ADR-124 to ADR-128). */
export function threadVerbs(deps: ThreadDeps): ThreadVerbs {
  const { runtime, threads, href, setSnoozing } = deps;
  return {
    copyUrl: (id) => {
      void copy(href(id));
    },
    pin: (id, pinned) => {
      inBackground(runtime.mark(id, { pinned }), pinned ? "Pinning" : "Unpinning");
    },
    askSnooze: setSnoozing,
    snooze: (id, until) => {
      inBackground(runtime.mark(id, { snoozedUntil: until }), "Snoozing");
      setSnoozing(null);
      const title = named(threads, id);
      if (until === null) toast(`${title} is awake`);
      else toast(`Snoozed ${title} until ${wakeText(new Date(until), "long")}`);
    },
    archive: (id, archived) => {
      inBackground(runtime.mark(id, { archived }), archived ? "Archiving" : "Unarchiving");
      if (!archived) return;
      toast(`Archived ${named(threads, id)}`, {
        action: {
          label: "Undo",
          onClick: () => {
            inBackground(runtime.mark(id, { archived: false }), "Unarchiving");
          },
        },
      });
    },
    remove: (id) => {
      removeWithUndo(deps, id);
    },
  };
}
