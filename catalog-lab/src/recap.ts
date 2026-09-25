/**
 * One structured outcome recorded while the agent worked. Recaps render these
 * records, never free prose written after the fact (ADR-005).
 */
export type RecapItem = {
  kind: "done" | "needs-you";
  text: string;
  /** The thread turn that holds the evidence for this outcome. */
  turnId: string;
};

/** How long an active thread must go without user input before the recap appears. */
export const RECAP_IDLE_MS = 10 * 60 * 1000;

// Items that need the user come first: outcomes before process, action before history.
const KIND_ORDER: Record<RecapItem["kind"], number> = { "needs-you": 0, done: 1 };

/**
 * Whether the recap should be visible: the thread is still active, the user has not
 * sent anything for at least RECAP_IDLE_MS, and they have not dismissed the recap
 * during this idle stretch.
 */
export function shouldShowRecap({
  now,
  lastUserInputAt,
  active,
  dismissedAt,
}: {
  now: number;
  lastUserInputAt: number;
  active: boolean;
  dismissedAt?: number;
}): boolean {
  if (!active) return false;
  if (now - lastUserInputAt < RECAP_IDLE_MS) return false;
  return dismissedAt === undefined || dismissedAt < lastUserInputAt;
}

/** Orders recap items so anything waiting on the user leads; stable within a kind. */
export function orderRecap(items: RecapItem[]): RecapItem[] {
  return [...items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** Formats an idle duration for the recap header, e.g. "12 min" or "2 h 5 min". */
export function formatIdle(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
