import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, chromium, ROOT } from "./harness.mjs";

const base = arg("--base", "http://127.0.0.1:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/weekly-brief"));
const browser = await chromium.launch();
const results = [];
mkdirSync(out, { recursive: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${base}/demo/weekly-brief`);
  const start = page.getByRole("button", { name: "Start brief", exact: true });
  await start.waitFor({ timeout: 20_000 });
  assert.equal(await start.count(), 1, "the isolated demo route offers Start brief");
  assert.equal(await page.getByRole("main").count(), 1, "the reading panel has a main landmark");
  const frame = await page.locator(".wb-main").evaluate((element) => ({
    height: element.clientHeight,
    bottom: element.getBoundingClientRect().bottom,
    footerTop: document.querySelector(".wb-footer").getBoundingClientRect().top,
  }));
  assert.ok(
    frame.height > 600 && frame.bottom <= frame.footerTop,
    "main fills its track without overlapping controls",
  );
  const began = Date.now();
  await start.click();
  await page.locator(".agent-tree").first().waitFor();
  await page.screenshot({ path: path.join(out, "working.png") });
  const workloadWorking = page.getByLabel("Weekly workload is working", { exact: true });
  await workloadWorking.waitFor({ timeout: 10_000 });
  await workloadWorking.waitFor({ state: "hidden", timeout: 10_000 });
  assert.equal(
    await page.getByLabel("Open issues is working", { exact: true }).isVisible(),
    true,
    "one check finishes while its sibling keeps working",
  );
  await page.locator('[data-turn-id="finding"] strong').first().waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedText = await page.locator('[data-turn-id="finding"]').innerText();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator('[data-turn-id="finding"]').innerText(),
    pausedText,
    "pause freezes the revealed reply",
  );
  const streamingTypography = await page
    .locator('[data-turn-id="finding"] p')
    .first()
    .evaluate((element) => ({
      size: getComputedStyle(element).fontSize,
      leading: getComputedStyle(element).lineHeight,
      weight: getComputedStyle(element.querySelector("strong")).fontWeight,
    }));
  assert.deepEqual(streamingTypography, { size: "15px", leading: "24px", weight: "600" });
  await page.screenshot({ path: path.join(out, "streaming.png") });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("radio", { name: /Billing first/u }).waitFor({ timeout: 60_000 });
  assert.equal(await page.getByRole("button", { name: "Submit", exact: true }).isEnabled(), false);
  assert.equal(
    await page.locator(".agent-tree").count(),
    0,
    "waiting for a decision is not working",
  );
  assert.equal(await page.getByText(/draft is ready/iu).count(), 0, "no draft before the decision");
  await page.screenshot({ path: path.join(out, "decision.png") });
  const readingSpace = await page.locator(".wb-scroll").evaluate((element) => element.clientHeight);
  assert.ok(readingSpace > 600, `the decision does not steal reading space (${readingSpace}px)`);
  assert.equal(await page.locator(".wb-footer [role=radio]").count(), 0);
  await page.getByRole("button", { name: "Work details", exact: true }).click();
  const logs = page.getByRole("button", { name: "Technical details", exact: true });
  await logs.waitFor();
  assert.equal(await logs.getAttribute("aria-expanded"), "false");
  await page
    .getByText("Backlog fell from 46 cases Monday to 18 by Friday.", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, "evidence.png") });
  await logs.click();
  assert.ok(await page.locator("pre code").count(), "technical evidence is available on request");
  assert.equal(
    await page.getByText("Selecting the support records.", { exact: true }).count(),
    1,
    "superseded narration is retained only in details",
  );
  await logs.click();
  await page.getByRole("button", { name: "Work details", exact: true }).click();
  await page.getByRole("radio", { name: /Billing first/u }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByText("Your draft is ready.", { exact: true }).waitFor({ timeout: 30_000 });
  const duration = Date.now() - began;
  assert.ok(duration < 180_000, `guided run completes within three minutes (${duration}ms)`);
  assert.equal(await page.locator(".agent-tree").count(), 0);
  assert.ok(await page.locator(".quiet-prose strong").count(), "emphasis has semantic markup");
  assert.ok(await page.locator(".quiet-prose em").count(), "italics have semantic markup");
  const typography = await page
    .locator(".quiet-prose p")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { size: style.fontSize, leading: style.lineHeight };
    });
  assert.deepEqual(typography, { size: "15px", leading: "24px" });
  assert.equal(
    await page
      .locator(".quiet-prose em")
      .first()
      .evaluate((element) => getComputedStyle(element).fontStyle),
    "italic",
  );
  assert.ok(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (face) =>
          face.family.includes("Inter") && face.style === "italic" && face.status === "loaded",
      ),
    ),
    "real Inter italic face is loaded",
  );
  assert.deepEqual(await page.locator('[data-turn-id="draft"] li').allTextContents(), [
    "Billing: 12 open. Median age: 2 days.",
    "Product: 4 open. Median age: 6 days.",
    "Access: 2 open. Median age: 9 days.",
  ]);
  assert.equal(await page.evaluate(() => window.scrollY), 0, "only the transcript scrolls");
  await page.screenshot({ path: path.join(out, "complete.png") });
  results.push({ check: "guided run, consent, disclosures, typography", duration, typography });

  await page.getByRole("button", { name: "Preview return recap", exact: true }).click();
  assert.ok(
    await page.locator(".wb-scroll").evaluate((element) => element.clientHeight > 400),
    "recap leaves room to read the transcript",
  );
  await page.screenshot({ path: path.join(out, "recap.png") });
  await page.getByRole("button", { name: "Preview return recap", exact: true }).click();

  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await start.waitFor();
  assert.equal(await page.getByText("Your draft is ready.", { exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await start.click();
  await page.locator(".wb-narration .agent-tree").waitFor();
  assert.equal(
    await page
      .locator(".wb-narration .agent-tree-pill")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
    "none",
    "AgentTree is static under reduced motion",
  );
  await page.getByRole("radio", { name: /Billing first/u }).waitFor({ timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, "narrow viewport has no page overflow");
  await page.screenshot({ path: path.join(out, "narrow.png") });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByText(/No draft was prepared/iu).waitFor();
  assert.equal(await page.locator(".agent-tree").count(), 0);
  results.push({ check: "replay, narrow viewport, reduced motion, decline", ok: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scenario of ["reply-fails", "reply-interrupted", "missing-issues"]) {
    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await page.getByLabel("Demo scenario").selectOption(scenario);
    await start.click();
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await retry.waitFor({ timeout: 25_000 });
    assert.equal(await page.locator(".agent-tree").count(), 0, "failure ends busy indicators");
    assert.equal(await page.locator('[data-turn-id="ask"]').count(), 1, "question is preserved");
    assert.equal(
      await page.locator('[aria-busy="true"]').count(),
      0,
      "interruption is not streaming",
    );
    if (scenario === "reply-interrupted") {
      assert.equal(
        await page.locator('[data-turn-id="finding"] .quiet-prose').innerText(),
        "The backlog fell from 46 cases Monday to 18 by Friday, and 12 of those 18",
      );
    }
    if (scenario === "missing-issues") {
      await page.getByRole("button", { name: "Work details", exact: true }).click();
      assert.equal(
        await page.getByText("Backlog, Monday to Friday", { exact: true }).count(),
        1,
        "successful check still has its evidence",
      );
      assert.equal(
        await page.getByText("This check failed. No result is available.", { exact: true }).count(),
        1,
      );
      assert.equal(
        await page.getByText("What's still open Friday, by category", { exact: true }).count(),
        0,
      );
    }
    await page.screenshot({ path: path.join(out, `${scenario}.png`) });
    if (scenario === "reply-interrupted") {
      await retry.click();
      await page.getByRole("radio", { name: /Billing first/u }).waitFor({ timeout: 25_000 });
      assert.equal(
        await page.getByText("Earlier attempt · interrupted", { exact: true }).count(),
        1,
      );
      assert.equal(
        await page.locator('[data-turn-id="ask"]').count(),
        1,
        "retry never duplicates the question",
      );
    }
  }
  results.push({
    check: "failure before text, retained interrupted text, retry, partial evidence",
    ok: true,
  });
  assert.deepEqual(errors, []);
  console.log("PASS weekly brief", JSON.stringify(results));
} finally {
  writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
