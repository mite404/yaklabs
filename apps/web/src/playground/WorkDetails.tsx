import { Disclosure } from "@yaklabs/catalog";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { Body, Work } from "./body";
import { assertNever } from "./never";

/**
 * One `<li>` per line, for the short append-only lists a reply shows. Keyed by position: a
 * line can repeat, and an appended line never moves the ones before it.
 */
export function lineItems(lines: readonly string[]): ReactElement[] {
  // oxlint-disable-next-line react/no-array-index-key -- lines repeat and only ever append
  return lines.map((line, index) => <li key={index}>{line}</li>);
}

function statusWord(status: Work["status"]): string {
  switch (status) {
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    case "unfinished":
      return "Unfinished";
    default:
      return assertNever(status);
  }
}

// Earlier labels and superseded narration; the current narration already shows above them.
function earlier(work: Work): string[] {
  return work.log.filter((line) => line !== work.narration);
}

function WorkEntry({ work }: { work: Work }) {
  const history = earlier(work);
  return (
    <li className="pg-work">
      <p>
        <strong>{work.label}</strong>{" "}
        <span className="pg-work-status">{statusWord(work.status)}</span>
      </p>
      {work.narration !== undefined && <p>{work.narration}</p>}
      {history.length > 0 && (
        <>
          <p className="pg-work-heading">Earlier</p>
          <ul>{lineItems(history)}</ul>
        </>
      )}
      {work.outcome !== undefined && work.outcome.evidence.length > 0 && (
        <>
          <p className="pg-work-heading">Evidence</p>
          <ul>{lineItems(work.outcome.evidence)}</ul>
        </>
      )}
    </li>
  );
}

/**
 * The reply's "Work details" (ADR-139): every work item one fold down, closed by default,
 * with its status, narration, earlier labels and outcome evidence.
 */
export function WorkDetails({ body }: { body: Body }) {
  const [open, setOpen] = useState(false);
  const section = useRef<HTMLDivElement>(null);
  // Opening grows the reply, so the details are nudged up to where the eye expects them.
  useEffect(() => {
    if (!open) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.current?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [open]);
  const works = body.workOrder.flatMap((id) => {
    const work = body.works[id];
    return work === undefined ? [] : [work];
  }); // → Work[]
  if (works.length === 0) return null;
  return (
    <div ref={section}>
      <Disclosure
        summary="Work details"
        open={open}
        onToggle={() => {
          setOpen(!open);
        }}
      >
        <ul className="quiet-prose pg-works">
          {works.map((work) => (
            <WorkEntry key={work.id} work={work} />
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
