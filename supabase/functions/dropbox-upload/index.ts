import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UploadRequest {
  userId: string;
  eventId: string;
  eventName: string;
  imageBase64: string;
  imageType: 'original' | 'generated';
  promptName?: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, eventId, eventName, imageBase64, imageType, promptName }: UploadRequest = await req.json();

    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('dropbox_access_token, dropbox_refresh_token, dropbox_token_expires_at, dropbox_enabled, dropbox_app_key, dropbox_app_secret')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError || !userSettings) {
      throw new Error('Failed to fetch user settings');
    }

    if (!userSettings.dropbox_enabled || !userSettings.dropbox_access_token) {
      throw new Error('Dropbox is not configured for this user');
    }

    let accessToken = userSettings.dropbox_access_token;

    if (userSettings.dropbox_refresh_token && userSettings.dropbox_app_key && userSettings.dropbox_app_secret) {
      const shouldRefresh = !userSettings.dropbox_token_expires_at ||
        new Date(userSettings.dropbox_token_expires_at) <= new Date(Date.now() + 5 * 60 * 1000);

      if (shouldRefresh) {
        try {
          accessToken = await refreshAccessToken(
            supabase,
            userId,
            userSettings.dropbox_app_key,
            userSettings.dropbox_app_secret,
            userSettings.dropbox_refresh_token
          );
        } catch (error) {
          console.error('Token refresh failed, will attempt with existing token:', error);
        }
      }
    }

    const folderPath = `/events/${eventName.replace(/[^a-zA-Z0-9-_]/g, '_')}_${eventId.slice(0, 8)}`;
    await ensureFolderExists(accessToken, folderPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = promptName ? `_${promptName.replace(/[^a-zA-Z0-9-_]/g, '_')}` : '';
    const fileName = `${imageType}_${timestamp}${suffix}.jpg`;
    const filePath = `${folderPath}/${fileName}`;

    const imageBuffer = base64ToArrayBuffer(imageBase64.replace(/^data:image\/\w+;base64,/, ''));

    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: filePath,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Dropbox upload failed: ${errorText}`);
    }

    const uploadResultText = await uploadResponse.text();
    let uploadResult;
    try {
      uploadResult = JSON.parse(uploadResultText);
    } catch (e) {
      throw new Error(`Failed to parse Dropbox upload response: ${uploadResultText.substring(0, 200)}`);
    }

    const sharedLinkResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: uploadResult.path_lower,
        settings: {
          requested_visibility: 'public',
        },
      }),
    });

    let sharedUrl = '';
    let sharingWarning = '';

    if (sharedLinkResponse.ok) {
      const linkText = await sharedLinkResponse.text();
      try {
        const linkData = JSON.parse(linkText);
        sharedUrl = linkData.url.replace('?dl=0', '?raw=1');
      } catch (e) {
        console.warn('Failed to parse shared link response:', linkText.substring(0, 200));
        sharingWarning = 'Could not parse shared link response';
      }
    } else {
      const errorText = await sharedLinkResponse.text();
      try {
        const errorData = JSON.parse(errorText);

        if (errorData.error_summary?.includes('sharing.write')) {
          console.warn('Dropbox app missing sharing.write scope');
          sharingWarning = 'Shared links disabled - missing sharing.write scope in Dropbox app';
        } else if (errorData.error?.['.tag'] === 'shared_link_already_exists') {
          const existingLinksResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              path: uploadResult.path_lower,
              direct_only: true,
            }),
          });

          if (existingLinksResponse.ok) {
            const linksText = await existingLinksResponse.text();
            try {
              const linksData = JSON.parse(linksText);
              if (linksData.links && linksData.links.length > 0) {
                sharedUrl = linksData.links[0].url.replace('?dl=0', '?raw=1');
              }
            } catch (e) {
              console.warn('Failed to parse existing links response');
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse shared link error response:', errorText.substring(0, 300));
        sharingWarning = 'Could not create shared link';
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: sharedUrl || null,
        path: uploadResult.path_display,
        warning: sharingWarning || (!sharedUrl ? 'File uploaded but public sharing is not available. Please enable sharing.write permission in your Dropbox app settings.' : undefined),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Dropbox upload error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function refreshAccessToken(
  supabase: any,
  userId: string,
  appKey: string,
  appSecret: string,
  refreshToken: string
): Promise<string> {
  const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokenText = await tokenResponse.text();
  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch (e) {
    throw new Error(`Failed to parse token response: ${tokenText.substring(0, 200)}`);
  }
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const updateData: any = {
    dropbox_access_token: tokenData.access_token,
    dropbox_token_expires_at: expiresAt.toISOString(),
  };

  if (tokenData.refresh_token) {
    updateData.dropbox_refresh_token = tokenData.refresh_token;
  }

  await supabase
    .from('user_settings')
    .update(updateData)
    .eq('user_id', userId);

  return tokenData.access_token;
}

async function ensureFolderExists(accessToken: string, folderPath: string): Promise<void> {
  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: folderPath,
      autorename: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      throw new Error(`Failed to parse folder creation response: ${errorText.substring(0, 200)}`);
    }
    if (errorData.error?.['.tag'] !== 'path' || errorData.error?.path?.['.tag'] !== 'conflict') {
      throw new Error(`Failed to create folder: ${JSON.stringify(errorData)}`);
    }
  }
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
