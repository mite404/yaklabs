// oxlint-disable no-await-in-loop -- a lever drives one step at a time
// The scripted demo's steps, one function each, for brief-check.mjs to run in order. Every step
// throws when what it proves does not hold, and may return a detail for the report.
import assert from "node:assert/strict";
import path from "node:path";

// The walkthrough's ceiling for one scenario at 1x (the interview's three minutes).
const WALKTHROUGH_MS = 180_000;
// A 2x run must take under this share of the 1x run's wall time.
const FAST_SHARE = 0.6;
const REQUEST = "Can you prepare Monday's support brief?";
const INTERRUPTED = "Interrupted · Incomplete answer";

// What is on screen: the tab's workspace, its bare main thread, the sidebar and the controls.
const onScreen = (page) => page.locator('[role="tabpanel"]:not([inert])');
const mainOf = (page) => onScreen(page).locator("section.thread-panel[data-bare]");
const composeOf = (page) => mainOf(page).locator(".compose-box textarea");
const agentTurns = (page) => mainOf(page).locator("article.turn-agent");
const busyTurns = (page) => mainOf(page).locator('article.turn-agent[aria-busy="true"]');
const sidebarOf = (page) => page.locator('[data-slot="sidebar"]');
const statusOf = (page) => page.locator('[data-slot="demo-status"]');
const toolbarOf = (page) => page.getByRole("toolbar", { name: "Scripted demo" });
const button = (page, name) => toolbarOf(page).getByRole("button", { name, exact: true });

// Resolves once `check` holds, polled every 100ms, or throws `what` after `timeout`.
async function until(check, what, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await check()) === true) return;
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`timed out waiting for ${what}`);
}

const isDone = async (page) => (await statusOf(page).innerText()).startsWith("Done");
const untilDone = (page, timeout = 60_000) => until(() => isDone(page), "Done", timeout);

// Whether an element stands between two paragraphs; it runs in the page.
const betweenParagraphs = (el) =>
  el.previousElementSibling?.tagName === "P" && el.nextElementSibling?.tagName === "P";

// The first paragraph's type as the browser draws it.
const typography = (paragraph) =>
  paragraph.evaluate((p) => ({
    size: getComputedStyle(p).fontSize,
    leading: getComputedStyle(p).lineHeight,
    weight: getComputedStyle(p.querySelector("strong")).fontWeight,
  }));

/** Opens a scenario on a fresh load, ready to play, at 2x. */
async function openFast(page, run, script) {
  await page.goto(`${run.base}/demo/weekly-brief?script=${script}`);
  await composeOf(page).waitFor({ timeout: 20_000 });
  await button(page, "Play").waitFor();
  await toolbarOf(page).getByRole("button", { name: "Fast forward, 2x" }).click();
  await button(page, "Play").click();
}

async function shellPresent(page, run) {
  await page.goto(`${run.base}/demo/weekly-brief`);
  await composeOf(page).waitFor({ timeout: 20_000 });
  await page.locator('[data-slot="rail"]').waitFor();
  await sidebarOf(page).locator('[data-thread="main"]', { hasText: "Weekly brief" }).waitFor();
  await page.getByLabel("Open threads").getByText("Weekly brief", { exact: true }).waitFor();
  await toolbarOf(page).getByText("Nothing is sent or changed").waitFor();
  await button(page, "Play").waitFor();
  assert.equal(await statusOf(page).innerText(), "Ready");
  await run.shot("01-ready");
  return page.url();
}

async function typesThenSends(page, run) {
  run.timing.began = Date.now();
  await button(page, "Play").click();
  await until(async () => (await composeOf(page).inputValue()).startsWith("Can you"), "typing");
  const typed = await composeOf(page).inputValue();
  await mainOf(page).locator("article.turn-user", { hasText: REQUEST }).waitFor();
  assert.equal(await composeOf(page).inputValue(), "", "the send empties the compose box");
  return `typed ${JSON.stringify(typed)} before the send`;
}

async function showsWorking(page, run) {
  await agentTurns(page).locator(".agent-tree").first().waitFor();
  await run.shot("02-working");
}

async function childrenWork(page) {
  const workload = sidebarOf(page).locator('[aria-label="Weekly workload is working"]');
  const issues = sidebarOf(page).locator('[aria-label="Open issues by category is working"]');
  await workload.waitFor();
  await issues.waitFor();
  await workload.waitFor({ state: "hidden", timeout: 15_000 });
  assert.equal(await issues.isVisible(), true, "Open issues still works as Weekly workload ends");
}

