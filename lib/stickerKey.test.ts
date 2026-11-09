import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  applyStickerPrompt,
  keyChromaGreen,
  stickerAlpha,
  storageSpecForDataUrl,
  wrapStickerKeyPrompt,
} from './stickerKey.ts';

const pixel = (rgba: Uint8ClampedArray, x: number, y: number, width: number) => {
  const i = (y * width + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
};

const fill = (width: number, height: number, color: [number, number, number, number]) => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = color[3];
  }
  return rgba;
};

test('photo prompts are not rewritten', () => {
  const prompt = 'Oil painting of the guest in a garden, keep the face.';
  assert.equal(applyStickerPrompt(prompt, false), prompt);
});

test('sticker wrapper asks for flat green and forbids a painted checkerboard', () => {
  const wrapped = wrapStickerKeyPrompt('a cartoon cat of the guest');
  assert.match(wrapped, /#00FF00/);
  assert.match(wrapped, /RGB\(0, 255, 0\)/);
  assert.match(wrapped, /Do not draw a checkerboard/);
  assert.match(wrapped, /Do not use a transparent background/);
  assert.doesNotMatch(wrapped, /alpha channel/);
  assert.doesNotMatch(wrapped, /MUST be a PNG with transparency/);
  assert.match(wrapped, /Subject and style: a cartoon cat of the guest/);
});

test('pure and near green key out; skin, white, and dark green stay', () => {
  assert.equal(stickerAlpha(0, 255, 0), 0);
  assert.equal(stickerAlpha(8, 248, 6), 0);
  assert.ok(stickerAlpha(40, 220, 40) < 80);
  assert.equal(stickerAlpha(220, 160, 140), 255);
  assert.equal(stickerAlpha(255, 255, 255), 255);
  assert.equal(stickerAlpha(0, 0, 0), 255);
  assert.equal(stickerAlpha(30, 120, 40), 255);
});

test('a green plate around a subject becomes transparent PNG pixels', () => {
  const width = 12;
  const height = 12;
  const rgba = fill(width, height, [0, 255, 0, 255]);
  for (let y = 3; y <= 8; y++) {
    for (let x = 3; x <= 8; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = 210;
      rgba[i + 1] = 150;
      rgba[i + 2] = 130;
      rgba[i + 3] = 255;
    }
  }
  // A slightly off-green screen pixel, the kind a model actually paints.
  rgba[0] = 10;
  rgba[1] = 246;
  rgba[2] = 8;

  const keyed = keyChromaGreen(rgba, width, height);
  assert.deepEqual(pixel(keyed, 0, 0, width)[3], 0);
  assert.equal(pixel(keyed, 11, 11, width)[3], 0);

  const center = pixel(keyed, 5, 5, width);
  assert.equal(center[3], 255);
  assert.equal(center[0], 210);
  assert.equal(center[1], 150);
  assert.equal(center[2], 130);

  const edge = pixel(keyed, 3, 5, width);
  assert.ok(edge[3] < 255, 'the subject edge is softened');
  assert.ok(edge[3] > 80, 'the subject edge is still visible');
});

test('softened edges do not revive a green halo', () => {
  const width = 4;
  const rgba = new Uint8ClampedArray([
    0, 255, 0, 255,
    0, 255, 0, 255,
    210, 150, 130, 255,
    210, 150, 130, 255,
  ]);
  const keyed = keyChromaGreen(rgba, width, 1);
  if (keyed[3] > 0) {
    assert.ok(keyed[1] <= keyed[0] + 15, `fringe stayed green ${keyed[0]},${keyed[1]},${keyed[2]} a=${keyed[3]}`);
  }
  assert.equal(keyed[2 * 4 + 3] > 0, true);
});

test('green fringe is despilled', () => {
  const rgba = new Uint8ClampedArray([40, 220, 40, 255]);
  const keyed = keyChromaGreen(rgba, 1, 1, { soften: false });
  assert.ok(keyed[3] < 80);
  assert.ok(keyed[1] < 120, `green channel ${keyed[1]} was not pulled down`);
});

test('png data urls are stored as image/png and everything else stays jpeg', () => {
  assert.deepEqual(storageSpecForDataUrl('data:image/png;base64,aaaa'), {
    ext: 'png',
    contentType: 'image/png',
  });
  assert.deepEqual(storageSpecForDataUrl('data:image/jpeg;base64,aaaa'), {
    ext: 'jpg',
    contentType: 'image/jpeg',
  });
});

test('the booth does not ask the shared Gemini function for a transparent background', () => {
  const gemini = readFileSync(new URL('../services/geminiService.ts', import.meta.url), 'utf8');
  assert.equal(gemini.includes('body.stickerMode'), false);
  assert.match(gemini, /applyStickerPrompt/);

  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  const keyAt = kiosk.indexOf('keyOutStickerBackground');
  const uploadAt = kiosk.indexOf('uploadGeneratedPhoto');
  assert.ok(keyAt > 0 && uploadAt > keyAt, 'keying runs before the storage upload');
  assert.match(kiosk, /overlayImageUrl && !isStickerMode/);
  assert.match(kiosk, /fileExtension: 'png'/);
  assert.match(kiosk, /toDataURL\('image\/png'\)|keyOutStickerBackground/);
});
