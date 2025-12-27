const SMUGMUG_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-api`;

export interface SmugMugGalleryResult {
  galleryId: string;
  galleryUrl: string;
}

export interface SmugMugUploadResult {
  imageUrl: string;
}

export async function createSmugMugGallery(
  galleryName: string,
  visibility: 'public' | 'private',
  anonKey: string
): Promise<SmugMugGalleryResult> {
  const response = await fetch(SMUGMUG_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      action: 'create_gallery',
      galleryName,
      visibility,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create SmugMug gallery');
  }

  return await response.json();
}

export async function uploadToSmugMug(
  galleryKey: string,
  imageData: string,
  fileName: string,
  anonKey: string
): Promise<SmugMugUploadResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(SMUGMUG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: 'upload_image',
        galleryKey,
        imageData,
        fileName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload to SmugMug');
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('SmugMug upload timeout after 3 seconds');
    }
    throw error;
  }
}
