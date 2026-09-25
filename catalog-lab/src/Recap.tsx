import { formatIdle, orderRecap, type RecapItem } from "./recapRules";

const KIND_LABEL: Record<RecapItem["kind"], string> = {
  "needs-you": "Needs you",
  done: "Done",
};

/**
 * "Previously on": an outcomes-first recap shown above the compose box after the user
 * has been away (ADR-018). Each item jumps to the turn that holds its evidence.
 * When `collapsed`, it shrinks to a chip so it never competes with typing.
 */
export function Recap({
  items,
  idleMs,
  collapsed,
  onExpand,
  onDismiss,
  onJump,
}: {
  items: RecapItem[];
  idleMs: number;
  collapsed: boolean;
  onExpand: () => void;
  onDismiss: () => void;
  onJump: (turnId: string) => void;
}) {
  const needsYou = items.filter((item) => item.kind === "needs-you").length;

  if (collapsed)
    return (
      <button className="recap-chip" onClick={onExpand}>
        Recap
        {needsYou > 0 && <span className="recap-count">{needsYou}</span>}
      </button>
    );

  return (
    <section className="recap" aria-label="Recap" role="status">
      <header className="recap-header">
        <p>
          <strong>Recap</strong>
          <span className="muted"> · {formatIdle(idleMs)} since your last message</span>
        </p>
        <button className="recap-close" onClick={onDismiss} aria-label="Dismiss recap">
          ×
        </button>
      </header>
      <ul>
        {orderRecap(items).map((item) => (
          <li key={item.turnId + item.text}>
            <button onClick={() => onJump(item.turnId)}>
              <span className={`recap-kind recap-kind-${item.kind}`}>
                {KIND_LABEL[item.kind]}
              </span>
              <span className="recap-text">{item.text}</span>
              <span className="recap-go" aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
