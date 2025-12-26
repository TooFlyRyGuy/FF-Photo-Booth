import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const SMUGMUG_API_KEY = Deno.env.get('SMUGMUG_API_KEY')!;
const SMUGMUG_API_SECRET = Deno.env.get('SMUGMUG_API_SECRET')!;
const SMUGMUG_API_BASE = "https://api.smugmug.com/api/v2";
const SMUGMUG_UPLOAD_BASE = "https://upload.smugmug.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

async function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): Promise<string> {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams)
  ].join('&');

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBaseString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = new Uint8Array(signature);

  return btoa(String.fromCharCode(...signatureArray));
}

async function makeSmugMugRequest(
  method: string,
  endpoint: string,
  accessToken: string,
  accessTokenSecret: string,
  body?: any
): Promise<any> {
  const url = `${SMUGMUG_API_BASE}${endpoint}`;
  const nonce = generateNonce();
  const timestamp = generateTimestamp();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: SMUGMUG_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = await generateSignature(
    method,
    url,
    oauthParams,
    SMUGMUG_API_SECRET,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${key}="${oauthParams[key]}"`)
    .join(', ');

  const headers: HeadersInit = {
    'Authorization': authHeader,
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SmugMug API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function createGallery(
  accessToken: string,
  accessTokenSecret: string,
  galleryName: string,
  visibility: string
): Promise<{ galleryId: string; galleryUrl: string }> {
  const userData = await makeSmugMugRequest('GET', '!authuser', accessToken, accessTokenSecret);
  const userUri = userData.Response.User.Uris.Node.Uri;

  const privacyLevel = visibility === 'public' ? 'Public' : 'Unlisted';

  const galleryData = {
    Name: galleryName,
    UrlName: galleryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    Privacy: privacyLevel,
    SortMethod: 'Date Uploaded',
    SortDirection: 'Descending',
    Description: 'AI Photo Booth Gallery',
  };

  const response = await makeSmugMugRequest(
    'POST',
    `${userUri}!children`,
    accessToken,
    accessTokenSecret,
    galleryData
  );

  const gallery = response.Response.Album;
  const galleryKey = gallery.AlbumKey;
  const webUrl = gallery.Uris.AlbumShareUris?.AlbumShareUri?.Uri || gallery.WebUri;

  return {
    galleryId: galleryKey,
    galleryUrl: `https://www.smugmug.com${webUrl}`,
  };
}

async function uploadImage(
  accessToken: string,
  accessTokenSecret: string,
  galleryKey: string,
  imageData: string,
  fileName: string
): Promise<string> {
  const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1]), c => c.charCodeAt(0));

  const nonce = generateNonce();
  const timestamp = generateTimestamp();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: SMUGMUG_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = await generateSignature(
    'POST',
    SMUGMUG_UPLOAD_BASE,
    oauthParams,
    SMUGMUG_API_SECRET,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${key}="${oauthParams[key]}"`)
    .join(', ');

  const response = await fetch(SMUGMUG_UPLOAD_BASE, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'X-Smug-AlbumUri': `/api/v2/album/${galleryKey}`,
      'X-Smug-FileName': fileName,
      'X-Smug-ResponseType': 'JSON',
      'Content-Type': 'application/octet-stream',
      'Content-Length': imageBuffer.length.toString(),
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SmugMug upload error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.Image.URL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('global_settings')
      .select('id, smugmug_oauth_token, smugmug_oauth_token_secret, smugmug_connection_status')
      .limit(1)
      .maybeSingle();

    if (!settings?.smugmug_oauth_token || !settings?.smugmug_oauth_token_secret) {
      throw new Error('SmugMug not connected. Please authorize SmugMug in Admin Settings.');
    }

    if (settings.smugmug_connection_status !== 'connected') {
      throw new Error('SmugMug connection not active.');
    }

    const { action, galleryName, visibility, galleryKey, imageData, fileName } = await req.json();

    if (action === 'create_gallery') {
      const result = await createGallery(
        settings.smugmug_oauth_token,
        settings.smugmug_oauth_token_secret,
        galleryName,
        visibility
      );

      return new Response(
        JSON.stringify(result),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'upload_image') {
      if (!galleryKey || !imageData || !fileName) {
        throw new Error('Missing required parameters for upload');
      }

      const imageUrl = await uploadImage(
        settings.smugmug_oauth_token,
        settings.smugmug_oauth_token_secret,
        galleryKey,
        imageData,
        fileName
      );

      return new Response(
        JSON.stringify({ imageUrl }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('SmugMug API error:', error);

    if (error.message.includes('401') || error.message.includes('OAuth')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: settings } = await supabase
        .from('global_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (settings) {
        await supabase
          .from('global_settings')
          .update({ smugmug_connection_status: 'needs_attention' })
          .eq('id', settings.id);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message || 'SmugMug API request failed' }),
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