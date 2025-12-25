import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const SMUGMUG_API_KEY = "zBR2TRq5bCzc42Zz6nzwwWDmSzSFdcZJ";
const SMUGMUG_API_SECRET = "sxbDQsfD9pd7kTXfh7M5pLwLQbfVQG2zXfswptp2jHDTzS4NMc98g4S6v7N5sSrC";
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

async function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): Promise<string> {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

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
      .select('id, smugmug_oauth_token_secret')
      .limit(1)
      .maybeSingle();

    if (!settings?.smugmug_oauth_token_secret) {
      throw new Error('Request token secret not found in database');
    }

    const requestTokenSecret = settings.smugmug_oauth_token_secret;

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
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
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
      .map(key => `${key}="${encodeURIComponent(userOauthParams[key])}"`)
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
        smugmug_user_nickname: userNickname,
        smugmug_connection_status: 'connected',
        smugmug_last_auth_date: new Date().toISOString(),
      })
      .eq('id', settings.id);

    const appOrigin = url.searchParams.get('state') || url.origin;
    return Response.redirect(`${appOrigin}?smugmug_auth=success`, 302);
  } catch (error: any) {
    console.error('SmugMug OAuth callback error:', error);

    const url = new URL(req.url);
    const appOrigin = url.searchParams.get('state') || url.origin;
    return Response.redirect(`${appOrigin}?smugmug_auth=error&message=${encodeURIComponent(error.message)}`, 302);
  }
});