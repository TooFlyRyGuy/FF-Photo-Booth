import { createClient } from "npm:@supabase/supabase-js@2.87.1";
import { GoogleGenAI } from "npm:@google/genai@1.32.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from("global_settings")
      .select("gemini_api_key, gemini_enabled, gemini_model")
      .maybeSingle();

    if (!settings?.gemini_enabled) {
      return new Response(
        JSON.stringify({ error: "Gemini AI is not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.gemini_api_key) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { instruction, context } = await req.json();

    if (!instruction) {
      return new Response(
        JSON.stringify({ error: "Missing instruction" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let fullPrompt = instruction;
    if (context) {
      const contextStr = Object.entries(context)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("\n");
      fullPrompt = `Context:\n${contextStr}\n\nInstruction:\n${instruction}\n\nRespond with only the generated text, no preamble.`;
    }

    const ai = new GoogleGenAI({ apiKey: settings.gemini_api_key });
    const model = settings.gemini_model || "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
    });

    const generatedText = response.text || "";

    return new Response(
      JSON.stringify({ success: true, generatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("gemini-generate-text error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to generate text" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
