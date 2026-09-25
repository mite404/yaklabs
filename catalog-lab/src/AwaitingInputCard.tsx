import { useRef, useState, type KeyboardEvent } from "react";
import type { AwaitingInput } from "./awaiting";
import { Disclosure } from "./Disclosure";

// The way out when the agent does not word one for the moment: the user is never cornered.
const ELSEWHERE = "Chat about something else";

/**
 * "Needs you": the agent is blocked on a question, floating above the compose box (ADR-039).
 * Numbered tiles, after Claude's and Amp's question prompts (ADR-045): the agent's branches,
 * a concrete question answered in a field, and a way out ("Chat about something else", or the
 * agent's wording for the moment). Choosing is two steps: a click, a number key, or the arrow
 * keys select a tile, and Enter or Submit sends it; Skip sets the question aside.
 * The header folds the card to one line, so the user can read the thread above and come back.
 * @param onAnswer Sends a branch's label or the typed answer as the user's reply.
 * @param onElsewhere Sets the question aside and hands focus back to the compose box.
 * @param startCollapsed Open folded to its header (stories).
 */
export function AwaitingInputCard({
  question,
  onAnswer,
  onElsewhere,
  startCollapsed = false,
}: {
  question: AwaitingInput;
  onAnswer: (answer: string) => void;
  onElsewhere: () => void;
  startCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!startCollapsed);
  const [selected, setSelected] = useState<number>();
  const [typed, setTyped] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const options = useRef<HTMLDivElement>(null);
  // Rows are 0-based here and shown 1-based: the branches, then the answer, then the way out.
  const answerRow = question.options.length;
  const elsewhereRow = answerRow + 1;
  const rows = elsewhereRow + 1;
  const canSubmit = selected !== undefined && (selected !== answerRow || typed.trim() !== "");

  // Selecting moves focus to the chosen tile, as in any radio group, so Enter sends it.
  function select(row: number) {
    setSelected(row);
    if (row === answerRow) field.current?.focus();
    else options.current?.querySelectorAll<HTMLElement>(".awaiting-tile")[row]?.focus();
  }

  function submit() {
    if (selected === undefined || !canSubmit) return;
    if (selected === answerRow) onAnswer(typed.trim());
    else if (selected === elsewhereRow) onElsewhere();
    else onAnswer(question.options[selected].label);
  }

  // Number keys and arrows select, Enter sends (Space or a click also selects a tile).
  // While typing only Enter is ours; the header and the action buttons keep their own Enter.
  function keys(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (!open) return;
    const typing = target instanceof HTMLInputElement;
    const ownEnter = target.closest(".disclosure-header, .awaiting-actions") !== null;
    if (event.key === "Enter") {
      if (ownEnter) return;
      submit();
    }
    else if (typing) return;
    else if (event.key === "ArrowDown") select(((selected ?? -1) + 1) % rows);
    else if (event.key === "ArrowUp") select(((selected ?? rows) - 1 + rows) % rows);
    else if (Number(event.key) >= 1 && Number(event.key) <= rows) select(Number(event.key) - 1);
    else return;
    event.preventDefault();
  }

  const tile = (row: number) => ({
    role: "radio" as const,
    "aria-checked": selected === row,
    "data-selected": selected === row || undefined,
  });

  return (
    <section
      className="awaiting attention-surface"
      aria-label="Needs you"
      data-open={open || undefined}
      onKeyDown={keys}
    >
      <Disclosure
        open={open}
        onToggle={() => setOpen(!open)}
        summary={
          <>
            <span className="awaiting-label">Needs you</span>
            {!open && <span className="awaiting-summary">{question.question}</span>}
          </>
        }
      >
          <h3 className="awaiting-question" id="awaiting-question">
            {question.question}
          </h3>
          <div ref={options} className="awaiting-options" role="radiogroup" aria-labelledby="awaiting-question">
            {question.options.map((option, i) => (
              <button key={option.label} className="tile awaiting-tile" onClick={() => select(i)} {...tile(i)}>
                <span className="awaiting-key">{i + 1}</span>
                <span>
                  <span className="awaiting-option">{option.label}</span>
                  {option.detail && <span className="awaiting-detail">{option.detail}</span>}
                </span>
              </button>
            ))}
            <div className="tile awaiting-tile awaiting-answer" onClick={() => select(answerRow)} {...tile(answerRow)}>
              <span className="awaiting-key">{answerRow + 1}</span>
              <input
                ref={field}
                className="field"
                value={typed}
                onFocus={() => setSelected(answerRow)}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={question.answer.placeholder}
                aria-label={question.answer.placeholder}
              />
            </div>
            <button className="tile awaiting-tile" onClick={() => select(elsewhereRow)} {...tile(elsewhereRow)}>
              <span className="awaiting-key">{elsewhereRow + 1}</span>
              <span className="awaiting-option">{question.elsewhere ?? ELSEWHERE}</span>
            </button>
          </div>
          <div className="awaiting-actions">
            <button className="awaiting-action" onClick={onElsewhere}>
              Skip
            </button>
            <button className="awaiting-action awaiting-submit" disabled={!canSubmit} onClick={submit}>
              Submit
            </button>
          </div>
      </Disclosure>
    </section>
  );
}
