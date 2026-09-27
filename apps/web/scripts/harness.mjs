// What every browser lever starts from: the repository's root, the Chromium that Storybook's
// Playwright install pins, and the command line's `--name value` flags.
import { createRequire } from "node:module";
import path from "node:path";

/** The repository's root. */
export const ROOT = path.resolve(import.meta.dirname, "../../..");

const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);

/** Playwright's Chromium. */
export const { chromium } = playwright.default ?? playwright;

const argv = process.argv.slice(2);

/** The value after `name` on the command line, or `fallback` when it is not there. */
export const arg = (name, fallback) =>
  argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
