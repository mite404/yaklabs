#!/usr/bin/env node
// Drive the web app the way a person would and keep the proof: screenshots, the agent's reply
// text, and every console error. Exits 1 on any failed step.
//
//   pnpm dev:web                                   # in one terminal
//   node apps/web/scripts/web-check.mjs [--base http://127.0.0.1:5173] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);
const { chromium } = playwright.default ?? playwright;

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const BASE = arg("--base", "http://127.0.0.1:5173");
const OUT = arg(
  "--out",
  path.join(ROOT, ".artifacts/web", new Date().toISOString().slice(0, 19).replaceAll(":", "-")),
);
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
function record(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` · ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));
// A dev server never answers 5xx on purpose; Vite's 504 "Outdated Optimize Dep" is the blank
// first page after a fresh install, so the first load has to be clean, not the second.
page.on("response", (response) => {
  if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
});
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

try {
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const title = page.getByRole("heading", { name: "Last week's profit by day" });
  await title.waitFor({ timeout: 15_000 });
  await shot("thread");
  record("thread renders the profit card", true);

  const slider = page.getByRole("slider", { name: "Profit measure" });
  await slider.focus();
  await page.keyboard.press("End");
  const sentence = page.locator(".live-sentence");
  await page.waitForFunction(() =>
    document.querySelector(".live-sentence")?.textContent?.includes("Net profit"),
  );
  await shot("thread-net-profit");
  record("slider moves to Net profit", true, (await sentence.textContent()).trim());

  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Why is Saturday so high?");
  await page.keyboard.press("Enter");
  const reply = page.locator(".turn-agent").last();
  await page.waitForFunction(
    () => {
      const turns = [...document.querySelectorAll(".turn-agent")];
      const last = turns.at(-1);
      return (
        turns.length >= 2 &&
        last?.textContent?.includes("Net profit") &&
        !last.querySelector("[data-streaming]")
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1500);
  await shot("thread-reply");
  const replyText = (await reply.textContent()).trim();
  record(
    "agent reply speaks to the chosen view",
    replyText.includes("Net profit"),
    replyText.slice(0, 120),
  );
  const chip = page.locator(".turn-user").last();
  record(
    "the sent message carries the card choice as a chip",
    (await chip.textContent()).includes("Net profit"),
  );

  // The worker keeps the conversation in the browser's private file system (ADR-081): a fresh
  // load must show the sent message, its chip and the reply again.
  await page.reload({ waitUntil: "load" });
  await title.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await shot("thread-after-reload");
  const turns = await page.locator(".turn-user, .turn-agent").allTextContents();
  record(
    "the conversation survives a reload",
    turns.some((t) => t.includes("Why is Saturday so high?")) &&
      turns.some((t) => t.includes("Answering about Net profit")),
    `${turns.length} turns after reload`,
  );
  record(
    "no memory-only warning",
    !(await page
      .getByText("cannot keep conversations")
      .isVisible()
      .catch(() => false)),
  );

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForTimeout(300);
  await shot("thread-dark");
  record("dark mode switches through data-theme", true);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();

  await page.goto(`${BASE}/lab`, { waitUntil: "load" });
  await page.getByText("Useful answers.").waitFor({ timeout: 10_000 });
  await shot("lab");
  record("lab route renders the workbench", true);

  // The dev server serves the catalog's own modules, so the fragment comes from the real encoder.
  const fragment = await page.evaluate(async (root) => {
    const share = await import(`/@fs${root}/packages/catalog/src/share.ts`);
    const thread = await import(`/@fs${root}/packages/catalog/src/thread.ts`);
    return share.encodeCard({ v: 1, kind: "interactive", payload: thread.profitCard });
  }, ROOT);
  await page.goto(`${BASE}/share.html#${fragment}`, { waitUntil: "load" });
  await page.getByText("Shared from Kay.").waitFor({ timeout: 10_000 });
  await shot("share");
  record(
    "share.html renders the card from the fragment",
    await page.getByRole("heading", { name: "Last week's profit by day" }).isVisible(),
  );

  await page.goto(`${BASE}/share.html`, { waitUntil: "load" });
  await page.getByText("doesn’t contain a card").waitFor({ timeout: 10_000 });
  record("share.html without a card shows the honest notice", true);

  // The dev server answers an unknown path with a 404 status on purpose; that is not a defect.
  const errorsBeforeNotFound = errors.length;
  await page.goto(`${BASE}/nowhere`, { waitUntil: "load" });
  errors.splice(errorsBeforeNotFound);
  await shot("not-found");
  record(
    "unknown path shows the not-found page",
    await page.getByText("Page not found").isVisible(),
  );
} catch (error) {
  record("run", false, String(error));
  await shot("failure");
} finally {
  await browser.close();
}

record("no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, errors }, null, 2));
console.log(`artifacts: ${OUT}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
