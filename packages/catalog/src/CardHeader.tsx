import type { ReactNode } from "react";
import { startCardDrag, type SharedCard } from "./share";

/**
 * The top of every card (ADR-062): a title, optional lines above and below it, and
 * actions on the right, such as a badge or the share button. A flush line separates the
 * header from the card's body, edge to edge.
 * @param eyebrow A small line above the title (page context only).
 * @param actions Right-aligned controls, e.g. <ShareButton />.
 * @param drag When set, the header is the handle that drags the whole card out of its
 * thread (ADR-089), carrying the same envelope a share link does.
 */
export function CardHeader({
  title,
  eyebrow,
  actions,
  drag,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  drag?: { card: SharedCard; title: string };
}) {
  return (
    <header
      className="card-heading"
      draggable={drag !== undefined}
      onDragStart={
        drag &&
        ((event) => {
          startCardDrag(event.dataTransfer, drag.card, drag.title);
        })
      }
    >
      <div className="card-heading-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>
  );
}
