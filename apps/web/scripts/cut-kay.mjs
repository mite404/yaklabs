#!/usr/bin/env node
// Cuts Kay's face out of Ethan's mock (docs/reference/shell-polish/crops/9-mascot.png) into the
// placeholder the account avatar uses until the source file arrives (Q11): a transparent WebP
// at 2x. The mascot himself left the canvas (ADR-135). The ground is flood-filled from the crop's edges over
// pale, grey pixels, so Kay's own whites (the eyes) stay.
//
//   node apps/web/scripts/cut-kay.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT } from "./harness.mjs";

const SOURCE = path.join(ROOT, "docs/reference/shell-polish/crops/9-mascot.png");
const OUT = path.join(ROOT, "apps/web/public/kay");
// The face shows 32px in the avatar, at 2x.
const FACE_SIZE = 64;

// Runs in the page: the cut, the crop and the two encodes, returned as base64 WebP.
async function cut({ png, faceSize }) {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const { width, height } = img;
  const source = new OffscreenCanvas(width, height);
  const context = source.getContext("2d");
  context.drawImage(img, 0, 0);
  const frame = context.getImageData(0, 0, width, height);
  const { data } = frame;
  // Ground: bright and nearly grey, which the paper, the dots, the dashed outline and the desk
  // all are; Kay's fur and horns carry colour.
  const isGround = (i) => {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    return Math.max(r, g, b) - Math.min(r, g, b) < 22 && 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  };
  const ground = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const at = stack.pop();
    if (ground[at] === 1 || !isGround(at * 4)) continue;
    ground[at] = 1;
    const x = at % width;
    if (x > 0) stack.push(at - 1);
    if (x < width - 1) stack.push(at + 1);
    if (at >= width) stack.push(at - width);
    if (at < width * (height - 1)) stack.push(at + width);
  }
  // Kay is what joins the crop's centre without crossing the ground; a speck of the window's
  // corner shadow elsewhere in the crop is not Kay.
  const kay = new Uint8Array(width * height);
  const seed = Math.floor(height / 2) * width + Math.floor(width / 2);
  stack.push(seed);
  while (stack.length > 0) {
    const at = stack.pop();
    if (kay[at] === 1 || ground[at] === 1) continue;
    kay[at] = 1;
    const x = at % width;
    if (x > 0) stack.push(at - 1);
    if (x < width - 1) stack.push(at + 1);
    if (at >= width) stack.push(at - width);
    if (at < width * (height - 1)) stack.push(at + width);
  }
  for (let at = 0; at < width * height; at += 1) if (kay[at] === 0) ground[at] = 1;
  // A pixel of Kay beside the ground is half-covered: it keeps half its alpha, so the edge
  // is soft rather than stepped.
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let at = 0; at < width * height; at += 1) {
    if (ground[at] === 1) {
      data[at * 4 + 3] = 0;
      continue;
    }
    const x = at % width;
    const y = Math.floor(at / width);
    const edge = [at - 1, at + 1, at - width, at + width].some((n) => ground[n] === 1);
    if (edge) data[at * 4 + 3] = 128;
    [left, top, right, bottom] = [
      Math.min(left, x),
      Math.min(top, y),
      Math.max(right, x),
      Math.max(bottom, y),
    ];
  }
  context.putImageData(frame, 0, 0);
  const encode = async (sx, sy, sw, sh, dw, dh) => {
    const canvas = new OffscreenCanvas(dw, dh);
    const out = canvas.getContext("2d");
    out.imageSmoothingQuality = "high";
    out.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  };
  const w = right - left + 1;
  const h = bottom - top + 1;
  // The face: a square on the head, horns to chin, centred on the nose.
  const faceSide = Math.round(w * 0.62);
  const faceX = Math.round(left + w / 2 - faceSide / 2);
  const faceY = top;
  return {
    face: await encode(faceX, faceY, faceSide, faceSide, faceSize, faceSize),
    box: { left, top, w, h },
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(cut, {
  png: readFileSync(SOURCE).toString("base64"),
  faceSize: FACE_SIZE,
});
await browser.close();
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "kay-face.webp"), Buffer.from(result.face, "base64"));
console.log(`kay-face.webp ${FACE_SIZE}px from a ${result.box.w}x${result.box.h} cut`);
