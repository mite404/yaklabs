import { ChatThreadPanel } from "@yaklabs/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { useSidebar } from "@yaklabs/ui/components/sidebar";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { inBackground, reasonOf, useRuntime } from "../runtime";
import { useSession } from "../session";
import { QuietButton } from "./quiet-button";

// A thread's turns as the worker hands them over: on their way, here, or refused.
type Turns =
  | { kind: "loading" }
  | { kind: "open"; messages: ThreadMessage[] }
  | { kind: "failed"; reason: string };

const LOADING: Turns = { kind: "loading" };

// Where the focus rests in a thread, by what it shows: the frame while its turns come, Try
// again when they cannot, the compose box once they are here.
const REST: Record<Turns["kind"], string> = {
  loading: "[data-pending]",
  failed: "[data-pending] [data-retry]", // Try again, not a lane's collapse in the title bar
  open: ".compose-box textarea",
};

// What a thread's host listens with to know whether the focus is in it.
type FocusHandlers = { onFocus: () => void; onBlur: (event: FocusEvent) => void };

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

// Whether the focus waits in `pane` for somewhere to rest: dropped to the page as the part that
// held it went, or on the frame, which only holds it while the turns come.
function isWaiting(pane: HTMLElement): boolean {
  const at = document.activeElement;
  return at === document.body || at === pane.querySelector(REST.loading);
}

// Keeps the focus with a thread while what it shows changes under it. Focus in the thread as
// it changes, on Try again as it is pressed or on the frame while the turns come, would fall to
// the page with the part that held it, so it moves to where the thread now rests. Focus taken
// elsewhere in the meantime stays where it went.
function useFocusFollows(host: RefObject<HTMLElement | null>, turns: Turns): FocusHandlers {
  const holding = useRef(false);
  useEffect(() => {
    const pane = host.current;
    if (pane === null || !holding.current || !isWaiting(pane)) return;
    pane.querySelector<HTMLElement>(REST[turns.kind])?.focus();
  }, [host, turns]);
  return {
    onFocus: () => {
      holding.current = true;
    },
    onBlur: (event) => {
      const next = event.relatedTarget;
      if (next !== null && host.current?.contains(next) !== true) holding.current = false;
    },
  };
}

/**
 * Puts the focus in the first thread inside `within`, where it rests: on its compose box once
 * the thread is open, on Try again if it could not open, and on its frame while it opens, from
 * where the focus follows the thread to one or the other.
 */
export function focusThreadIn(within: ParentNode): void {
  const pane = within.querySelector("[data-thread-pane]");
  const rest =
    pane?.querySelector(`${REST.open}, ${REST.failed}`) ?? pane?.querySelector(REST.loading);
  if (rest instanceof HTMLElement) rest.focus();
}

// A thread whose turns are not here, in the frame an open thread has: the paper, the border and
// the title bar, so a lane keeps the bar it is taken by and the main pane keeps its shape.
function PendingFrame({
  title,
  leading,
  children,
}: {
  title: string;
  leading: ReactNode;
  children: ReactNode;
}) {
  return (
    // The frame takes the focus while the turns come, as a place to hold it (useFocusFollows).
    <section className="thread-panel outline-none" aria-label={title} tabIndex={-1} data-pending="">
      <header className="thread-header">
        {leading !== undefined && <div className="header-leading">{leading}</div>}
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
 * and Try again inside. Focus in the thread stays in it as it changes: from Try again to the
 * frame, and on to Try again again or to the compose box. The title and the opening draft
 * come from the snapshot, so a rename shows everywhere at once.
 * @param leading A control before the title in the title bar, such as a lane's collapse
 * (ADR-124); in the frame too while the turns come.
 */
export function ThreadPane({ thread, leading }: { thread: ThreadSummary; leading?: ReactNode }) {
  const runtime = useRuntime();
  const session = useSession();
  const { isMobile } = useSidebar();
  const [turns, retry] = useTurns(thread.id);
  const host = useRef<HTMLDivElement>(null);
  const follow = useFocusFollows(host, turns);
  return (
    <div ref={host} className="contents" data-thread-pane="" {...follow}>
      {turns.kind === "open" ? (
        <ChatThreadPanel
          thread={{ title: thread.title, messages: turns.messages }}
          agent={runtime.agent(thread.id, session)}
          initialDraft={thread.draft}
          onRename={(title) => {
            inBackground(runtime.rename({ kind: "thread", id: thread.id }, title), "Renaming");
          }}
          cardsCarry={!isMobile}
          leading={leading}
        />
      ) : (
        <PendingFrame title={thread.title} leading={leading}>
          {turns.kind === "loading" ? (
            <p className="text-soft-ink">Opening {thread.title}…</p>
          ) : (
            <>
              <p className="text-ink">{thread.title} could not be opened.</p>
              <p className="text-soft-ink">{turns.reason}</p>
              <QuietButton onClick={retry} data-retry="">
                Try again
              </QuietButton>
            </>
          )}
        </PendingFrame>
      )}
    </div>
  );
}
