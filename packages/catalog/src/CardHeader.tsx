import type { DragEvent, ReactNode } from "react";
import { startCardDrag, type SharedCard } from "./share";

// The card the header belongs to.
function cardOf(header: HTMLElement): HTMLElement | undefined {
  const card = header.closest(".card");
  return card instanceof HTMLElement ? card : undefined;
}

// The whole card rides the pointer, not just its handle (ADR-089): the drag image is the card,
// and the card itself dims once the browser has taken its picture, which it does after this
// handler returns.
function liftCard(event: DragEvent<HTMLElement>): void {
  const card = cardOf(event.currentTarget);
  if (!card) return;
  const box = card.getBoundingClientRect();
  event.dataTransfer.setDragImage(card, event.clientX - box.left, event.clientY - box.top);
  window.setTimeout(() => {
    card.dataset.lifted = "";
  }, 0);
}

function settleCard(event: DragEvent<HTMLElement>): void {
  const card = cardOf(event.currentTarget);
  if (card) delete card.dataset.lifted;
}

/**
 * The top of every card (ADR-062): a title, optional lines above and below it, and
 * actions on the right, such as a badge or the share button. A flush line separates the
 * header from the card's body, edge to edge.
 * @param eyebrow A small line above the title (page context only).
 * @param actions Right-aligned controls, e.g. <ShareButton />.
 * @param drag When set, the header is the handle that drags the whole card out of its
 * thread (ADR-089), carrying the same envelope a share link does; the whole card is what
 * rides the pointer, and the card left behind dims until the drag ends.
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
          liftCard(event);
        })
      }
      onDragEnd={drag && settleCard}
    >
      <div className="card-heading-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>
  );
}
