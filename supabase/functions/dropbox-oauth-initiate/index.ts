import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration not available');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

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
    const scopes = [
      'files.content.write',
      'files.content.read',
      'sharing.write',
      'sharing.read'
    ].join(' ');
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${settings.dropbox_app_key}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${user.id}&token_access_type=offline&scope=${encodeURIComponent(scopes)}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl,
      },
    });
  } catch (error) {
    console.error('OAuth initiate error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      `<html><body><script>window.opener.postMessage({type:'dropbox-oauth-error',error:'${errorMessage}'},'*');window.close();</script><p>Error: ${errorMessage}</p></body></html>`,
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