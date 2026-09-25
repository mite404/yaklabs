import type { Agent, AgentEvent } from "./agent";

// A pause before replying, so a reply reads as a response rather than an echo.
const REPLY_DELAY_MS = 700;
// Time between streamed words: fast enough to read as live, slow enough to see.
const WORD_MS = 45;

// Resolves after `ms`, or early and silently if the reply is abandoned.
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });
}

// What the stand-in says for each event; `undefined` means it stays quiet.
function replyText(event: AgentEvent): string | undefined {
  switch (event.kind) {
    case "message": {
      if (event.attachments.length === 0) return undefined;
      const views = event.attachments.map((item) => item.label).join(" and ");
      return `Answering about ${views}, the view you set on the card. Saturday leads at every level, so the weekend carries the week.`;
    }
    case "answer":
      return `Got it: "${event.text}". Carrying on from there.`;
    case "question-rejected": {
      // A real agent reads `reason`; the stand-in only reuses its own question when it was sound.
      const question = (event.question as { question?: unknown } | null)?.question;
      return typeof question === "string" && question.trim()
        ? `${question.trim()} Tell me in a sentence or two and I'll carry on from there.`
        : "I need a bit more context before I carry on. What would you like me to do next?";
    }
  }
}

/**
 * A scripted stand-in for the agent runtime (ADR-041), so the round trip is visible without a
 * model. It streams a canned reply word by word; the timings are adjustable for tests.
 */
export function createLabAgent({
  replyDelayMs = REPLY_DELAY_MS,
  wordMs = WORD_MS,
}: { replyDelayMs?: number; wordMs?: number } = {}): Agent {
  return {
    async *respond(event, signal) {
      if (event.kind === "question-rejected")
        console.info(`[lab agent] question rejected: ${event.reason}`);
      const text = replyText(event);
      if (text === undefined) return;
      await wait(replyDelayMs, signal);
      const words = text.split(" ");
      for (let i = 0; i < words.length && !signal.aborted; i++) {
        if (i > 0) await wait(wordMs, signal);
        if (!signal.aborted) yield (i === 0 ? "" : " ") + words[i];
      }
    },
  };
}

/** The stand-in the thread uses unless it is given a real agent. */
export const labAgent = createLabAgent();