async function findingStreams(page, run) {
  await busyTurns(page).locator(".quiet-prose p strong").first().waitFor({ timeout: 30_000 });
  const measured = await typography(busyTurns(page).locator(".quiet-prose p").first());
  assert.equal(await busyTurns(page).count(), 1, "the reply is still streaming");
  assert.deepEqual(measured, { size: "15px", leading: "24px", weight: "600" });
  await run.shot("03-streaming");
  return JSON.stringify(measured);
}

async function pauseHolds(page, run) {
  const pausedAt = Date.now();
  await button(page, "Pause").click();
  const held = await busyTurns(page).innerText();
  await page.waitForTimeout(800);
  assert.equal(await busyTurns(page).innerText(), held, "nothing streams while paused");
  assert.match(await statusOf(page).innerText(), /^Paused · \d+:\d\d$/);
  await button(page, "Play").click();
  run.timing.paused = Date.now() - pausedAt;
  await until(async () => (await busyTurns(page).innerText()) !== held, "the stream to go on");
  return `held at ${held.length} characters`;
}

async function cardBetweenParagraphs(page) {
  const card = agentTurns(page).first().locator(".quiet-prose > .prose-card").first();
  await card.waitFor({ timeout: 30_000 });
  await until(() => card.evaluate(betweenParagraphs), "a paragraph after the card");
}

async function questionDocks(page, run) {
  await mainOf(page)
    .getByText(/needs attention/i)
    .first()
    .waitFor({ timeout: 30_000 });
  await run.shot("04-decision");
}

async function playerAnswers(page) {
  const answers = mainOf(page).locator('[aria-label="Your answers"]');
  await answers.waitFor({ timeout: 30_000 });
  assert.match(await answers.innerText(), /Oldest first/);
}

async function draftArrives(page) {
  await mainOf(page)
    .locator("h3", { hasText: "Monday support brief (draft)" })
    .waitFor({ timeout: 30_000 });
}

async function doneAtOneX(page, run) {
  await untilDone(page, WALKTHROUGH_MS);
  const { timing } = run;
  timing.slow = Date.now() - timing.began - (timing.paused ?? 0); // → the time it played
  assert.ok(timing.slow < WALKTHROUGH_MS, `${timing.slow}ms`);
  await run.shot("05-done");
  return `${timing.slow}ms at 1x, status "${await statusOf(page).innerText()}"`;
}

async function workDetails(page, run) {
  const turn = agentTurns(page).first();
  await turn.getByRole("button", { name: /^Work details/ }).click();
  const technical = turn.getByRole("button", { name: "Technical details" });
  await technical.waitFor();
  assert.equal(await technical.getAttribute("aria-expanded"), "false");
  await technical.click();
  assert.ok((await turn.locator("pre code").count()) > 0, "the logs sit in pre code");
  const narration = mainOf(page).getByText("Selecting the support records.", { exact: true });
  assert.equal(await narration.count(), 1, "the narration shows once in the transcript");
  assert.equal(await narration.evaluate((el) => el.closest(".work-technical") !== null), true);
  await technical.scrollIntoViewIfNeeded();
  await run.shot("06-work-details");
}

async function restartFaster(page, run) {
  await toolbarOf(page).getByRole("button", { name: "Restart" }).click();
  await until(async () => (await statusOf(page).innerText()) === "Ready", "Ready after Restart");
  await composeOf(page).waitFor();
  const fast = toolbarOf(page).getByRole("button", { name: "Fast forward, 2x" });
  await fast.click();
  assert.equal(await fast.getAttribute("aria-pressed"), "true");
  const began = Date.now();
  await button(page, "Play").click();
  await untilDone(page);
  const { timing } = run;
  timing.fast = Date.now() - began;
  assert.ok(timing.fast < timing.slow * FAST_SHARE, `${timing.fast}ms against ${timing.slow}ms`);
  return `${timing.fast}ms at 2x against ${timing.slow}ms at 1x`;
}

