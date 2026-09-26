import { expect, it } from "vitest";
import { decodeCard, encodeCard, shareLink, type SharedCard } from "./share";
import { profitCard } from "./thread";

const card: SharedCard = { v: 1, kind: "interactive", payload: profitCard };

// A link fragment for any JSON, as a hand-edited or foreign link would carry it.
function fragmentOf(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return `#c=${btoa(String.fromCodePoint(...bytes))}`;
}

it("round-trips a card through a link fragment, including non-ASCII text", () => {
  const withDash: SharedCard = { v: 1, kind: "catalog", payload: { title: "Sep 14–20 · €" } };
  expect(decodeCard("#" + encodeCard(card))).toEqual(card);
  expect(decodeCard(encodeCard(withDash))).toEqual(withDash);
  expect(decodeCard(fragmentOf(card))).toEqual(card);
});

it("returns nothing for a fragment that is missing, garbled or of an unknown kind", () => {
  expect(decodeCard("")).toBeUndefined();
  expect(decodeCard("#c=not-base64-json")).toBeUndefined();
  expect(decodeCard(fragmentOf({ ...card, kind: "chat" }))).toBeUndefined();
  expect(decodeCard(fragmentOf({ ...card, v: 2 }))).toBeUndefined();
});

it("links to share.html in the app and to the public-page story inside Storybook", () => {
  const app = {
    href: "https://kay.example/lab/",
    pathname: "/lab/",
    origin: "https://kay.example",
  } as Location;
  expect(shareLink(card, app)).toMatch(/^https:\/\/kay\.example\/lab\/share\.html#c=/);
  const storybook = {
    href: "http://localhost:6006/iframe.html?id=x",
    pathname: "/iframe.html",
    origin: "http://localhost:6006",
  } as Location;
  expect(shareLink(card, storybook)).toMatch(
    /^http:\/\/localhost:6006\/iframe\.html\?id=share-public-page--from-link&viewMode=story#c=/,
  );
});
