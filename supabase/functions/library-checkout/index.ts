import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PromptSelection {
  id: string;
  name: string;
  category: string;
  tags: string[];
}

interface CheckoutPayload {
  name: string;
  eventDate: string;
  bookingId: string;
  prompts: PromptSelection[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CheckoutPayload = await req.json();

    if (!body.name?.trim() || !body.eventDate || !body.bookingId?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, eventDate, bookingId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.prompts || body.prompts.length === 0) {
      return new Response(JSON.stringify({ error: "No prompts selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch webhook URL from global_settings using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from("global_settings")
      .select("library_webhook_url")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("Failed to fetch global settings:", settingsError);
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings?.library_webhook_url) {
      return new Response(JSON.stringify({ error: "Webhook not configured. Please contact the administrator." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = settings.library_webhook_url;

    // Build the webhook payload — flat fields so Zapier can map each one directly
    const webhookPayload = {
      submitted_at: new Date().toISOString(),
      client_name: body.name.trim(),
      event_date: body.eventDate,
      booking_id: body.bookingId.trim(),
      total_selected: body.prompts.length,
      // Comma-separated lists for easy Zapier field mapping
      prompt_names: body.prompts.map(p => p.name).join(", "),
      prompt_categories: [...new Set(body.prompts.map(p => p.category))].join(", "),
      prompt_tags: [...new Set(body.prompts.flatMap(p => p.tags || []))].join(", "),
      // Full detail as a readable summary string
      prompt_list: body.prompts.map((p, i) => `${i + 1}. ${p.name} (${p.category})`).join("\n"),
    };

    console.log(`Sending library checkout webhook to: ${webhookUrl}`);
    console.log(`Booking: ${body.bookingId}, Client: ${body.name}, Prompts: ${body.prompts.length}`);

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FunFrame-Library/1.0",
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text().catch(() => "");
      console.error(`Webhook failed: ${webhookResponse.status} ${responseText}`);
      return new Response(JSON.stringify({ error: "Failed to send request. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Webhook delivered successfully: ${webhookResponse.status}`);

    return new Response(JSON.stringify({ success: true, message: "Request submitted successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("library-checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
