import { supabase } from '../lib/supabase';

export interface UploadImageResult {
  url: string;
  path: string;
  error?: string;
}

export async function compressImage(blob: Blob, maxSize: number = 1024, quality: number = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export async function base64ToBlob(base64: string): Promise<Blob> {
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 string');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function uploadImageToStorage(
  imageData: Blob | string,
  folder: string = 'booth-captures',
  fileName?: string
): Promise<UploadImageResult> {
  try {
    let blob: Blob;

    if (typeof imageData === 'string') {
      blob = await base64ToBlob(imageData);
    } else {
      blob = imageData;
    }

    const compressedBlob = await compressImage(blob);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const finalFileName = fileName || `${folder}-${timestamp}-${randomStr}.jpg`;
    const filePath = `${folder}/${finalFileName}`;

    const { data, error } = await supabase.storage
      .from('temp-booth-images')
      .upload(filePath, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        url: '',
        path: '',
        error: error.message,
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('temp-booth-images')
      .getPublicUrl(data.path);

    return {
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function uploadGeneratedPhoto(
  base64Image: string,
  eventId: string,
  fileName?: string
): Promise<UploadImageResult> {
  try {
    const blob = await base64ToBlob(base64Image);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const finalFileName = fileName || `photo-${timestamp}-${randomStr}.jpg`;
    const filePath = `${eventId}/${finalFileName}`;

    const { data, error } = await supabase.storage
      .from('event-photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Event photo upload error:', error);
      return { url: '', path: '', error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('event-photos')
      .getPublicUrl(data.path);

    return { url: publicUrl, path: data.path };
  } catch (error) {
    console.error('Event photo upload error:', error);
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteImageFromStorage(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('temp-booth-images')
      .remove([path]);

    if (error) {
      console.error('Storage delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

export async function uploadImageWithRetry(
  imageData: Blob | string,
  folder: string = 'booth-captures',
  fileName?: string,
  maxRetries: number = 3
): Promise<UploadImageResult> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await uploadImageToStorage(imageData, folder, fileName);

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (attempt < maxRetries) {
      const delay = Math.min(250 * Math.pow(2, attempt - 1), 2000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    url: '',
    path: '',
    error: `Failed after ${maxRetries} attempts: ${lastError}`,
  };
}
