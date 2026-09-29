import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LowCreditWarningRequest {
  userId: string;
  eventName: string;
  remainingCredits: number;
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

    const { userId, eventName, remainingCredits }: LowCreditWarningRequest = await req.json();

    if (!userId || remainingCredits === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId and remainingCredits are required' }),
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
      console.log('SMTP not configured - skipping low credit warning email');
      return new Response(
        JSON.stringify({ success: true, message: 'SMTP not configured - email skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();

    const { data: adminProfiles } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('role', 'admin');

    const recipients: { email: string; name: string; isOwner: boolean }[] = [];

    if (ownerProfile?.email) {
      recipients.push({
        email: ownerProfile.email,
        name: ownerProfile.full_name || 'Event Owner',
        isOwner: true,
      });
    }

    for (const admin of adminProfiles || []) {
      if (admin.email && !recipients.some(r => r.email === admin.email)) {
        recipients.push({
          email: admin.email,
          name: admin.full_name || 'Admin',
          isOwner: false,
        });
      }
    }

    if (recipients.length === 0) {
      console.log('No recipients found for low credit warning');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subject = `Low Credit Warning - ${eventName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Low Credit Warning</h2>
        <p>The image credits for the event <strong>${eventName}</strong> are running low.</p>
        <p style="font-size: 18px; margin: 20px 0;">Remaining credits: <strong style="color: #dc2626;">${remainingCredits}</strong></p>
        <p>The credit balance has dropped to 50 or below. Please purchase additional credits or upgrade the subscription plan to avoid interruption during the event.</p>
        <p>You can purchase credits from your dashboard under the Credits section.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">This is an automated message from Fun Frame AI.</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: (settings.smtp_port || 587) === 465,
      auth: settings.smtp_username ? {
        user: settings.smtp_username,
        pass: settings.smtp_password,
      } : undefined,
    });

    const fromName = settings.smtp_from_name || 'Fun Frame AI';
    const fromAddress = `${fromName} <${settings.smtp_from_email}>`;

    const sendResults: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: recipient.email,
          subject,
          html: htmlBody,
        });
        sendResults.push({ email: recipient.email, success: true });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to send low credit warning to ${recipient.email}:`, errMsg);
        sendResults.push({ email: recipient.email, success: false, error: errMsg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sendResults.filter(r => r.success).length,
        failed: sendResults.filter(r => !r.success).length,
        results: sendResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Low credit warning error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
