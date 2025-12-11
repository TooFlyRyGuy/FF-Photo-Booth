import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UploadRequest {
  tenantId: string;
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

    const { tenantId, eventId, eventName, imageBase64, imageType, promptName }: UploadRequest = await req.json();

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('dropbox_access_token, dropbox_refresh_token, dropbox_token_expires_at, dropbox_enabled, dropbox_app_key, dropbox_app_secret')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      throw new Error('Failed to fetch tenant');
    }

    if (!tenant.dropbox_enabled || !tenant.dropbox_access_token) {
      throw new Error('Dropbox is not configured for this tenant');
    }

    let accessToken = tenant.dropbox_access_token;

    if (tenant.dropbox_token_expires_at && tenant.dropbox_refresh_token) {
      const expiresAt = new Date(tenant.dropbox_token_expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        accessToken = await refreshAccessToken(
          supabase,
          tenantId,
          tenant.dropbox_app_key,
          tenant.dropbox_app_secret,
          tenant.dropbox_refresh_token
        );
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

    const uploadResult = await uploadResponse.json();

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
    if (sharedLinkResponse.ok) {
      const linkData = await sharedLinkResponse.json();
      sharedUrl = linkData.url.replace('?dl=0', '?raw=1');
    } else {
      const errorData = await sharedLinkResponse.json();
      if (errorData.error?.['.tag'] === 'shared_link_already_exists') {
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
          const linksData = await existingLinksResponse.json();
          if (linksData.links && linksData.links.length > 0) {
            sharedUrl = linksData.links[0].url.replace('?dl=0', '?raw=1');
          }
        }
      }
    }

    if (!sharedUrl) {
      sharedUrl = `https://www.dropbox.com/home${filePath}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: sharedUrl,
        path: uploadResult.path_display,
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
  tenantId: string,
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

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  await supabase
    .from('tenants')
    .update({
      dropbox_access_token: tokenData.access_token,
      dropbox_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', tenantId);

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
    const errorData = await response.json();
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
