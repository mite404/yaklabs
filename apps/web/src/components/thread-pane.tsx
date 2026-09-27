import { ChatThreadPanel } from "@yaklabs/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { useEffect, useState, type ReactNode } from "react";
import { inBackground, reasonOf, useRuntime } from "../runtime";
import { useSession } from "../session";
import { QuietButton } from "./quiet-button";

// A thread's turns as the worker hands them over: on their way, here, or refused.
type Turns =
  | { kind: "loading" }
  | { kind: "open"; messages: ThreadMessage[] }
  | { kind: "failed"; reason: string };

const LOADING: Turns = { kind: "loading" };

// Asks the worker for the thread's turns once per thread, and again on each retry.
function useTurns(id: ThreadId): [Turns, () => void] {
  const runtime = useRuntime();
  const [attempt, setAttempt] = useState(0);
  const [turns, setTurns] = useState<{ key: string; turns: Turns }>({ key: "", turns: LOADING });
  const key = `${id}#${attempt}`;
  useEffect(() => {
    let live = true;
    const load = async () => {
      let next: Turns;
      try {
        next = { kind: "open", messages: await runtime.open(id) };
      } catch (error: unknown) {
        next = { kind: "failed", reason: reasonOf(error) };
      }
      if (live) setTurns({ key, turns: next });
    };
    void load();
    return () => {
      live = false;
    };
  }, [runtime, id, key]);
  const retry = () => {
    setAttempt((n) => n + 1);
  };
  return [turns.key === key ? turns.turns : LOADING, retry];
}

// A thread whose turns are not here, in the frame an open thread has: the paper, the border and
// the title bar, so a lane keeps the bar it is taken by and the main pane keeps its shape.
function PendingFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="thread-panel" aria-label={title}>
      <header className="thread-header">
        <h2>{title}</h2>
      </header>
      <div className="flex flex-col items-start gap-2 px-(--thread-gutter) py-5 text-sm">
        {children}
      </div>
    </section>
  );
}

/**
 * One thread in the catalog's panel, its turns loaded from the worker. While they come, and
 * when they cannot, the thread keeps its frame and title bar, with a quiet line or the reason
 * and Try again inside. The title and the opening draft come from the snapshot, so a rename
 * shows everywhere at once.
 */
export function ThreadPane({ thread }: { thread: ThreadSummary }) {
  const runtime = useRuntime();
  const session = useSession();
  const [turns, retry] = useTurns(thread.id);
  if (turns.kind === "loading") {
    return (
      <PendingFrame title={thread.title}>
        <p className="text-soft-ink">Opening {thread.title}…</p>
      </PendingFrame>
    );
  }
  if (turns.kind === "failed") {
    return (
      <PendingFrame title={thread.title}>
        <p className="text-ink">{thread.title} could not be opened.</p>
        <p className="text-soft-ink">{turns.reason}</p>
        <QuietButton onClick={retry}>Try again</QuietButton>
      </PendingFrame>
    );
  }
  return (
    <ChatThreadPanel
      thread={{ title: thread.title, messages: turns.messages }}
      agent={runtime.agent(thread.id, session)}
      initialDraft={thread.draft}
      onRename={(title) => {
        inBackground(runtime.rename({ kind: "thread", id: thread.id }, title), "Renaming");
      }}
    />
  );
}
