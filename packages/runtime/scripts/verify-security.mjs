import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const origin = process.argv[2];
assert(origin, "Pass the URL of the built app served by Wrangler");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.cspViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI });
    });
  });
  for (const route of ["/", "/t/playground"]) {
    const response = await page.goto(new URL(route, origin).href);
    assert.equal(response.status(), 200);
    const headers = response.headers();
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(headers["permissions-policy"], "camera=(), geolocation=(), microphone=(self)");
    const policy = headers["content-security-policy"];
    const scriptPolicy = policy.split(";").find((part) => part.trim().startsWith("script-src "));
    assert(scriptPolicy.includes("'wasm-unsafe-eval'"));
    assert(!scriptPolicy.includes("'unsafe-eval'"));
    assert(!scriptPolicy.includes("'unsafe-inline'"));
    for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
      assert(policy.includes(directive));
    }
    const html = await response.text();
    const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
    );
    assert(hashes.length > 0);
    for (const hash of hashes) assert(scriptPolicy.includes(hash), `Unpinned inline script ${hash}`);
    await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.cspViolations), [], `${route} CSP violations`);
    assert.deepEqual(errors, [], `${route} page errors`);
    console.log(`${route}: security headers, ${hashes.length} inline hashes, hydration and CSP passed`);
  }
} finally {
  await browser.close();
}
