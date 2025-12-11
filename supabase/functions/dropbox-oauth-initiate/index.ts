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

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      throw new Error('Missing tenant_id parameter');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration not available');
    }

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
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${tenant.dropbox_app_key}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${tenantId}&token_access_type=offline`;

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
