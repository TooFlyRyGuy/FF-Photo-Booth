import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UploadRequest {
  imageUrl: string;
  displayName?: string;
}

interface GeminiFileUploadResponse {
  file: {
    name: string;
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    sha256Hash: string;
    uri: string;
    state: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { imageUrl, displayName }: UploadRequest = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/global_settings?select=gemini_api_key,gemini_enabled&limit=1`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    );

    if (!settingsResponse.ok) {
      const errorText = await settingsResponse.text();
      console.error('Failed to fetch global settings:', settingsResponse.status, errorText);
      throw new Error(`Failed to fetch global settings: ${settingsResponse.status}`);
    }

    const settings = await settingsResponse.json();
    if (!settings || settings.length === 0) {
      throw new Error('Global settings not found');
    }

    const { gemini_api_key, gemini_enabled } = settings[0];

    if (!gemini_enabled) {
      return new Response(
        JSON.stringify({ error: 'Gemini AI is currently disabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!gemini_api_key || gemini_api_key.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Gemini API Key not configured. Please contact administrator.' }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiApiKey = gemini_api_key;

    console.log(`Downloading image from: ${imageUrl}`);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const mimeType = imageBlob.type || "image/jpeg";

    console.log(`Image downloaded, size: ${imageBuffer.byteLength} bytes, type: ${mimeType}`);

    const fileName = displayName || `image-${Date.now()}`;
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`;

    const metadata = {
      file: {
        display_name: fileName,
      },
    };

    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);

    const bodyParts: Uint8Array[] = [];
    const encoder = new TextEncoder();

    bodyParts.push(encoder.encode(`--${boundary}\r\n`));
    bodyParts.push(encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'));
    bodyParts.push(encoder.encode(JSON.stringify(metadata)));
    bodyParts.push(encoder.encode('\r\n'));

    bodyParts.push(encoder.encode(`--${boundary}\r\n`));
    bodyParts.push(encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`));
    bodyParts.push(new Uint8Array(imageBuffer));
    bodyParts.push(encoder.encode('\r\n'));

    bodyParts.push(encoder.encode(`--${boundary}--\r\n`));

    const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of bodyParts) {
      body.set(part, offset);
      offset += part.length;
    }

    console.log(`Uploading to Gemini File API...`);
    const geminiResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
    }

    const result: GeminiFileUploadResponse = await geminiResponse.json();
    console.log(`File uploaded successfully: ${result.file.uri}`);

    return new Response(
      JSON.stringify({
        fileUri: result.file.uri,
        mimeType: result.file.mimeType,
        expirationTime: result.file.expirationTime,
        sizeBytes: result.file.sizeBytes,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in gemini-file-upload:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
