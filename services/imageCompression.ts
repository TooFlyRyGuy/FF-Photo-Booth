export async function compressBase64Image(
  base64: string,
  maxDimension: number = 400,
  quality: number = 0.6
): Promise<string> {
  if (!base64 || !base64.startsWith('data:image')) {
    return base64;
  }

  try {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            const ratio = maxDimension / Math.max(width, height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

          console.log(
            `Compressed image from ${img.width}x${img.height} to ${width}x${height}: ${base64.length} bytes -> ${compressedBase64.length} bytes (${Math.round((compressedBase64.length / base64.length) * 100)}%)`
          );

          resolve(compressedBase64);
        } catch (error) {
          console.error('Error during compression:', error);
          resolve(base64);
        }
      };

      img.onerror = () => {
        console.error('Failed to load image for compression');
        resolve(base64);
      };

      img.src = base64;
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    return base64;
  }
}
