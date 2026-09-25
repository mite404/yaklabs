import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { AwaitingInput } from "./awaiting";

// The way out when the agent does not word one for the moment: the user is never cornered.
const ELSEWHERE = "Chat about something else";

/**
 * "Needs you": the agent is blocked on a question, floating above the compose box (ADR-039).
 * Numbered choices, after Claude Code's question prompt: the agent's branches, a concrete
 * question answered right in the card, and a way out ("Chat about something else", or the
 * agent's wording for the moment). Keys 1 to N pick a row.
 * It has no close button; leaving is itself a choice, so the question is never silently lost.
 * @param onAnswer Sends a branch's label or the typed answer as the user's reply.
 * @param onElsewhere Sets the question aside and hands focus back to the compose box.
 */
export function AwaitingInputCard({
  question,
  onAnswer,
  onElsewhere,
}: {
  question: AwaitingInput;
  onAnswer: (answer: string) => void;
  onElsewhere: () => void;
}) {
  const [typed, setTyped] = useState("");
  const answerRow = question.options.length + 1;
  const elsewhereRow = answerRow + 1;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (typed.trim()) onAnswer(typed.trim());
  }

  // Number keys pick a row, except while the user is typing an answer.
  function pick(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    const row = Number(event.key);
    if (row >= 1 && row <= question.options.length) onAnswer(question.options[row - 1].label);
    else if (row === answerRow)
      event.currentTarget.querySelector<HTMLInputElement>(".awaiting-answer input")?.focus();
    else if (row === elsewhereRow) onElsewhere();
    else return;
    event.preventDefault();
  }

  return (
    <section className="awaiting" aria-label="Needs you" onKeyDown={pick}>
      <p className="awaiting-label">Needs you</p>
      <h3 className="awaiting-question">{question.question}</h3>
      <ol className="awaiting-options">
        {question.options.map((option, i) => (
          <li key={option.label}>
            <button className="awaiting-row" onClick={() => onAnswer(option.label)}>
              <span className="awaiting-key">{i + 1}</span>
              <span>
                <span className="awaiting-option">{option.label}</span>
                {option.detail && <span className="awaiting-detail">{option.detail}</span>}
              </span>
            </button>
          </li>
        ))}
        <li>
          <form className="awaiting-row awaiting-answer" onSubmit={submit}>
            <span className="awaiting-key">{answerRow}</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={question.answer.placeholder}
              aria-label={question.answer.placeholder}
            />
            <button type="submit" className="awaiting-send" disabled={!typed.trim()} aria-label="Send answer">
              ↵
            </button>
          </form>
        </li>
        <li>
          <button className="awaiting-row" onClick={onElsewhere}>
            <span className="awaiting-key">{elsewhereRow}</span>
            <span className="awaiting-option awaiting-elsewhere">
              {question.elsewhere ?? ELSEWHERE}
            </span>
          </button>
        </li>
      </ol>
    </section>
  );
}
