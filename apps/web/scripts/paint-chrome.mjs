#!/usr/bin/env node
// Paints the title bar's oil-painting variant (ADR-110): misty green-grey ground with dark
// foliage at the top corners, after Ethan's mock (R10), made here from seeded noise so it is
// ours to ship and the same on every run. Every pixel is then held at or below a luminance that
// keeps cream text at 4.5:1 on it, so the painting can never fail the bar's contrast.
//
//   node apps/web/scripts/paint-chrome.mjs     # → apps/web/public/chrome/painting.webp
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "apps/web/public/chrome");
// 1440x44 CSS pixels at 2x; the bar is 44px tall (tasks.md A2).
const [WIDTH, HEIGHT, SCALE] = [1440, 44, 2];
// Cream (#f0efea, luminance 0.862) at 4.5:1 needs a ground at or below 0.1527; this leaves room
// for the WebP's own rounding.
const MAX_LUMINANCE = 0.13;

// Mist: low, stretched noise tinted between the bar's green and a lighter sage-grey.
// Foliage: finer noise, cut hard into leaf clumps and shown only near the top corners.
// Strokes: a horizontal grain that drags both, as a loaded brush does.
const PAINTING = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="ground" x1="0" x2="1">
      <stop offset="0" stop-color="#2f3a32"/>
      <stop offset=".45" stop-color="#465048"/>
      <stop offset=".7" stop-color="#4a5249"/>
      <stop offset="1" stop-color="#2c362e"/>
    </linearGradient>
    <filter id="mist" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.005 0.025" numOctaves="4" seed="11"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.64  0 0 0 0 0.6  0 0 0 0.8 -0.3"/>
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="leaves" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" seed="4"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0 0.2 0.9 1"/>
      </feComponentTransfer>
      <feColorMatrix type="matrix" values="0 0 0 0 0.09  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 1 0"/>
      <feGaussianBlur stdDeviation="0.6"/>
    </filter>
    <filter id="brush" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03 0.2" numOctaves="2" seed="23" result="grain"/>
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="canopy" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation="8 5"/>
    </filter>
    <mask id="corners">
      <g fill="#fff" filter="url(#canopy)">
        <ellipse cx="70" cy="2" rx="110" ry="22"/>
        <ellipse cx="200" cy="-6" rx="70" ry="16"/>
        <ellipse cx="1030" cy="0" rx="120" ry="24"/>
        <ellipse cx="1160" cy="4" rx="80" ry="20"/>
        <ellipse cx="1330" cy="-4" rx="130" ry="22"/>
      </g>
    </mask>
  </defs>
  <g filter="url(#brush)">
    <rect width="100%" height="100%" fill="url(#ground)"/>
    <rect width="100%" height="100%" filter="url(#mist)"/>
    <rect width="100%" height="100%" filter="url(#leaves)" mask="url(#corners)"/>
  </g>
</svg>`;

// Runs in the page: holds each pixel at or below the luminance, scaling its linear light so the
// hue stays, then encodes WebP and reports the mean colour and the brightest pixel left.
/* oxlint-disable unicorn/consistent-function-scoping -- finish is serialized into the page, so its
   helpers have to live inside it */
async function finish({ maxLuminance }) {
  const img = document.querySelector("img");
  await img.decode();
  const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = frame;
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const toByte = (l) =>
    Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));
  const sum = [0, 0, 0];
  let brightest = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lin = [toLinear(data[i]), toLinear(data[i + 1]), toLinear(data[i + 2])];
    const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    const k = luminance > maxLuminance ? maxLuminance / luminance : 1;
    for (let c = 0; c < 3; c += 1) {
      data[i + c] = Math.min(toByte(lin[c] * k), 255);
      sum[c] += data[i + c];
    }
    data[i + 3] = 255;
    const held = [0, 1, 2].map((c) => toLinear(data[i + c]));
    brightest = Math.max(brightest, 0.2126 * held[0] + 0.7152 * held[1] + 0.0722 * held[2]);
  }
  context.putImageData(frame, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  const pixels = data.length / 4;
  const mean = sum
    .map((c) =>
      Math.round(c / pixels)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return { webp: btoa(text), mean: `#${mean}`, brightest };
}
/* oxlint-enable unicorn/consistent-function-scoping */

const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);
const { chromium } = playwright.default ?? playwright;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: SCALE,
});
await page.setContent(`<body style="margin:0">${PAINTING}</body>`);
const png = await page.locator("svg").screenshot();
await page.setContent(`<img src="data:image/png;base64,${png.toString("base64")}">`);
const result = await page.evaluate(finish, { maxLuminance: MAX_LUMINANCE });
await browser.close();
mkdirSync(OUT, { recursive: true });
const webp = Buffer.from(result.webp, "base64");
writeFileSync(path.join(OUT, "painting.webp"), webp);
console.log(
  `painting.webp ${WIDTH * SCALE}x${HEIGHT * SCALE}, ${webp.length} bytes, mean ${result.mean}, brightest luminance ${result.brightest.toFixed(4)}`,
);
