import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CheckRequest {
  eventId: string;
  deviceToken: string;
  action: 'check' | 'increment';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { eventId, deviceToken, action }: CheckRequest = await req.json();

    if (!eventId || !deviceToken || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: eventId, deviceToken, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action !== 'check' && action !== 'increment') {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "check" or "increment".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the client IP address from request headers
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Fetch the event to check if per-device limiting is enabled
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('limit_photos_per_device, max_photos_per_device')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      console.error('Failed to fetch event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Failed to check event settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Event not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the per-device limit is not enabled, allow everything without tracking
    if (!event.limit_photos_per_device) {
      return new Response(
        JSON.stringify({
          allowed: true,
          limitEnabled: false,
          photoCount: 0,
          maxPhotos: 0,
          remaining: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxPhotos = event.max_photos_per_device || 0;

    // Look up the existing device usage record
    const { data: deviceUsage, error: usageError } = await supabase
      .from('event_device_usage')
      .select('id, photo_count')
      .eq('event_id', eventId)
      .eq('device_token', deviceToken)
      .maybeSingle();

    if (usageError) {
      console.error('Failed to fetch device usage:', usageError);
      return new Response(
        JSON.stringify({ error: 'Failed to check device usage.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = deviceUsage?.photo_count || 0;

    if (action === 'check') {
      const allowed = currentCount < maxPhotos;
      return new Response(
        JSON.stringify({
          allowed,
          limitEnabled: true,
          photoCount: currentCount,
          maxPhotos,
          remaining: Math.max(0, maxPhotos - currentCount),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // action === 'increment'
    // Only increment if the device hasn't exceeded the limit
    if (currentCount >= maxPhotos) {
      return new Response(
        JSON.stringify({
          allowed: false,
          limitEnabled: true,
          photoCount: currentCount,
          maxPhotos,
          remaining: 0,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert: insert if new, or atomically increment if existing
    const { error: upsertError } = await supabase
      .from('event_device_usage')
      .upsert(
        {
          event_id: eventId,
          device_token: deviceToken,
          ip_address: clientIp,
          photo_count: currentCount + 1,
          last_interaction_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,device_token' }
      );

    if (upsertError) {
      console.error('Failed to upsert device usage:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record device usage.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newCount = currentCount + 1;
    return new Response(
      JSON.stringify({
        allowed: true,
        limitEnabled: true,
        photoCount: newCount,
        maxPhotos,
        remaining: Math.max(0, maxPhotos - newCount),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('check-device-limit error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
