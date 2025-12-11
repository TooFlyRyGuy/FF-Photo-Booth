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

    const dropboxAppKey = Deno.env.get('DROPBOX_APP_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!dropboxAppKey) {
      throw new Error('DROPBOX_APP_KEY not configured');
    }

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL not configured');
    }

    const redirectUri = `${supabaseUrl}/functions/v1/dropbox-oauth-callback`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropboxAppKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${tenantId}&token_access_type=offline`;

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