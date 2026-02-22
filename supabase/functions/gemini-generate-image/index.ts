import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateImageRequest {
  imageBase64: string;
  promptTemplate: string;
  referenceImageBase64?: string;
  aspectRatio?: '3:4' | '4:3' | '9:16' | '16:9' | 'square';
  modelName?: string;
  resolution?: '1K' | '2K' | '4K';
}

interface GeminiPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with service role to access global_settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse request body
    const {
      imageBase64,
      promptTemplate,
      referenceImageBase64,
      aspectRatio,
      modelName,
      resolution
    }: GenerateImageRequest = await req.json();

    // Validate required parameters
    if (!imageBase64 || !promptTemplate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: imageBase64 and promptTemplate' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch global settings to get the Gemini API key
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
      throw new Error('Failed to fetch global settings');
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!gemini_api_key || gemini_api_key.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Gemini API Key not configured. Please contact administrator.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sanitize base64 strings
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const cleanRefBase64 = referenceImageBase64?.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // Map AspectRatio to Gemini API format
    const mapAspectRatioToGemini = (ratio?: string): string => {
      switch (ratio) {
        case '3:4':
          return '3:4';
        case '4:3':
          return '4:3';
        case '9:16':
          return '9:16';
        case '16:9':
          return '16:9';
        case 'square':
        default:
          return '1:1';
      }
    };

    // Get aspect ratio specifications for prompt
    const getAspectRatioSpec = (ratio?: string): string => {
      switch (ratio) {
        case '3:4':
          return 'portrait orientation with 3:4 aspect ratio (width 768px, height 1024px)';
        case '4:3':
          return 'landscape orientation with 4:3 aspect ratio (width 1024px, height 768px)';
        case '9:16':
          return 'portrait orientation with 9:16 aspect ratio (width 576px, height 1024px)';
        case '16:9':
          return 'landscape orientation with 16:9 aspect ratio (width 1024px, height 576px)';
        case 'square':
        default:
          return 'square aspect ratio (1024px × 1024px)';
      }
    };

    const model = modelName || 'gemini-3-pro-image-preview';
    const geminiAspectRatio = mapAspectRatioToGemini(aspectRatio);
    const geminiResolution = resolution || '1K';
    const aspectRatioSpec = getAspectRatioSpec(aspectRatio);

    // Construct prompt
    let finalPrompt = `
      Transform the person in the first image into the following style: ${promptTemplate}.
      Maintain the person's facial features and identity strictly, but change the clothing, background, and artistic style to match the description.
      CRITICAL: The output image MUST be in ${aspectRatioSpec}. The composition must fit this exact aspect ratio.
      High quality, photorealistic or stylized as requested.
    `;

    const parts: GeminiPart[] = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      }
    ];

    // If a reference style image exists, add it to the request
    if (cleanRefBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanRefBase64
        }
      });
      finalPrompt += " Use the second image as a strict style reference for color palette, lighting, and composition.";
    }

    parts.push({ text: finalPrompt });

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': gemini_api_key,
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            aspectRatio: geminiAspectRatio,
            resolution: geminiResolution
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API request failed: ${geminiResponse.status} ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();

    // Extract image from response
    const resultParts = geminiResult.candidates?.[0]?.content?.parts;

    let generatedImage: string | null = null;

    if (resultParts) {
      for (const part of resultParts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImage = `data:image/jpeg;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!generatedImage) {
      throw new Error("No image generated by the model.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        generatedImage: generatedImage
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in gemini-generate-image function:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
