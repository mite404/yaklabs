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
      <div className="quiet-prose">
        <p>
          <strong>{childKey === "workload" ? "Weekly workload" : "Open issues"}:</strong>{" "}
          {child?.status ?? "pending"}.
        </p>
        <p>{child?.outcome ?? checkExplanation(child?.status)}</p>
      </div>
      {child?.status === "done" &&
        (childKey === "workload" ? (
          <CatalogCard
            payload={{
              ...workloadChart,
              component: "DataTable",
              props: { ...workloadChart.props, variant: "audit" },
            }}
            context="thread"
            shareable={false}
          />
        ) : (
          <>
            <CatalogCard payload={issuesChart} context="thread" shareable={false} />
            <div className="quiet-prose">
              <p>
                Median days open: Billing 2, Product 6, Access 9. A median is the middle case age in
                each category, not the age of every case.
              </p>
            </div>
          </>
        ))}
    </div>
  );
}

function TechnicalDetails({ checks, history }: { checks: WorkingChild[]; history: string[] }) {
  const [open, setOpen] = useState(false);
  const workload = checks.find((child) => child.key === "workload");
  const issues = checks.find((child) => child.key === "issues");
  const logs = technicalLogs.filter((line) => {
    if (line.startsWith("fixture:workload") || line.startsWith("check:weekly-workload"))
      return workload?.status === "done";
    if (line.startsWith("fixture:issues") || line.startsWith("check:open-issues"))
      return issues?.status === "done";
    return true;
  });
  if (workload?.status === "failed")
    logs.push("check:weekly-workload status=failed source=fixture");
  if (issues?.status === "failed") logs.push("check:open-issues status=failed source=fixture");

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
