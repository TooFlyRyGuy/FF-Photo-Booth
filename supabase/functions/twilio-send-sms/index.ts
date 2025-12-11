import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SmsRequest {
  tenantId: string;
  phoneNumber: string;
  imageUrl: string;
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

    const { tenantId, phoneNumber, imageUrl }: SmsRequest = await req.json();

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      throw new Error('Failed to fetch tenant');
    }

    if (!tenant.twilio_enabled || !tenant.twilio_account_sid || !tenant.twilio_auth_token || !tenant.twilio_phone_number) {
      throw new Error('Twilio is not configured for this tenant');
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;

    const messageBody = `Here's your AI-generated photo! ${imageUrl}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${tenant.twilio_account_sid}/Messages.json`;

    const authString = btoa(`${tenant.twilio_account_sid}:${tenant.twilio_auth_token}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: tenant.twilio_phone_number,
        Body: messageBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API failed: ${errorText}`);
    }

    const result = await response.json();

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
