import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const successPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connected Successfully</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 48px;
      text-align: center;
      max-width: 480px;
      width: 100%;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .checkmark {
      width: 40px;
      height: 40px;
      border: 3px solid white;
      border-radius: 50%;
      position: relative;
    }
    .checkmark:after {
      content: '';
      position: absolute;
      left: 10px;
      top: 4px;
      width: 12px;
      height: 20px;
      border: solid white;
      border-width: 0 3px 3px 0;
      transform: rotate(45deg);
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .closing {
      color: #9ca3af;
      font-size: 14px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <div class="checkmark"></div>
    </div>
    <h1>Connected Successfully!</h1>
    <p>Your Dropbox account has been connected.</p>
    <p class="closing">This window will close automatically...</p>
  </div>
  <script>
    window.opener.postMessage({type:'dropbox-oauth-success'},'*');
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>
`;

const errorPage = (errorMessage) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connection Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 48px;
      text-align: center;
      max-width: 480px;
      width: 100%;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .xmark {
      width: 40px;
      height: 40px;
      position: relative;
    }
    .xmark:before, .xmark:after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 3px;
      height: 40px;
      background: white;
    }
    .xmark:before {
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .xmark:after {
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .error-detail {
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      color: #991b1b;
      font-size: 14px;
      word-break: break-word;
    }
    .closing {
      color: #9ca3af;
      font-size: 14px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <div class="xmark"></div>
    </div>
    <h1>Connection Failed</h1>
    <p>We couldn't connect your Dropbox account.</p>
    <div class="error-detail">${errorMessage}</div>
    <p class="closing">This window will close automatically...</p>
  </div>
  <script>
    window.opener.postMessage({type:'dropbox-oauth-error',error:'${errorMessage}'},'*');
    setTimeout(() => window.close(), 4000);
  </script>
</body>
</html>
`;

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(errorPage(error), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
        }
      });
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    const userId = state;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings, error: settingsError } = await supabase
      .from('global_settings')
      .select('dropbox_app_key, dropbox_app_secret')
      .eq('singleton_id', 1)
      .single();

    if (settingsError || !settings) {
      throw new Error('Global settings not found');
    }

    if (!settings.dropbox_app_key || !settings.dropbox_app_secret) {
      throw new Error('Dropbox credentials not configured');
    }

    const redirectUri = `${supabaseUrl}/functions/v1/dropbox-oauth-callback`;

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: settings.dropbox_app_key,
        client_secret: settings.dropbox_app_secret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { data: userSettings, error: userSettingsError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (userSettingsError || !userSettings) {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          dropbox_access_token: tokenData.access_token,
          dropbox_refresh_token: tokenData.refresh_token,
          dropbox_token_expires_at: expiresAt.toISOString(),
          dropbox_enabled: true,
        });

      if (insertError) {
        throw new Error('Failed to save tokens');
      }
    } else {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({
          dropbox_access_token: tokenData.access_token,
          dropbox_refresh_token: tokenData.refresh_token,
          dropbox_token_expires_at: expiresAt.toISOString(),
          dropbox_enabled: true,
        })
        .eq('user_id', userId);

      if (updateError) {
        throw new Error('Failed to save tokens');
      }
    }

    return new Response(successPage, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(errorPage(errorMessage), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
    });
  }
});
