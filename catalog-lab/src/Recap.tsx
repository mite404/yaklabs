import { formatIdle, type RecapItem } from "./recapRules";

/**
 * "Previously on": an outcomes-first recap shown above the compose box after the user
 * has been away (ADR-018). Each item jumps to the turn that holds its evidence.
 * It only reports what happened; questions for the user live in AwaitingInputCard (ADR-039).
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
  if (collapsed)
    return (
      <button className="recap-chip surface-strong" onClick={onExpand}>
        Recap
      </button>
    );

  return (
    <section className="recap surface-strong" aria-label="Recap" role="status">
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
        {items.map((item) => (
          <li key={item.turnId + item.text}>
            <button onClick={() => onJump(item.turnId)}>
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
