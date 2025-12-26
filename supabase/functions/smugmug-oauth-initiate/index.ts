import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const SMUGMUG_API_KEY = Deno.env.get('SMUGMUG_API_KEY')!;
const SMUGMUG_API_SECRET = Deno.env.get('SMUGMUG_API_SECRET')!;
const SMUGMUG_REQUEST_TOKEN_URL = "https://api.smugmug.com/services/oauth/1.0a/getRequestToken";
const SMUGMUG_AUTHORIZE_URL = "https://api.smugmug.com/services/oauth/1.0a/authorize";

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
    const callbackUrl = url.searchParams.get('callback_url') || `${url.origin}/smugmug-callback`;
    const appOrigin = url.searchParams.get('app_origin') || url.origin;

    const callbackWithState = `${callbackUrl}?state=${appOrigin}`;

    const nonce = generateNonce();
    const timestamp = generateTimestamp();

    const oauthParams: Record<string, string> = {
      oauth_callback: callbackWithState,
      oauth_consumer_key: SMUGMUG_API_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    };

    const sortedParamsForSig = Object.keys(oauthParams)
      .sort()
      .map(key => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
      .join('&');

    const ourSBS = `GET&${percentEncode(SMUGMUG_REQUEST_TOKEN_URL)}&${percentEncode(sortedParamsForSig)}`;
    console.log('=== OUR SIGNATURE BASE STRING (before signature) ===');
    console.log(ourSBS);
    console.log('=== OAUTH PARAMS (before signature) ===');
    console.log(JSON.stringify(oauthParams, null, 2));
    console.log('=== CALLBACK URL ===');
    console.log(callbackWithState);

    const signature = await generateSignature(
      'GET',
      SMUGMUG_REQUEST_TOKEN_URL,
      oauthParams,
      SMUGMUG_API_SECRET
    );

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${key}="${oauthParams[key]}"`)
      .join(', ');

    console.log('OAuth Authorization header:', authHeader);
    console.log('Request token URL:', SMUGMUG_REQUEST_TOKEN_URL);

    const response = await fetch(SMUGMUG_REQUEST_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SmugMug API error response:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      throw new Error(`SmugMug request token failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const requestToken = params.get('oauth_token');
    const requestTokenSecret = params.get('oauth_token_secret');

    if (!requestToken || !requestTokenSecret) {
      throw new Error('Failed to get request token from SmugMug');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('global_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!settings) {
      throw new Error('Global settings not found');
    }

    const { error: updateError } = await supabase
      .from('global_settings')
      .update({
        smugmug_oauth_token: requestToken,
        smugmug_request_token_secret: requestTokenSecret,
        smugmug_connection_status: 'authorizing',
      })
      .eq('id', settings.id);

    if (updateError) {
      console.error('Failed to save request token to database:', updateError);
      throw new Error('Failed to save OAuth state to database');
    }

    const { data: verify } = await supabase
      .from('global_settings')
      .select('smugmug_request_token_secret')
      .eq('id', settings.id)
      .maybeSingle();

    if (!verify?.smugmug_request_token_secret) {
      console.error('Request token secret was not saved to database');
      throw new Error('Failed to verify OAuth state in database');
    }

    const authorizeUrl = `${SMUGMUG_AUTHORIZE_URL}?oauth_token=${requestToken}&Access=Full&Permissions=Modify`;

    return new Response(
      JSON.stringify({ authorizeUrl }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('SmugMug OAuth initiation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to initiate SmugMug OAuth' }),
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
