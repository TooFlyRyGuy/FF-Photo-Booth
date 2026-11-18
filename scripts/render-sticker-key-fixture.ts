/**
 * Draws a synthetic green-screen sticker, keys it, and writes:
 *   sticker-key-source.png        the plate the model is asked for
 *   sticker-key-alpha.png         the cutout (real alpha; viewers may show black)
 *   sticker-key-checkerboard.png  the same cutout composited on a checkerboard
 *
 * Run: node --experimental-strip-types scripts/render-sticker-key-fixture.ts
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { keyChromaGreen } from '../lib/stickerKey.ts';

const WIDTH = 180;
const HEIGHT = 220;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(rgba: Uint8ClampedArray, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function insideEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function paintPlate(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // Mostly pure green, with the small errors a model tends to leave.
      const wobble = (x * 3 + y * 5) % 17 === 0;
      setPixel(rgba, x, y, wobble ? 12 : 0, wobble ? 244 : 255, wobble ? 8 : 0);
    }
  }

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const outline = insideEllipse(x, y, 90, 112, 62, 78);
      const fill = insideEllipse(x, y, 90, 112, 54, 70);
      if (outline && !fill) setPixel(rgba, x, y, 255, 255, 255);
      if (!fill) continue;

      const hair = y < 96 && insideEllipse(x, y, 90, 78, 50, 36);
      if (hair) {
        setPixel(rgba, x, y, 45, 32, 28);
        continue;
      }
      setPixel(rgba, x, y, 214, 164, 138);
      if (insideEllipse(x, y, 72, 112, 7, 8)) setPixel(rgba, x, y, 40, 28, 24);
      if (insideEllipse(x, y, 108, 112, 7, 8)) setPixel(rgba, x, y, 40, 28, 24);
      if (insideEllipse(x, y, 90, 132, 8, 5)) setPixel(rgba, x, y, 186, 92, 96);
    }
  }

  // A green fringe on the outline, which despill should knock back.
  for (let y = 40; y < 190; y++) {
    setPixel(rgba, 36, y, 30, 230, 28);
  }
  return rgba;
}

function compositeOnCheckerboard(keyed: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(keyed.length);
  const cell = 12;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const light = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const board = light ? 255 : 180;
      const a = keyed[i + 3] / 255;
      out[i] = Math.round(keyed[i] * a + board * (1 - a));
      out[i + 1] = Math.round(keyed[i + 1] * a + board * (1 - a));
      out[i + 2] = Math.round(keyed[i + 2] * a + board * (1 - a));
      out[i + 3] = 255;
    }
  }
  return out;
}

const outDir = process.argv[2] || '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const source = paintPlate();
const keyed = keyChromaGreen(source, WIDTH, HEIGHT);
const checker = compositeOnCheckerboard(keyed);

writeFileSync(`${outDir}/sticker-key-source.png`, encodePng(WIDTH, HEIGHT, source));
writeFileSync(`${outDir}/sticker-key-alpha.png`, encodePng(WIDTH, HEIGHT, keyed));
writeFileSync(`${outDir}/sticker-key-checkerboard.png`, encodePng(WIDTH, HEIGHT, checker));

let transparent = 0;
let opaque = 0;
for (let i = 3; i < keyed.length; i += 4) {
  if (keyed[i] === 0) transparent++;
  else if (keyed[i] === 255) opaque++;
}
console.log(`wrote fixtures to ${outDir}`);
console.log(`transparent pixels: ${transparent}, fully opaque pixels: ${opaque}`);
