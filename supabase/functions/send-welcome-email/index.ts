import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  email: string;
  full_name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, full_name }: EmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailContent = {
      to: email,
      subject: "Welcome to Lumina Booth!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Lumina Booth</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #15803d 0%, #166534 100%); border-radius: 12px 12px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Welcome to Lumina Booth!</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 24px;">Hi ${full_name || 'there'}!</h2>
                        <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                          We're excited to have you on board! Your account has been successfully created and you're ready to start creating amazing AI-powered photo experiences.
                        </p>
                        
                        <div style="margin: 30px 0; padding: 20px; background-color: #f1f5f9; border-radius: 8px;">
                          <h3 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px;">Getting Started</h3>
                          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 16px; line-height: 1.8;">
                            <li>Create your first event</li>
                            <li>Customize prompts for AI-generated images</li>
                            <li>Set up your kiosk mode for live events</li>
                            <li>Connect integrations like Dropbox and SmugMug</li>
                          </ul>
                        </div>

                        <p style="margin: 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                          If you have any questions or need assistance, don't hesitate to reach out to our support team.
                        </p>

                        <div style="text-align: center; margin-top: 30px;">
                          <a href="${Deno.env.get('SITE_URL') || 'https://luminabooth.com'}" 
                             style="display: inline-block; padding: 14px 32px; background-color: #15803d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Get Started
                          </a>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 40px; text-align: center; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #64748b; font-size: 14px;">
                          © ${new Date().getFullYear()} Lumina Booth. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `Welcome to Lumina Booth!\n\nHi ${full_name || 'there'}!\n\nWe're excited to have you on board! Your account has been successfully created and you're ready to start creating amazing AI-powered photo experiences.\n\nGetting Started:\n- Create your first event\n- Customize prompts for AI-generated images\n- Set up your kiosk mode for live events\n- Connect integrations like Dropbox and SmugMug\n\nIf you have any questions or need assistance, don't hesitate to reach out to our support team.`,
    };

    console.log(`Sending welcome email to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email prepared successfully",
        preview: "Email functionality is ready. Configure your email service provider to send emails."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});