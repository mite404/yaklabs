// The Share submenu's checks (ADR-131) on the real app, against the real gateway's routes: its
// Hono app runs in this process with a memory store, loaded through Vite, and every request the
// page makes to /api/shares is answered by it. The lab build has no sign-in, so the lever stands
// in for WorkOS at the network edge, adding a token the test verifier knows; the gateway itself
// is not loosened.
import { createRequire } from "node:module";
import path from "node:path";
import { ROOT } from "./harness.mjs";
import { BASE } from "./lever.mjs";
import { headerOf, openDemo } from "./thread-actions-checks.mjs";

const LEVER_TOKEN = "lever-stands-in-for-workos";
const DESKTOP = { width: 1440, height: 900 };
const GATEWAY = path.join(ROOT, "apps/gateway");

// A verifier that knows the lever's token alone, as a test's does.
const verifyToken = (token) =>
  token === LEVER_TOKEN
    ? Promise.resolve({ userId: "user_lever", sessionId: "session_lever" })
    : Promise.reject(new Error("unknown token"));

// The gateway's app on a memory store, loaded once through Vite, which reads its TypeScript.
let gateway;
async function gatewayApp() {
  if (gateway !== undefined) return gateway;
  const { createServer } = await import(
    createRequire(path.join(ROOT, "apps/web/package.json")).resolve("vite")
  );
  const vite = await createServer({
    root: GATEWAY,
    configFile: false,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  const { createApp } = await vite.ssrLoadModule("/src/app.ts");
  const { memoryShares, randomToken } = await vite.ssrLoadModule("/src/shares.ts");
  const shares = { store: memoryShares(Date.now), now: () => new Date(), newToken: randomToken };
  gateway = { app: createApp({ verifyToken, anthropic: {}, shares }), vite };
  return gateway;
}

/** Answers the page's /api/shares requests from the gateway app, signed in as the lever. */
export async function serveShares(context) {
  const { app } = await gatewayApp();
  await context.route(`${BASE}/api/shares**`, async (route) => {
    const request = route.request();
    const headers = { ...request.headers(), authorization: `Bearer ${LEVER_TOKEN}` };
    const body = request.postDataBuffer() ?? undefined;
    const response = await app.request(
      new URL(request.url()).pathname + new URL(request.url()).search,
      {
        method: request.method(),
        headers,
        body,
      },
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

// Opens the shown thread's Share submenu.
async function openShare(page) {
  await headerOf(page).getByRole("button", { name: "Thread actions" }).click();
  await page.getByRole("menuitem", { name: /^Share thread/ }).hover();
}

/** Share's checks, S1 to S3, each resolving to { ok, detail }. */
export const shareChecks = {
  // A thread made public for an hour: the link is copied, says until when, opens read-only on
  // the share page with its end beneath; Stop sharing ends it for anyone with the link.
  async S1(browser) {
    // A context of its own, so the reader's tab shares the gateway's stand-in.
    const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await serveShares(context);
    const page = await context.newPage();
    await page.goto(`${BASE}/?scenario=demo`);
    await headerOf(page).getByRole("button", { name: "Thread actions" }).waitFor();
    const title = await headerOf(page).locator("h2").innerText();
    await openShare(page);
    const privately = String(
      await page.getByRole("menuitem", { name: /^Share thread/ }).innerText(),
    );
    await page.getByRole("menuitem", { name: "1 hour" }).click();
    await page.getByText(/^Public until .* Link copied\.$/).waitFor();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    await openShare(page);
    const publicly = String(
      await page.getByRole("menuitem", { name: /^Share thread/ }).innerText(),
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    const reader = await context.newPage();
    await reader.goto(link);
    await reader.getByRole("heading", { name: title }).waitFor();
    const note = await reader.getByText(/^Shared from Kay until/).innerText();
    const noCompose = (await reader.getByRole("textbox").count()) === 0;

    await openShare(page);
    await page.getByRole("menuitem", { name: "Stop sharing" }).click();
    await page.getByText("The public page is down. Its link no longer works.").waitFor();
    await reader.reload();
    await reader.getByText("This shared thread has ended.").waitFor();
    const ok =
      /\/share\.html#t=[\w-]+\.[\w-]+$/.test(link) &&
      privately.includes("Private") &&
      /Until \w{3} \d+:\d{2}/.test(publicly) &&
      noCompose;
    return {
      ok,
      detail: `link ${link.replace(/\.[\w-]+$/, ".<key>")}; menu "${privately.replaceAll("\n", " ")}" then "${publicly.replaceAll("\n", " ")}"; page "${note}"; ended after Stop sharing`,
    };
  },

  // With no share server, as in the lab, Share says so and records nothing.
  async S2(browser) {
    const page = await openDemo(browser);
    await openShare(page);
    await page.getByRole("menuitem", { name: "1 day" }).click();
    await page.getByText("Sharing did not work").waitFor();
    const reason = (await page.getByText("This build has no share server").count()) > 0;
    await openShare(page);
    const still = String(await page.getByRole("menuitem", { name: /^Share thread/ }).innerText());
    return {
      ok: reason && still.includes("Private"),
      detail: `menu "${still.replaceAll("\n", " ")}"`,
    };
  },

  // A card's own public link, copied from a thread's address, opens the card on the site's
  // share page; a link relative to /t/... used to land on the thread route instead (ADR-064).
  async S3(browser) {
    const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    await page.goto(`${BASE}/?scenario=demo`);
    const panel = page.locator('[role="tabpanel"]:not([inert]) .thread-panel').first();
    await panel.locator(".compose-box textarea").waitFor();
    await panel.getByRole("button", { name: "Share this card" }).last().click();
    await page.getByRole("menuitem", { name: "Copy public link" }).click();
    await page.getByText("Link copied").waitFor();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const reader = await context.newPage();
    await reader.goto(link);
    await reader.locator(".share-page .card").first().waitFor();
    const ok =
      new URL(page.url()).pathname.startsWith("/t/") && new URL(link).pathname === "/share.html";
    return {
      ok,
      detail: `from ${new URL(page.url()).pathname}, link ${new URL(link).pathname}; the card shows`,
    };
  },
};
