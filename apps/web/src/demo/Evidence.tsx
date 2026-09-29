import { CatalogCard, Disclosure } from "@yaklabs/catalog";
import { useState, type RefObject } from "react";
import { issuesChart, technicalLogs, workloadChart } from "./content";
import type { ChildKey, ChildStatus } from "./state";
import type { WorkingChild } from "./timeline";

function checkExplanation(status: ChildStatus | undefined): string {
  if (status === "failed") return "This check failed. No result is available.";
  if (status === "running") return "This check is still running. No result is available yet.";
  return "This check has not started. No result is available yet.";
}

function evidenceLabel(childKey: ChildKey): string {
  return childKey === "workload" ? "Weekly workload" : "Open issues";
}

function outcomeText(child: WorkingChild | undefined): string {
  return child?.outcome ?? checkExplanation(child?.status);
}

function EvidenceStatus({
  child,
  childKey,
}: {
  child: WorkingChild | undefined;
  childKey: ChildKey;
}) {
  const status = child?.status;
  return (
    <div className="quiet-prose">
      <p>
        <strong>{evidenceLabel(childKey)}:</strong> {status ?? "pending"}.
      </p>
      <p>{outcomeText(child)}</p>
    </div>
  );
}

function WorkloadEvidence() {
  return (
    <CatalogCard
      payload={{
        ...workloadChart,
        component: "DataTable",
        props: { ...workloadChart.props, variant: "audit" },
      }}
      context="thread"
      shareable={false}
    />
  );
}

function IssuesEvidence() {
  return (
    <>
      <CatalogCard payload={issuesChart} context="thread" shareable={false} />
      <div className="quiet-prose">
        <p>
          Median days open: Billing 2, Product 6, Access 9. A median is the middle case age in each
          category, not the age of every case.
        </p>
      </div>
    </>
  );
}

function EvidenceChart({
  child,
  childKey,
}: {
  child: WorkingChild | undefined;
  childKey: ChildKey;
}) {
  if (child?.status !== "done") return null;
  return childKey === "workload" ? <WorkloadEvidence /> : <IssuesEvidence />;
}

function EvidenceItem({
  child,
  childKey,
  evidenceRef,
}: {
  child: WorkingChild | undefined;
  childKey: ChildKey;
  evidenceRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={evidenceRef} className="wb-evidence-item">
      <EvidenceStatus child={child} childKey={childKey} />
      <EvidenceChart child={child} childKey={childKey} />
    </div>
  );
}

function isWorkloadLog(line: string): boolean {
  return line.startsWith("fixture:workload") || line.startsWith("check:weekly-workload");
}

function isIssuesLog(line: string): boolean {
  return line.startsWith("fixture:issues") || line.startsWith("check:open-issues");
}

function failedLine(child: WorkingChild | undefined, line: string): string | undefined {
  return child?.status === "failed" ? line : undefined;
}

// A failed check has no fixture result to show, but its own status line is still worth keeping
// so the record shows the check ran and what it found, not that it simply never happened.
function failedLogLines(
  workload: WorkingChild | undefined,
  issues: WorkingChild | undefined,
): string[] {
  return [
    failedLine(workload, "check:weekly-workload status=failed source=fixture"),
    failedLine(issues, "check:open-issues status=failed source=fixture"),
  ].filter((line): line is string => line !== undefined);
}

// Fixture and check lines for a category only appear once that category actually finished;
// a failed or still-running category shows its status through `failedLogLines` instead.
function logsFor(workload: WorkingChild | undefined, issues: WorkingChild | undefined): string[] {
  const workloadDone = workload?.status === "done";
  const issuesDone = issues?.status === "done";
  const logs = technicalLogs.filter((line) => {
    if (isWorkloadLog(line)) return workloadDone;
    if (isIssuesLog(line)) return issuesDone;
    return true;
  });
  return [...logs, ...failedLogLines(workload, issues)];
}

function TechnicalDetails({ checks, history }: { checks: WorkingChild[]; history: string[] }) {
  const [open, setOpen] = useState(false);
  const workload = checks.find((child) => child.key === "workload");
  const issues = checks.find((child) => child.key === "issues");
  const logs = logsFor(workload, issues);

  return (
    <Disclosure
      summary="Technical details"
      open={open}
      onToggle={() => {
        setOpen(!open);
      }}
    >
      {history.length > 0 && (
        <div className="quiet-prose">
          <p>
            <strong>Earlier progress narration (superseded):</strong>
          </p>
          {history.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      )}
      <pre>
        <code>{logs.join("\n")}</code>
      </pre>
    </Disclosure>
  );
}

/**
 * The single "Work details" disclosure attached to the finding (ADR-139): both children's
 * evidence, each an approved chart with the catalog's own "View data table" toggle for exact
 * values, and - nested one level deeper - the technical log lines a curious user can open
 * without making everyone else read them. The logs are the fixture records the checks actually
 * read, never a claim of a live tool run.
 */
export function Evidence({
  open,
  onToggle,
  workloadRef,
  issuesRef,
  checks,
  history,
}: {
  open: boolean;
  onToggle: () => void;
  workloadRef: RefObject<HTMLDivElement | null>;
  issuesRef: RefObject<HTMLDivElement | null>;
  checks: WorkingChild[];
  history: string[];
}) {
  const workload = checks.find((child) => child.key === "workload");
  const issues = checks.find((child) => child.key === "issues");

  return (
    <div id="brief-evidence">
      <Disclosure summary="Work details" open={open} onToggle={onToggle}>
        <div className="wb-evidence">
          <EvidenceItem child={workload} childKey="workload" evidenceRef={workloadRef} />
          <EvidenceItem child={issues} childKey="issues" evidenceRef={issuesRef} />
          <TechnicalDetails checks={checks} history={history} />
        </div>
      </Disclosure>
    </div>
  );
}
