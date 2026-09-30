import { AgentTree } from "@yaklabs/catalog";
import type { ThreadSummary } from "@yaklabs/runtime";
import { useRuntimeState } from "../runtime";
import { isWorking } from "../shell/working";

// The pill wears the user bubble's sage (design pillars, rule 15; ADR-142's "same green fill as
// the user conversation bubble"), so it reads as the reader's own work going on elsewhere.
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--bubble-line)] bg-[var(--bubble-tint-strong)] px-2 py-0.5 text-[11px] leading-4 font-medium text-ink";

/**
 * What a child thread says below its compose box (ADR-141, ADR-142): that its parent controls
 * it, and, while its work is in flight by the runtime's own live state, a "Running" pill beside
 * that. The word carries the state; the glyph and the fill only echo it.
 */
export function ChildFootnote({ thread }: { thread: ThreadSummary }) {
  const running = isWorking(useRuntimeState(), thread.id);
  return (
    <div data-slot="child-footnote" className="flex items-center gap-2 text-xs text-soft-ink">
      <span>Controlled by parent thread</span>
      {running && (
        <span data-slot="running" className={PILL}>
          {/* The word names the state; the glyph's own label would say it twice. */}
          <span aria-hidden="true" className="flex">
            <AgentTree />
          </span>
          Running
        </span>
      )}
    </div>
  );
}
