import { AspectRatio } from '../types';

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
    case 'square':
    default:
      return { width: baseSize, height: baseSize };
  }
};

export const resizeImageToAspectRatio = async (
  imageBase64: string,
  aspectRatio: AspectRatio = 'square'
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

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

      const resizedBase64 = canvas.toDataURL('image/jpeg', 0.95);
      resolve(resizedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = imageBase64;
  });
};