async function childOpensLane(page, run) {
  await sidebarOf(page).locator('[data-thread="child"]', { hasText: "Weekly workload" }).click();
  await page.waitForURL(/\/demo\/weekly-brief\/t\//);
  const lane = onScreen(page)
    .getByRole("region", { name: "Compose canvas" })
    .locator('article[aria-label="Weekly workload"]');
  await lane.waitFor();
  await lane.getByText("Controlled by parent thread").waitFor();
  await run.shot("07-child-lane");
  return page.url();
}

async function interruptedSaysSo(page, run) {
  await openFast(page, run, "interrupted");
  await mainOf(page).getByText(INTERRUPTED).waitFor({ timeout: 60_000 });
  await agentTurns(page).first().getByRole("button", { name: "Try again" }).waitFor();
  await run.shot("08-interrupted");
}

async function retryIsSecondAttempt(page) {
  await until(async () => (await agentTurns(page).count()) >= 2, "a second agent turn", 60_000);
  await untilDone(page);
  assert.equal(await mainOf(page).getByText(INTERRUPTED).count(), 1);
  assert.match(await agentTurns(page).nth(1).innerText(), /carry no order number/);
}

async function sidebarAndBell(page, run) {
  await sidebarOf(page).locator('[data-thread="child"]', { hasText: "Order lookups" }).waitFor();
  await page.getByRole("button", { name: "Notifications, 1 unread" }).waitFor();
  await run.shot("09-retried");
}

async function opensOnRecap(page, run) {
  await page.goto(`${run.base}/demo/weekly-brief?script=returned`);
  await composeOf(page).waitFor({ timeout: 20_000 });
  const recap = mainOf(page).getByRole("region", { name: "Recap" });
  await recap.waitFor({ timeout: 10_000 });
  assert.match(await recap.innerText(), /25 min since your last message/);
  assert.equal(await recap.locator("li").count(), 3, "one item per finished step");
  assert.equal(await sidebarOf(page).locator('[data-thread="child"]').count(), 3);
  assert.match(await agentTurns(page).first().locator(".turn-stamp").innerText(), /20m ago/);
  await run.shot("10-recap");
  return (await recap.innerText()).replaceAll("\n", " · ");
}

async function recapJumpsToEvidence(page, run) {
  const recap = mainOf(page).getByRole("region", { name: "Recap" });
  await recap.locator("li button").first().click();
  const turn = agentTurns(page).first();
  await until(async () => (await turn.getAttribute("data-flash")) !== null, "the turn to glow");
  await turn.getByRole("button", { name: /^Work details/ }).click();
  await turn.locator(".work-step").nth(2).waitFor();
  assert.equal(await turn.locator(".work-step .card").count(), 1, "the southern card backs it");
  await run.shot("11-evidence");
}

async function askedThenAnswered(page, run) {
  await toolbarOf(page).getByRole("button", { name: "Fast forward, 2x" }).click();
  await button(page, "Play").click();
  await mainOf(page)
    .getByText(/needs attention/i)
    .first()
    .waitFor({ timeout: 60_000 });
  const answers = mainOf(page).locator('[aria-label="Your answers"]');
  await answers.waitFor({ timeout: 30_000 });
  assert.match(await answers.innerText(), /Hold them/);
  await untilDone(page);
  assert.match(await agentTurns(page).last().innerText(), /marked for review/);
  await run.shot("12-returned-done");
}

/** The brief at 1x step by step, again at 2x after Restart, then the shell's own navigation. */
export const briefSteps = [
  ["shell present: rail, sidebar row, tab, compose box, Play, Ready", shellPresent],
  ["Play types the request into the compose box, then sends it", typesThenSends],
  ["the reply shows the AgentTree while it works", showsWorking],
  ["two children work in the sidebar, and one finishes before the other", childrenWork],
  ["the finding streams in Quiet prose: 15px/24px, strong at 600, while busy", findingStreams],
  ["Pause holds the stream, and Play goes on from there", pauseHolds],
  ["a card sits between two paragraphs", cardBetweenParagraphs],
  ["the decision docks as Needs attention", questionDocks],
  ["the player answers: Your answers shows Oldest first", playerAnswers],
  ["the draft arrives under its heading", draftArrives],
  ["the whole run ends Done at 1x inside the walkthrough", doneAtOneX],
  ["Work details opens; Technical details holds the logs and the old narration", workDetails],
  ["Restart with 2x plays the brief in under 60% of the 1x time", restartFaster],
  ["a child's row opens its lane on the canvas, under the demo's address", childOpensLane],
];

/** The interrupted reply, its retry, and what the sidebar and the bell say. */
export const interruptedSteps = [
  ["an interrupted reply says so and offers Try again", interruptedSaysSo],
  ["the player's retry is a second attempt, and the first keeps its label", retryIsSecondAttempt],
  ["the sidebar lists Order lookups and the bell counts one", sidebarAndBell],
];

/** A run the user did not watch: the recap, its evidence, then the one thing that needs them. */
export const returnedSteps = [
  [
    "opens on a recap of three outcomes, 25 min since the last message, three children",
    opensOnRecap,
  ],
  ["a recap item jumps to its turn, and Work details holds the evidence", recapJumpsToEvidence],
  [
    "Play asks what needs you: the question docks, Hold them is recorded, then Done",
    askedThenAnswered,
  ],
];

/** Where a step's screenshot goes. */
export const shotIn = (out, page) => (name) =>
  page.screenshot({ path: path.join(out, `${name}.png`) });
