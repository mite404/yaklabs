import { ChatThreadPanel } from "@yaklabs/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { useEffect, useState } from "react";
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

/**
 * One thread in the catalog's panel, its turns loaded from the worker: a quiet line while they
 * come, and the reason with Try again when they cannot. The title and the opening draft come
 * from the snapshot, so a rename shows everywhere at once.
 */
export function ThreadPane({ thread }: { thread: ThreadSummary }) {
  const runtime = useRuntime();
  const session = useSession();
  const [turns, retry] = useTurns(thread.id);
  if (turns.kind === "loading") {
    return <p className="p-4 text-sm text-soft-ink">Opening {thread.title}…</p>;
  }
  if (turns.kind === "failed") {
    return (
      <div className="flex flex-col items-start gap-2 p-4 text-sm">
        <p className="text-ink">{thread.title} could not be opened.</p>
        <p className="text-soft-ink">{turns.reason}</p>
        <QuietButton onClick={retry}>Try again</QuietButton>
      </div>
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
