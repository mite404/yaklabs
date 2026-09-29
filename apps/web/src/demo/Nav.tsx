import { AgentTree } from "@yaklabs/catalog";
import { Button } from "@yaklabs/ui/components/button";
import { CHILD_LABELS } from "./content";
import type { ChildKey, ChildStatus } from "./state";

const CHILD_KEYS: ChildKey[] = ["workload", "issues"];

const STATUS_WORD: Record<ChildStatus, string> = {
  pending: "not started",
  running: "in progress",
  done: "done",
  failed: "unavailable",
};

/**
 * The thread list, standing in for Kay's sidebar (ADR-138): the main thread first, its two
 * concurrent checks indented under it. Each row is a real jump, not decoration - clicking a
 * child opens the shared evidence disclosure and scrolls to that check's own card.
 */
export function Nav({
  working,
  childStatus,
  started,
  onJumpMain,
  onJumpChild,
}: {
  working: boolean;
  childStatus: Record<ChildKey, ChildStatus>;
  started: boolean;
  onJumpMain: () => void;
  onJumpChild: (key: ChildKey) => void;
}) {
  return (
    <nav className="wb-nav" aria-label="Weekly brief threads">
      <Button
        variant="ghost"
        disabled={!started}
        className="wb-nav-row wb-nav-main"
        onClick={onJumpMain}
      >
        {working && <AgentTree label="Weekly brief is working" />}
        <span className="wb-nav-label">Weekly brief</span>
      </Button>
      <ul className="wb-nav-children">
        {CHILD_KEYS.map((key) => (
          <li key={key}>
            <Button
              variant="ghost"
              disabled={!started}
              className="wb-nav-row wb-nav-child"
              onClick={() => {
                onJumpChild(key);
              }}
            >
              <span aria-hidden="true" className="wb-nav-arrow">
                ↳
              </span>
              {childStatus[key] === "running" && (
                <AgentTree label={`${CHILD_LABELS[key]} is working`} />
              )}
              <span className="wb-nav-label">{CHILD_LABELS[key]}</span>
              <span className="sr-only">{STATUS_WORD[childStatus[key]]}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
