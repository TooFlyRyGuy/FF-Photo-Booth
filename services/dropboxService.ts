const DROPBOX_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-upload`;

interface UploadToDropboxParams {
  tenantId: string;
  eventId: string;
  eventName: string;
  imageBase64: string;
  imageType: 'original' | 'generated';
  promptName?: string;
}

interface DropboxUploadResponse {
  success: boolean;
  url?: string | null;
  path?: string;
  error?: string;
  warning?: string;
}

export const uploadImageToDropbox = async (params: UploadToDropboxParams): Promise<string> => {
  try {
    const response = await fetch(DROPBOX_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${errorText}`);
    }

    const result: DropboxUploadResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Upload failed without error message');
    }

    if (result.warning) {
      console.warn('Dropbox upload warning:', result.warning);
    }

    if (!result.url) {
      throw new Error('File uploaded to Dropbox but no public URL available. Sharing permission may be missing.');
    }

    return result.url;
  } catch (error) {
    console.error('Dropbox upload error:', error);
    throw error;
  }
};
