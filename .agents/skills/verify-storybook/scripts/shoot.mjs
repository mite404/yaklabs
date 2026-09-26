#!/usr/bin/env node
// Render stories in Chromium and save proof: a screenshot, the ARIA tree, and any errors.
//
//   node .agents/skills/verify-storybook/scripts/shoot.mjs <story-id>... [--out dir] [--width px]
//
// Exits 1 when a story throws, logs a console error, or renders nothing, so a PASS line
// means the story actually drew something.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const STATE_DIR = process.env.VERIFY_STATE_DIR ?? `/tmp/yaklabs-storybook-verify-${process.env.VERIFY_RUN_ID ?? "default"}`;

function readPort() {
  try {
    return readFileSync(path.join(STATE_DIR, "port"), "utf8").trim();
  } catch {
    return process.env.VERIFY_PORT ?? "6106";
  }
}

function parseArgs(argv) {
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const args = { ids: [], out: path.join(ROOT, ".artifacts/verify-storybook", stamp), width: 1280 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else if (argv[i] === "--width") args.width = Number(argv[++i]);
    else args.ids.push(argv[i]);
  }
  return args;
}

async function shoot(page, base, id, out) {
  const errors = [];
  const onConsole = (msg) => msg.type() === "error" && errors.push(`console: ${msg.text()}`);
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`);
  const root = page.locator("#storybook-root");
  await root.waitFor({ state: "attached" });
  // Storybook shows its error overlay instead of throwing, so look for it explicitly.
  await page.waitForFunction(
    () =>
      document.body.classList.contains("sb-show-errordisplay") ||
      document.querySelector("#storybook-root")?.childElementCount > 0,
    null,
    { timeout: 15_000 },
  ).catch(() => errors.push("story never rendered"));
  if (await page.evaluate(() => document.body.classList.contains("sb-show-errordisplay")))
    errors.push(`storybook error: ${(await page.locator("#error-message").innerText()).trim()}`);

  const png = path.join(out, `${id}.png`);
  const aria = path.join(out, `${id}.aria.yml`);
  // Reveal animations fade cards in; capture the settled frame, in the real fonts.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: png, fullPage: true, animations: "disabled" });
  writeFileSync(aria, await root.ariaSnapshot());

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return { id, errors, png, aria };
}

const args = parseArgs(process.argv.slice(2));
if (args.ids.length === 0) {
  console.error("usage: shoot.mjs <story-id>... [--out dir] [--width px]");
  process.exit(2);
}
mkdirSync(args.out, { recursive: true });

const base = `http://127.0.0.1:${readPort()}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: args.width, height: 900 } });
const results = [];
for (const id of args.ids) results.push(await shoot(page, base, id, args.out));
await browser.close();

for (const r of results) {
  console.log(`${r.errors.length ? "FAIL" : "PASS"} ${r.id}`);
  for (const e of r.errors) console.log(`  ${e}`);
  console.log(`  ${path.relative(ROOT, r.png)}`);
  console.log(`  ${path.relative(ROOT, r.aria)}`);
}
process.exit(results.some((r) => r.errors.length) ? 1 : 0);
