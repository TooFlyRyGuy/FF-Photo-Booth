import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function uploadBase64ToStorage(
  supabase: any,
  base64DataUri: string,
  promptId: string,
  imageType: "preview" | "reference"
): Promise<string> {
  const mimeMatch = base64DataUri.match(/^data:(image\/\w+);base64,/);
  if (!mimeMatch) throw new Error("Invalid base64 format");

  const mimeType = mimeMatch[1];
  const base64Data = base64DataUri.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

  // Determine extension
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const filename = `${promptId}-${imageType}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("prompt-images")
    .upload(filename, binaryData, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("prompt-images")
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 20;
    const offset = body.offset || 0;

    const { data: prompts, error: fetchError } = await supabase
      .from("prompts")
      .select("id, name, preview_image_url, reference_image_url")
      .or("preview_image_url.like.data:%,reference_image_url.like.data:%")
      .range(offset, offset + batchSize - 1);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more base64 images to migrate", processed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const prompt of prompts) {
      const updates: Record<string, string> = {};
      const errors: string[] = [];

      if (prompt.preview_image_url?.startsWith("data:")) {
        try {
          const url = await uploadBase64ToStorage(supabase, prompt.preview_image_url, prompt.id, "preview");
          updates.preview_image_url = url;
          console.log(`Migrated preview for "${prompt.name}" (${Math.round(prompt.preview_image_url.length / 1024)}KB base64 -> URL)`);
        } catch (e: any) {
          errors.push(`preview: ${e.message}`);
          console.error(`Failed preview for "${prompt.name}":`, e.message);
        }
      }

      if (prompt.reference_image_url?.startsWith("data:")) {
        try {
          const url = await uploadBase64ToStorage(supabase, prompt.reference_image_url, prompt.id, "reference");
          updates.reference_image_url = url;
          console.log(`Migrated reference for "${prompt.name}" (${Math.round(prompt.reference_image_url.length / 1024)}KB base64 -> URL)`);
        } catch (e: any) {
          errors.push(`reference: ${e.message}`);
          console.error(`Failed reference for "${prompt.name}":`, e.message);
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("prompts")
          .update(updates)
          .eq("id", prompt.id);

        if (updateError) {
          errors.push(`db update: ${updateError.message}`);
        }
      }

      results.push({ id: prompt.id, name: prompt.name, migrated: Object.keys(updates), errors });
    }

    const { count } = await supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .or("preview_image_url.like.data:%,reference_image_url.like.data:%");

    return new Response(
      JSON.stringify({
        success: true,
        processed: prompts.length,
        remaining: count ?? 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
