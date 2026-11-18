import { AspectRatio } from '../types';
import { approximateDataUrlBytes, keyChromaGreen } from '../lib/stickerKey';

export const convertImageUrlToBase64 = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      resolve(base64);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${url}`));
    };

    img.src = url;
  });
};

export const getAspectRatioDimensions = (ratio: AspectRatio = 'square'): { width: number; height: number } => {
  const baseSize = 1024;
  switch (ratio) {
    case '3:4':
      return { width: 768, height: 1024 };
    case '4:3':
      return { width: 1024, height: 768 };
    case '9:16':
      return { width: 576, height: 1024 };
    case '16:9':
      return { width: 1024, height: 576 };
    case '2:3':
      return { width: 683, height: 1024 };
    case '3:2':
      return { width: 1024, height: 683 };
    case '4:5':
      return { width: 819, height: 1024 };
    case 'square':
    default:
      return { width: baseSize, height: baseSize };
  }
};

export const resizeImageToAspectRatio = async (
  imageBase64: string,
  aspectRatio: AspectRatio = 'square',
  preserveTransparency: boolean = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetDimensions = getAspectRatioDimensions(aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = targetDimensions.width;
      canvas.height = targetDimensions.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const sourceAspect = img.width / img.height;
      const targetAspect = targetDimensions.width / targetDimensions.height;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      if (sourceAspect > targetAspect) {
        sourceWidth = img.height * targetAspect;
        sourceX = (img.width - sourceWidth) / 2;
      } else if (sourceAspect < targetAspect) {
        sourceHeight = img.width / targetAspect;
        sourceY = (img.height - sourceHeight) / 2;
      }

      if (!preserveTransparency) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetDimensions.width,
        targetDimensions.height
      );

      const outputFormat = preserveTransparency ? 'image/png' : 'image/jpeg';
      const quality = preserveTransparency ? 1.0 : 0.95;
      const resizedBase64 = canvas.toDataURL(outputFormat, quality);
      resolve(resizedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = imageBase64;
  });
};

export const applyOverlayToImage = async (
  baseImageBase64: string,
  overlayImageUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    const overlayImg = new Image();

    let baseLoaded = false;
    let overlayLoaded = false;

    const checkBothLoaded = () => {
      if (baseLoaded && overlayLoaded) {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(baseImg, 0, 0);
        ctx.drawImage(overlayImg, 0, 0, baseImg.width, baseImg.height);

        const compositedBase64 = canvas.toDataURL('image/png', 1.0);
        resolve(compositedBase64);
      }
    };

    baseImg.onload = () => {
      baseLoaded = true;
      checkBothLoaded();
    };

    baseImg.onerror = () => {
      reject(new Error('Failed to load base image for overlay'));
    };

    overlayImg.onload = () => {
      overlayLoaded = true;
      checkBothLoaded();
    };

    overlayImg.onerror = () => {
      reject(new Error('Failed to load overlay image'));
    };

    overlayImg.crossOrigin = 'anonymous';
    baseImg.src = baseImageBase64;
    overlayImg.src = overlayImageUrl;
  });
};

/**
 * Remove the flat green sticker screen and return a PNG data URL with alpha.
 * JPEG input is opaque; the alpha is created here, not by the model.
 */
export const keyOutStickerBackground = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const keyed = keyChromaGreen(imageData.data, canvas.width, canvas.height);
      imageData.data.set(keyed);
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      reject(new Error('Failed to load sticker for background removal'));
    };
    img.src = imageUrl;
  });
};

/** Scale a PNG data URL down until it fits the event-photos bucket. Alpha is kept. */
export const limitPngDataUrl = async (dataUrl: string, maxBytes: number = 8_000_000): Promise<string> => {
  if (!dataUrl.startsWith('data:image/png')) return dataUrl;
  if (approximateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

  const img = await loadImage(dataUrl);
  let width = img.width;
  let height = img.height;
  let current = dataUrl;

  while (approximateDataUrlBytes(current) > maxBytes && Math.max(width, height) > 512) {
    width = Math.max(512, Math.floor(width * 0.75));
    height = Math.max(1, Math.floor(height * 0.75));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return current;
    ctx.drawImage(img, 0, 0, width, height);
    current = canvas.toDataURL('image/png');
  }

  return current;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
};
