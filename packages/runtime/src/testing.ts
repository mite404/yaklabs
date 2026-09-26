import type { CardAttachment } from "@yaklabs/catalog/interactive";
import { threads, type Thread } from "@yaklabs/catalog/thread";

// `threads` is a record, so a name can miss; the tests would rather fail loudly here.
function seed(name: string): Thread {
  const thread = new Map(Object.entries(threads)).get(name); // → Thread | undefined
  if (thread === undefined) throw new Error(`The catalog has no seed thread named ${name}`);
  return thread;
}

/** The seeded profit thread: the user's ask (u1), then the interactive profit card (a1). */
export const profitThread = seed("profit");

/** The chip the user sends after stepping the profit card to net profit (ADR-030). */
export const netProfitChoice: CardAttachment = {
  turnId: "a1",
  label: "Net profit · Sep 14–20",
  state: { measure: "Net profit" },
};
