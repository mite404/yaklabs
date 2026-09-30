import { useState } from "react";
import { AgentTree } from "./AgentTree";
import { CatalogCard } from "./CatalogCard";
import { Disclosure } from "./Disclosure";
import { ChildThreadIcon } from "./icons";
import type { StepStatus, Work, WorkLabel, WorkStep } from "./reply";

// Where a step stands, as one plain word first on its row: words, never colour alone, tell a
// finished step from one that did not finish (ADR-139).
const STATUS_WORDS: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Unavailable",
  cancelled: "Stopped",
};

// One step: where it stands, what it was (a branch before it when it ran as a child thread),
// what it found, and the card that backs it.
function StepRow({ step, carries }: { step: WorkStep; carries: boolean }) {
  const word = STATUS_WORDS[step.status];
  return (
    <li className="work-step" data-status={step.status}>
      <p className="work-step-status">
        {step.status === "running" ? (
          <>
            {/* The glyph's label announces the state; the word beside it is for the eye. */}
            <AgentTree label={word} />
            <span aria-hidden="true">{word}</span>
          </>
        ) : (
          word
        )}
      </p>
      <p className="work-step-label">
        {step.threadId !== undefined && (
          <span className="work-step-thread">
            <ChildThreadIcon />
            <span className="work-step-thread-name">Child thread: </span>
          </span>
        )}
        {step.label}
      </p>
      {step.outcome !== undefined && <p className="work-step-outcome">{step.outcome}</p>}
      {step.evidence !== undefined && (
        <CatalogCard
          payload={step.evidence}
          context="thread"
          draggable={carries}
          shareable={false}
        />
      )}
    </li>
  );
}

// The narration the reply moved past and its technical lines, one level deeper, for a reader
// who wants to check the work rather than read it.
function TechnicalDetails({ work }: { work: Work }) {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure
      summary="Technical details"
      open={open}
      onToggle={() => {
        setOpen(!open);
      }}
    >
      <div className="work-technical">
        {work.narration.length > 0 && (
          <section aria-label="Earlier progress narration">
            <p className="work-technical-title">Earlier progress narration</p>
            <ul className="work-narration">
              {work.narration.map((line, i) => (
                // Narration is only ever appended, so a line's place is its identity.
                // oxlint-disable-next-line react/no-array-index-key -- see above
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        )}
        {work.logs.length > 0 && (
          <pre className="work-logs">
            <code>{work.logs.join("\n")}</code>
          </pre>
        )}
      </div>
    </Disclosure>
  );
}

/**
 * The one disclosure above a reply (ADR-139, amended): mounted when the work starts, so it never
 * appears over text someone is reading, its header says what the reply is doing now (live, with
 * the working glyph) and then what the work amounted to, with a count beside it (`workLabel`).
 * Folded under it: each step's state in a word, its label, its outcome in plain prose and the
 * card that backs it. The superseded narration and the technical logs sit one disclosure deeper,
 * so a reader who only wants the answer never has to read them. Both start folded; each turn
 * keeps its own.
 * @param cardsCarry Whether an evidence card's header carries it out onto the canvas (ADR-089).
 */
export function WorkDetails({
  work,
  label,
  cardsCarry,
}: {
  work: Work;
  label: WorkLabel;
  cardsCarry?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const technical = work.logs.length > 0 || work.narration.length > 0;
  return (
    <div className="work-details" data-live={label.live || undefined}>
      <Disclosure
        summary={
          label.live ? (
            <span className="work-live">
              {/* The glyph's label announces the state; the words beside it are for the eye. */}
              <AgentTree label={label.label} />
              <span aria-hidden="true">{label.label}</span>
            </span>
          ) : (
            label.label
          )
        }
        detail={label.detail}
        open={open}
        onToggle={() => {
          setOpen(!open);
        }}
      >
        {work.steps.length > 0 && (
          <ol className="work-list">
            {work.steps.map((step) => (
              <StepRow key={step.id} step={step} carries={cardsCarry !== false} />
            ))}
          </ol>
        )}
        {technical && <TechnicalDetails work={work} />}
      </Disclosure>
    </div>
  );
}
