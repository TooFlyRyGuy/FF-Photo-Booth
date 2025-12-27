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
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload to SmugMug');
  }

  return await response.json();
}
