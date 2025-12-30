const DROPBOX_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-upload`;

interface UploadToDropboxParams {
  userId: string;
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

interface CreateFolderParams {
  userId: string;
  eventId: string;
  eventName: string;
}

interface DropboxFolderResponse {
  success: boolean;
  path?: string;
  error?: string;
}

export const createDropboxFolder = async (params: CreateFolderParams): Promise<string> => {
  try {
    const folderUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-upload`;

    const response = await fetch(folderUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        createFolderOnly: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dropbox folder creation failed:', errorText);
      throw new Error(`Folder creation failed: ${errorText}`);
    }

    const result: DropboxFolderResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Folder creation failed');
    }

    return result.path || '';
  } catch (error) {
    console.error('Dropbox folder creation error:', error);
    throw error;
  }
};

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
