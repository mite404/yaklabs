import type { ReactNode } from "react";

/**
 * The top of every card (ADR-062): a title, optional lines above and below it, and
 * actions on the right, such as a badge or the share button. A flush line separates the
 * header from the card's body, edge to edge.
 * @param eyebrow A small line above the title (page context only).
 * @param actions Right-aligned controls, e.g. <ShareButton />.
 */
export function CardHeader({
  title,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="card-heading">
      <div className="card-heading-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>
  );
}
