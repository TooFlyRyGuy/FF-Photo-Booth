import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RedeemRequest {
  token: string;
  deviceToken?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token, deviceToken }: RedeemRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Atomic redemption: UPDATE ... WHERE is_used = false RETURNING
    // The database row lock guarantees only one concurrent request can mark
    // the code as used — the second one sees is_used = true and gets zero rows.
    const { data: redeemed, error: redeemError } = await supabase
      .from('event_access_codes')
      .update({
        is_used: true,
        redeemed_at: new Date().toISOString(),
        redeemed_ip: clientIp,
        redeemed_device_token: deviceToken || null,
      })
      .eq('token', token)
      .eq('is_used', false)
      .select('event_id')
      .maybeSingle();

    if (redeemError) {
      console.error('Redemption query failed:', redeemError);
      return new Response(
        JSON.stringify({ error: 'Failed to redeem access code.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!redeemed) {
      // Either the token doesn't exist or it's already used.
      // Check which case it is so we can give the right message.
      const { data: existing } = await supabase
        .from('event_access_codes')
        .select('is_used')
        .eq('token', token)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ status: 'invalid', message: 'This access code is invalid.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'already_used', message: 'This access pass has already been used.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success — fetch the event passcode so the guest can enter the kiosk
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('passcode, name, qr_access_enabled')
      .eq('id', redeemed.event_id)
      .maybeSingle();

    if (eventError || !event) {
      console.error('Failed to fetch event after redemption:', eventError);
      return new Response(
        JSON.stringify({ error: 'Failed to load event details.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event.qr_access_enabled) {
      return new Response(
        JSON.stringify({ status: 'disabled', message: 'QR access is not enabled for this event.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        passcode: event.passcode,
        eventName: event.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('redeem-access-code error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
