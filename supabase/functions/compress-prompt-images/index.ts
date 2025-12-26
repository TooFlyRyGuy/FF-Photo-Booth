import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function compressBase64Image(base64: string, maxDimension: number = 400): Promise<string> {
  try {
    const mimeMatch = base64.match(/^data:image\/(\w+);base64,/);
    if (!mimeMatch) {
      throw new Error('Invalid base64 image format');
    }

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const response = await fetch(`data:image/${mimeMatch[1]};base64,${base64Data}`);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    let width = imageBitmap.width;
    let height = imageBitmap.height;

    if (width > maxDimension || height > maxDimension) {
      const ratio = maxDimension / Math.max(width, height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(imageBitmap, 0, 0, width, height);

    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.7,
    });

    const buffer = await compressedBlob.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const chunkSize = 8192;
    const chunks = [];
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    const base64Compressed = btoa(chunks.join(''));

    console.log(`Compressed ${imageBitmap.width}x${imageBitmap.height} to ${width}x${height}, size: ${base64Data.length} -> ${base64Compressed.length}`);

    return `data:image/jpeg;base64,${base64Compressed}`;
  } catch (error) {
    console.error('Error compressing image:', error);
    return base64;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: prompts, error: fetchError } = await supabase
      .from('prompts')
      .select('id, preview_image_url, reference_image_url, preview_image_compressed, reference_image_compressed')
      .not('preview_image_url', 'is', null)
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch prompts: ${fetchError.message}`);
    }

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No prompts to compress' }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let compressed = 0;
    let skipped = 0;

    for (const prompt of prompts) {
      if (prompt.preview_image_compressed &&
          prompt.preview_image_compressed !== prompt.preview_image_url &&
          prompt.preview_image_compressed.length > 0) {
        skipped++;
        continue;
      }

      const updates: any = {};

      if (prompt.preview_image_url && prompt.preview_image_url.startsWith('data:image')) {
        console.log(`Compressing preview image for prompt ${prompt.id}...`);
        updates.preview_image_compressed = await compressBase64Image(prompt.preview_image_url, 400);
      }

      if (prompt.reference_image_url && prompt.reference_image_url.startsWith('data:image')) {
        console.log(`Compressing reference image for prompt ${prompt.id}...`);
        updates.reference_image_compressed = await compressBase64Image(prompt.reference_image_url, 600);
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('prompts')
          .update(updates)
          .eq('id', prompt.id);

        if (updateError) {
          console.error(`Failed to update prompt ${prompt.id}:`, updateError);
        } else {
          compressed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        compressed,
        skipped,
        total: prompts.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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