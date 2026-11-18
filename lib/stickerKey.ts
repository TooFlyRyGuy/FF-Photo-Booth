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

export interface BoothImageRequestInput {
  imageUrlOrBase64: string;
  promptTemplate: string;
  referenceImageUrlOrBase64?: string;
  aspectRatio?: string;
  modelName?: string;
  resolution?: '1K' | '2K' | '4K';
  referenceImages?: Array<{ url: string; strength?: number }>;
  eventId?: string;
  stickerMode?: boolean;
}

/**
 * Body sent to gemini-generate-image.
 * The stickerMode flag is intentionally omitted. The deployed function appends
 * a "transparent background" sentence when that flag is set, and the model
 * paints a checkerboard. The key-screen line is appended after the theme
 * inside promptTemplate instead.
 */
export function buildBoothImageRequest(input: BoothImageRequestInput): Record<string, unknown> {
  const {
    imageUrlOrBase64,
    promptTemplate,
    referenceImageUrlOrBase64,
    aspectRatio,
    modelName,
    resolution,
    referenceImages,
    eventId,
    stickerMode,
  } = input;

  const isImageUrl = imageUrlOrBase64.startsWith('http://') || imageUrlOrBase64.startsWith('https://');
  const isReferenceUrl = referenceImageUrlOrBase64?.startsWith('http://') || referenceImageUrlOrBase64?.startsWith('https://');

  const body: Record<string, unknown> = {
    promptTemplate: applyStickerPrompt(promptTemplate, !!stickerMode),
    aspectRatio,
    resolution,
  };

  if (modelName) {
    body.modelName = modelName;
  }
  if (eventId) {
    body.eventId = eventId;
  }

  if (isImageUrl) {
    body.imageUrl = imageUrlOrBase64;
  } else {
    body.imageBase64 = imageUrlOrBase64;
  }

  if (referenceImages && referenceImages.length > 0) {
    body.referenceImages = referenceImages.map(ref => ({
      url: ref.url,
      strength: ref.strength,
    }));
  } else if (referenceImageUrlOrBase64) {
    if (isReferenceUrl) {
      body.referenceImageUrl = referenceImageUrlOrBase64;
    } else {
      body.referenceImageBase64 = referenceImageUrlOrBase64;
    }
  }

  return body;
}

export function wrapStickerKeyPrompt(promptTemplate: string): string {
  const theme = promptTemplate.trimEnd();
  return [
    theme,
    '',
    'STICKER KEY SCREEN, applied after the style above: Keep the wardrobe, hair, pose, props, and theme from that style text. Do not leave the guest in their original clothes, and do not replace the style with a generic portrait.',
    `Change only the background, to one flat solid color: pure green ${STICKER_KEY_HEX}, exactly RGB(0, 255, 0).`,
    'Every background pixel must be that same flat green. No gradient, no shadow on the background, no floor, and no extra scene behind the styled subject.',
    'Do not use a transparent background. Do not draw a checkerboard, grid, grey and white squares, or any fake transparency pattern.',
    'Add a thin white die-cut outline around the styled subject. Do not add a frame or photo overlay. The green is a chroma-key screen and will be removed.',
  ].join('\n');
}

export interface ChromaKeyOptions {
  despill?: number;
  soften?: boolean;
  /** Pixels to eat off the matte so a green rim does not survive. */
  choke?: number;
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
  const despill = options.despill ?? 1;
  const soften = options.soften ?? true;
  const choke = options.choke ?? 1;
  const out = new Uint8ClampedArray(rgba.length);
  const rawAlpha = new Uint8Array(width * height);

  for (let p = 0; p < rawAlpha.length; p++) {
    const i = p * 4;
    rawAlpha[p] = stickerAlpha(rgba[i], rgba[i + 1], rgba[i + 2]);
  }

  const choked = choke > 0 ? chokeAlpha(rawAlpha, width, height, choke) : rawAlpha;
  const edge = nearLowAlpha(choked, width, height, 2);

  for (let p = 0; p < rawAlpha.length; p++) {
    const i = p * 4;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const srcAlpha = rgba[i + 3];
    const alpha = choked[p];

    let nextG = g;
    if (despill > 0 && g > r && g > b && (alpha < 255 || edge[p] === 1)) {
      const maxRB = Math.max(r, b);
      nextG = Math.round(maxRB + (g - maxRB) * (1 - despill));
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

function chokeAlpha(alphas: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(alphas.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minA = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const sample = alphas[ny * width + nx];
          if (sample < minA) minA = sample;
        }
      }
      out[y * width + x] = minA;
    }
  }
  return out;
}

function nearLowAlpha(alphas: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const marks = new Uint8Array(alphas.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphas[y * width + x] >= 250) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          marks[ny * width + nx] = 1;
        }
      }
    }
  }
  return marks;
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
