import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'dropbox-oauth-error',error:'${error}'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    const tenantId = state;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('dropbox_app_key, dropbox_app_secret')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Tenant not found');
    }

    if (!tenant.dropbox_app_key || !tenant.dropbox_app_secret) {
      throw new Error('Dropbox credentials not configured for this tenant');
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
        client_id: tenant.dropbox_app_key,
        client_secret: tenant.dropbox_app_secret,
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

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        dropbox_access_token: tokenData.access_token,
        dropbox_refresh_token: tokenData.refresh_token,
        dropbox_token_expires_at: expiresAt.toISOString(),
        dropbox_enabled: true,
      })
      .eq('id', tenantId);

    if (updateError) {
      throw new Error('Failed to save tokens');
    }

    return new Response(
      `<html><body><script>window.opener.postMessage({type:'dropbox-oauth-success'},'*');window.close();</script><p>Authorization successful! You can close this window.</p></body></html>`,
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      `<html><body><script>window.opener.postMessage({type:'dropbox-oauth-error',error:'${errorMessage}'},'*');window.close();</script></body></html>`,
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
      }
    );
  }
});
