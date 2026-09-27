import { ShareView } from "@yaklabs/catalog";

export function meta() {
  return [{ title: "Shared from Kay" }];
}

/** The public page for one shared card (ADR-064); the card rides in the link's fragment. */
export default function SharePage() {
  return <ShareView />;
}
