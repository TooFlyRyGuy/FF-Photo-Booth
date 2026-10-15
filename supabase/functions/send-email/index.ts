import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  userId: string;
  emailAddress: string;
  imageUrl: string;
  imageId: string;
  eventId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, emailAddress, imageUrl, imageId, eventId }: EmailRequest = await req.json();

    if (!emailAddress || !imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email address and image URL are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from('global_settings')
      .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_from_name, smtp_enabled')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error('Failed to fetch SMTP settings');
    }

    if (!settings.smtp_enabled || !settings.smtp_host || !settings.smtp_from_email) {
      throw new Error('SMTP is not configured');
    }

    let subjectTemplate = 'Your AI photo from {event_name}';
    let bodyTemplate = `<p>Here's your AI-generated photo from {event_name}!</p><p><img src="{image_url}" alt="AI Photo" style="max-width:100%;border-radius:8px;" /></p><p><a href="{image_url}" style="display:inline-block;padding:12px 28px;background:#15803d;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Download Photo</a></p>`;
    let eventName = 'your event';

    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('name, email_subject, email_body')
        .eq('id', eventId)
        .maybeSingle();

      if (event) {
        eventName = event.name;
        if (event.email_subject) {
          subjectTemplate = event.email_subject;
        }
        if (event.email_body) {
          bodyTemplate = event.email_body;
        }
      }
    }

    const subject = subjectTemplate
      .replace(/{event_name}/g, eventName)
      .replace(/{image_url}/g, imageUrl);

    const htmlBody = bodyTemplate
      .replace(/{event_name}/g, eventName)
      .replace(/{image_url}/g, imageUrl);

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: (settings.smtp_port || 587) === 465,
      auth: settings.smtp_username ? {
        user: settings.smtp_username,
        pass: settings.smtp_password,
      } : undefined,
    });

    const fromName = settings.smtp_from_name || 'Lumina Booth';
    const fromAddress = `${fromName} <${settings.smtp_from_email}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: emailAddress,
      subject,
      html: htmlBody,
    });

    await supabase
      .from('sms_logs')
      .insert({
        image_id: imageId,
        phone_number: emailAddress,
        message_sid: info.messageId,
        status: 'sent',
        sent_at: new Date().toISOString(),
        user_id: userId,
      });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Send email error:', error);
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
