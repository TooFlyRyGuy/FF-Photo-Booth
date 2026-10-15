import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { data: prompts, error: fetchError } = await supabase
      .from("prompts")
      .select("id, preview_image_url, reference_image_url")
      .or("preview_image_url.like.data:%,reference_image_url.like.data:%")
      .limit(50);

    if (fetchError) throw new Error(`Failed to fetch prompts: ${fetchError.message}`);

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No base64 images to migrate", migrated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let migrated = 0;
    let failed = 0;

    for (const prompt of prompts) {
      const updates: Record<string, string> = {};

      if (prompt.preview_image_url && prompt.preview_image_url.startsWith("data:image")) {
        try {
          const url = await uploadBase64ToStorage(supabase, prompt.preview_image_url, `migrated/${prompt.id}_preview.jpg`);
          updates.preview_image_url = url;
        } catch (err) {
          console.error(`Failed to migrate preview for prompt ${prompt.id}:`, err);
          failed++;
        }
      }

      if (prompt.reference_image_url && prompt.reference_image_url.startsWith("data:image")) {
        try {
          const url = await uploadBase64ToStorage(supabase, prompt.reference_image_url, `migrated/${prompt.id}_reference.jpg`);
          updates.reference_image_url = url;
        } catch (err) {
          console.error(`Failed to migrate reference for prompt ${prompt.id}:`, err);
          failed++;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("prompts")
          .update(updates)
          .eq("id", prompt.id);

        if (updateError) {
          console.error(`Failed to update prompt ${prompt.id}:`, updateError);
          failed++;
        } else {
          migrated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, migrated, failed, total: prompts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function uploadBase64ToStorage(
  supabase: ReturnType<typeof createClient>,
  base64Data: string,
  filePath: string,
): Promise<string> {
  const mimeMatch = base64Data.match(/^data:image\/(\w+);base64,/);
  if (!mimeMatch) throw new Error("Invalid base64 image format");

  const base64Raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const binaryString = atob(base64Raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { data, error } = await supabase.storage
    .from("prompt-images")
    .upload(filePath, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from("prompt-images")
    .getPublicUrl(data.path);

  return publicUrl;
}
