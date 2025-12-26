import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const SMUGMUG_API_KEY = Deno.env.get('SMUGMUG_API_KEY')!;
const SMUGMUG_API_SECRET = Deno.env.get('SMUGMUG_API_SECRET')!;
const SMUGMUG_ACCESS_TOKEN_URL = "https://api.smugmug.com/services/oauth/1.0a/getAccessToken";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const oauthToken = url.searchParams.get('oauth_token');
    const oauthVerifier = url.searchParams.get('oauth_verifier');

    if (!oauthToken || !oauthVerifier) {
      throw new Error('Missing oauth_token or oauth_verifier');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('global_settings')
      .select('id, smugmug_request_token_secret')
      .limit(1)
      .maybeSingle();

    if (!settings?.smugmug_request_token_secret) {
      throw new Error('Request token secret not found in database');
    }

    const requestTokenSecret = settings.smugmug_request_token_secret;

    const nonce = generateNonce();
    const timestamp = generateTimestamp();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: SMUGMUG_API_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0',
    };

    const signature = await generateSignature(
      'GET',
      SMUGMUG_ACCESS_TOKEN_URL,
      oauthParams,
      SMUGMUG_API_SECRET,
      requestTokenSecret
    );

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${key}="${percentEncode(oauthParams[key])}"`)
      .join(', ');

    const response = await fetch(SMUGMUG_ACCESS_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SmugMug access token failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Failed to get access token from SmugMug');
    }

    const userNonce = generateNonce();
    const userTimestamp = generateTimestamp();
    const userOauthParams: Record<string, string> = {
      oauth_consumer_key: SMUGMUG_API_KEY,
      oauth_nonce: userNonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: userTimestamp,
      oauth_token: accessToken,
      oauth_version: '1.0',
    };

    const userSignature = await generateSignature(
      'GET',
      'https://api.smugmug.com/api/v2!authuser',
      userOauthParams,
      SMUGMUG_API_SECRET,
      accessTokenSecret
    );

    userOauthParams.oauth_signature = userSignature;

    const userAuthHeader = 'OAuth ' + Object.keys(userOauthParams)
      .sort()
      .map(key => `${key}="${percentEncode(userOauthParams[key])}"`)
      .join(', ');

    const userResponse = await fetch('https://api.smugmug.com/api/v2!authuser', {
      headers: {
        'Authorization': userAuthHeader,
        'Accept': 'application/json',
      },
    });

    let userNickname = 'Unknown';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      userNickname = userData.Response?.User?.NickName || 'Unknown';
    }

    await supabase
      .from('global_settings')
      .update({
        smugmug_oauth_token: accessToken,
        smugmug_oauth_token_secret: accessTokenSecret,
        smugmug_request_token_secret: null,
        smugmug_user_nickname: userNickname,
        smugmug_connection_status: 'connected',
        smugmug_last_auth_date: new Date().toISOString(),
      })
      .eq('id', settings.id);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SmugMug Connected</title>
        </head>
        <body>
          <h2>SmugMug Connected Successfully!</h2>
          <p>This window will close automatically...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'smugmug-oauth-success' }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              document.body.innerHTML = '<h2>Success!</h2><p>You can close this window now.</p>';
            }
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('SmugMug OAuth callback error:', error);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SmugMug Connection Failed</title>
        </head>
        <body>
          <h2>Failed to Connect to SmugMug</h2>
          <p>${error.message}</p>
          <p>This window will close automatically...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'smugmug-oauth-error',
                error: ${JSON.stringify(error.message)}
              }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              document.body.innerHTML += '<p>You can close this window now.</p>';
            }
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    });
  }
});
