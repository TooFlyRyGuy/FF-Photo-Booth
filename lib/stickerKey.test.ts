import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  applyStickerPrompt,
  buildBoothImageRequest,
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

test('sticker wrapper keeps the theme first and adds the key screen after it', () => {
  const theme = "1980's aerobics instructor in a neon leotard and leg warmers";
  const wrapped = wrapStickerKeyPrompt(theme);
  assert.equal(wrapped.startsWith(theme), true);
  assert.ok(wrapped.indexOf('#00FF00') > theme.length);
  assert.match(wrapped, /RGB\(0, 255, 0\)/);
  assert.match(wrapped, /Do not draw a checkerboard/);
  assert.match(wrapped, /Do not use a transparent background/);
  assert.match(wrapped, /Do not leave the guest in their original clothes/);
  assert.doesNotMatch(wrapped, /alpha channel/);
  assert.doesNotMatch(wrapped, /MUST be a PNG with transparency/);
  assert.equal(wrapped.includes('Subject and style:'), false);
});

test('sticker request keeps the event prompt and reference images, and does not send stickerMode', () => {
  const theme = "1980's aerobics: neon leotard, leg warmers, sweatband, big hair. Guest name: Alex.";
  const referenceImages = [
    { url: 'https://cdn.example/aerobics-a.png', strength: 70 },
    { url: 'https://cdn.example/aerobics-b.png', strength: 40 },
  ];
  const shared = {
    imageUrlOrBase64: 'https://cdn.example/guest.jpg',
    promptTemplate: theme,
    referenceImages,
    aspectRatio: '3:4' as const,
    modelName: 'gemini-test',
    resolution: '2K' as const,
    eventId: 'event-1',
  };

  const photo = buildBoothImageRequest({ ...shared, stickerMode: false });
  const sticker = buildBoothImageRequest({ ...shared, stickerMode: true });

  assert.equal(photo.promptTemplate, theme);
  assert.equal('stickerMode' in photo, false);
  assert.equal('stickerMode' in sticker, false);

  assert.equal(String(sticker.promptTemplate).startsWith(theme), true);
  assert.ok(String(sticker.promptTemplate).indexOf('#00FF00') > theme.length);
  assert.deepEqual(sticker.referenceImages, referenceImages);
  assert.deepEqual(photo.referenceImages, sticker.referenceImages);
  assert.equal(sticker.imageUrl, photo.imageUrl);
  assert.equal(sticker.aspectRatio, photo.aspectRatio);
  assert.equal(sticker.modelName, photo.modelName);
  assert.equal(sticker.resolution, photo.resolution);
  assert.equal(sticker.eventId, photo.eventId);

  const legacy = buildBoothImageRequest({
    imageUrlOrBase64: 'https://cdn.example/guest.jpg',
    promptTemplate: theme,
    referenceImageUrlOrBase64: 'https://cdn.example/one-ref.png',
    stickerMode: true,
  });
  assert.equal(legacy.referenceImageUrl, 'https://cdn.example/one-ref.png');
  assert.equal(legacy.referenceImages, undefined);
  assert.equal(String(legacy.promptTemplate).startsWith(theme), true);
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

test('a light-green rim on the white outline is removed and interior color stays', () => {
  const width = 8;
  const height = 1;
  const rgba = new Uint8ClampedArray(width * 4);
  const paint = (x: number, r: number, g: number, b: number) => {
    rgba[x * 4] = r;
    rgba[x * 4 + 1] = g;
    rgba[x * 4 + 2] = b;
    rgba[x * 4 + 3] = 255;
  };
  paint(0, 0, 255, 0);
  paint(1, 0, 255, 0);
  paint(2, 190, 255, 185);
  paint(3, 255, 255, 255);
  paint(4, 255, 255, 255);
  paint(5, 30, 120, 40);
  paint(6, 30, 120, 40);
  paint(7, 30, 120, 40);

  const keyed = keyChromaGreen(rgba, width, height);
  assert.equal(keyed[0 * 4 + 3], 0);
  assert.equal(keyed[1 * 4 + 3], 0);
  const outer = pixel(keyed, 2, 0, width);
  assert.ok(outer[1] <= outer[0] + 8, `green rim survived ${outer.join(',')}`);
  assert.ok(Math.abs(outer[0] - outer[2]) <= 12, `rim is not neutral ${outer.join(',')}`);

  const rim = pixel(keyed, 3, 0, width);
  assert.ok(rim[1] <= rim[0] + 8, `rim still green ${rim.join(',')}`);
  const outline = pixel(keyed, 4, 0, width);
  assert.equal(outline[3], 255, 'the white outline stays');
  assert.deepEqual(outline.slice(0, 3), [255, 255, 255]);

  const interior = pixel(keyed, 7, 0, width);
  assert.equal(interior[3], 255);
  assert.equal(interior[0], 30);
  assert.equal(interior[1], 120);
  assert.equal(interior[2], 40);
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
  assert.match(gemini, /buildBoothImageRequest/);
  const request = readFileSync(new URL('./stickerKey.ts', import.meta.url), 'utf8');
  assert.match(request, /promptTemplate: applyStickerPrompt/);
  assert.equal(request.includes('stickerMode: true'), false);

  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  const keyAt = kiosk.indexOf('keyOutStickerBackground');
  const uploadAt = kiosk.indexOf('uploadGeneratedPhoto');
  assert.ok(keyAt > 0 && uploadAt > keyAt, 'keying runs before the storage upload');
  assert.match(kiosk, /overlayImageUrl && !isStickerMode/);
  assert.match(kiosk, /fileExtension: 'png'/);
  assert.match(kiosk, /toDataURL\('image\/png'\)|keyOutStickerBackground/);
});
