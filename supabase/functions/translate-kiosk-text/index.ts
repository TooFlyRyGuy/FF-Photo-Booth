import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TranslateRequest {
  texts: { key: string; value: string }[];
  targetLanguage: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  zh: "Mandarin Chinese (Simplified)",
  ja: "Japanese",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { texts, targetLanguage }: TranslateRequest = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty texts array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing targetLanguage parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/global_settings?select=gemini_api_key,gemini_enabled,gemini_model&limit=1`,
      {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    if (!settingsResponse.ok) {
      throw new Error(`Failed to fetch global settings: ${settingsResponse.status}`);
    }

    const settings = await settingsResponse.json();
    if (!settings || settings.length === 0) {
      throw new Error("Global settings not found");
    }

    const { gemini_api_key, gemini_enabled, gemini_model } = settings[0];

    if (!gemini_enabled) {
      return new Response(
        JSON.stringify({ error: "Gemini AI is currently disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gemini_api_key || gemini_api_key.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Gemini API Key not configured. Please contact administrator." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemsText = texts.map((t, i) => {
      return `Item ${i + 1} (key: ${t.key}):\n  ${t.value}`;
    }).join("\n\n");

    const translationPrompt = `You are a professional translator. Translate the following photo booth kiosk UI text from English to ${languageName}.

Rules:
- Keep translations natural and culturally appropriate.
- These are short UI labels and buttons — keep them concise.
- Maintain any uppercase styling conventions where appropriate.
- Do NOT translate brand names or proper nouns (e.g., "Fun Frame Photo").
- Placeholders like {style} or {seconds} must be preserved exactly as-is.
- Return ONLY a JSON array, no markdown formatting, no explanation.

Input items:
${itemsText}

Return format (JSON array, same order as input):
[
  { "key": "kiosk.tapToStart", "value": "translated text" }
]`;

    const textModel = gemini_model || 'gemini-2.5-flash';

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": gemini_api_key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: translationPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini translation error:", geminiResponse.status, errorText);
      throw new Error(`Gemini translation failed: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    let translations: { key: string; value: string }[];
    try {
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      translations = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse Gemini translation response:", parseError);
      console.error("Raw response:", responseText);
      throw new Error("Failed to parse translation response from Gemini");
    }

    if (!Array.isArray(translations) || translations.length !== texts.length) {
      throw new Error("Translation count mismatch");
    }

    const result = texts.map((text, i) => ({
      key: text.key,
      value: translations[i].value || text.value,
    }));

    return new Response(
      JSON.stringify({ translations: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("translate-kiosk-text error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
