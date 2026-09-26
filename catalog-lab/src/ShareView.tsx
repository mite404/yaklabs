import { useEffect, useState } from "react";
import { CatalogCard } from "./CatalogCard";
import { InteractiveCard } from "./InteractiveCard";
import { decodeCard } from "./share";
import "./thread.css";

/**
 * The public page for one shared card (ADR-064): only the component, never the chat around
 * it. The card comes from the link's fragment and passes the same catalog check as in the
 * thread, so a garbled or edited link shows an honest notice instead of a broken view.
 * Interactive cards stay interactive, since their data travels with them (ADR-029).
 * @param hash A fixed fragment (stories and tests); omit to follow the page's own link, which
 * also updates when a new link is opened in the same tab (only the fragment changes then).
 */
export function ShareView({ hash }: { hash?: string }) {
  const [live, setLive] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash,
  );
  useEffect((): void | (() => void) => {
    if (hash !== undefined) return;
    const follow = () => setLive(window.location.hash);
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [hash]);
  const card = decodeCard(hash ?? live);
  return (
    <main className="share-page">
      <div className="share-frame" data-context="thread">
        {card?.kind === "interactive" ? (
          <InteractiveCard
            key={hash ?? live}
            payload={card.payload}
            turnId="shared"
            onChoose={() => {}}
            shareable={false}
          />
        ) : card ? (
          <CatalogCard payload={card.payload} context="thread" shareable={false} />
        ) : (
          <section className="card state" data-context="thread">
            <h2>This link doesn’t contain a card.</h2>
            <p>
              It may be incomplete or have been changed. Ask whoever shared it for a fresh link.
            </p>
          </section>
        )}
        <p className="share-note">
          Shared from Kay. Only this view is shared, not the conversation.
        </p>
      </div>
    </main>
  );
}
