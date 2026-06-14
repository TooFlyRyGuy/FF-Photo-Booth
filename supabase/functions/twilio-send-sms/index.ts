import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SmsRequest {
  userId: string;
  phoneNumber: string;
  imageUrl: string;
  imageId: string;
  eventId?: string;
  isTest?: boolean;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, phoneNumber, imageUrl, imageId, eventId, isTest }: SmsRequest = await req.json();

    const { data: settings, error: settingsError } = await supabase
      .from('global_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error('Settings error:', settingsError);
      throw new Error('Failed to fetch Twilio settings');
    }

    if (!settings.twilio_enabled || !settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number) {
      throw new Error('Twilio is not configured');
    }

    let messageTemplate = "Here's your AI-generated photo from {event_name}! {image_url}";
    let eventName = 'your event';

    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('name, sms_message')
        .eq('id', eventId)
        .maybeSingle();

      if (event) {
        eventName = event.name;
        if (event.sms_message) {
          messageTemplate = event.sms_message;
        }
      }
    }

    const imageUrlToken = isTest
      ? '(This is a test — no image is saved or sent in tests)'
      : imageUrl;

    const messageBody = messageTemplate
      .replace('{event_name}', eventName)
      .replace('{image_url}', imageUrlToken);

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\\D/g, '')}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`;

    const authString = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: settings.twilio_phone_number,
        Body: messageBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API failed: ${errorText}`);
    }

    const result = await response.json();

    await supabase
      .from('sms_logs')
      .insert({
        image_id: imageId,
        phone_number: formattedPhone,
        message_sid: result.sid,
        status: 'sent',
        sent_at: new Date().toISOString(),
        user_id: userId,
      });

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: result.sid,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Twilio SMS error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
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
