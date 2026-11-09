/**
 * Sticker output is a chroma-key plate, not a model-drawn "transparent" image.
 * Gemini image models do not emit a real alpha channel. Asking them for a
 * transparent background makes them paint an opaque checkerboard. The booth
 * asks for flat #00FF00 instead, then removes that green here.
 *
 * The deployed gemini-generate-image function still appends a "transparent
 * background" sentence when the request sets stickerMode. Callers must not
 * send that flag. The key instructions live in the prompt text instead.
 */

export const STICKER_KEY_HEX = '#00FF00';

const TRANSPARENT_SIGNAL = 40;
const OPAQUE_SIGNAL = 130;

export function applyStickerPrompt(promptTemplate: string, stickerMode: boolean): string {
  if (!stickerMode) return promptTemplate;
  return wrapStickerKeyPrompt(promptTemplate);
}

export function wrapStickerKeyPrompt(promptTemplate: string): string {
  return [
    'STICKER KEY SCREEN: Render one die-cut vinyl sticker of the subject, cropped close, with a thin white sticker outline around the subject.',
    `The entire background must be one flat solid color: pure green ${STICKER_KEY_HEX}, exactly RGB(0, 255, 0).`,
    'Every background pixel must be that same flat green. No gradient, no shadow on the background, no floor, and no scene.',
    'Do not use a transparent background. Do not draw a checkerboard, grid, grey and white squares, or any fake transparency pattern.',
    'Do not use white, black, grey, or any color other than pure green behind the sticker.',
    'Do not add a frame, border, or photo overlay. The green is a chroma-key screen and will be removed.',
    '',
    `Subject and style: ${promptTemplate}`,
  ].join('\n');
}

export interface ChromaKeyOptions {
  despill?: number;
  soften?: boolean;
}

/**
 * Remove a pure-green screen from RGBA pixels.
 * Bright green (high G, low R and B) becomes transparent, with a smooth edge
 * and green despill so the cutout does not keep a green halo.
 * Returns a new buffer. The input is not modified.
 */
export function keyChromaGreen(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: ChromaKeyOptions = {}
): Uint8ClampedArray {
  const despill = options.despill ?? 0.9;
  const soften = options.soften ?? true;
  const out = new Uint8ClampedArray(rgba.length);

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const srcAlpha = rgba[i + 3];
    let alpha = stickerAlpha(r, g, b);

    let nextG = g;
    if (despill > 0 && g > r && g > b && alpha < 255) {
      const maxRB = Math.max(r, b);
      const edge = 1 - alpha / 255;
      nextG = Math.round(g + (maxRB - g) * Math.min(1, despill * Math.max(edge, 0.35)));
    }

    const outAlpha = Math.round((alpha * srcAlpha) / 255);
    // Fully removed screen pixels must not keep their green RGB. Edge
    // softening copies a little alpha onto them, and leftover green would
    // show up as a halo.
    if (outAlpha === 0) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    } else {
      out[i] = r;
      out[i + 1] = nextG;
      out[i + 2] = b;
    }
    out[i + 3] = outAlpha;
  }

  if (soften && width > 0 && height > 0) {
    softenAlpha(out, width, height);
  }

  return out;
}

export function stickerAlpha(r: number, g: number, b: number): number {
  const brightScreen = g >= 170 && r <= 110 && b <= 110 && g >= r + 60 && g >= b + 60;
  const signal = brightScreen
    ? Math.max(r, b) * 0.85 + (255 - g) * 0.55
    : Math.sqrt(r * r + (g - 255) * (g - 255) + b * b);

  if (signal <= TRANSPARENT_SIGNAL) return 0;
  if (signal >= OPAQUE_SIGNAL) return 255;
  const t = (signal - TRANSPARENT_SIGNAL) / (OPAQUE_SIGNAL - TRANSPARENT_SIGNAL);
  const smooth = t * t * (3 - 2 * t);
  return Math.round(smooth * 255);
}

function softenAlpha(rgba: Uint8ClampedArray, width: number, height: number): void {
  const alphas = new Uint8Array(width * height);
  for (let i = 0; i < alphas.length; i++) {
    alphas[i] = rgba[i * 4 + 3];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          sum += alphas[ny * width + nx];
          count++;
        }
      }
      rgba[(y * width + x) * 4 + 3] = Math.round(sum / count);
    }
  }
}

/** Same rule uploadGeneratedPhoto uses to choose the storage object type. */
export function storageSpecForDataUrl(dataUrl: string): { ext: 'png' | 'jpg'; contentType: 'image/png' | 'image/jpeg' } {
  const isPng = dataUrl.startsWith('data:image/png');
  return isPng
    ? { ext: 'png', contentType: 'image/png' }
    : { ext: 'jpg', contentType: 'image/jpeg' };
}

export function approximateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor(b64.length * 0.75);
}
