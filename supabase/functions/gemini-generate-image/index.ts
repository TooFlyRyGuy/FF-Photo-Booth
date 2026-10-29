import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReferenceImageItem {
  url?: string;
  strength?: number;
}

interface GenerateImageRequest {
  imageBase64?: string;
  imageUrl?: string;
  imageFileUri?: string;
  promptTemplate: string;
  referenceImageBase64?: string;
  referenceImageUrl?: string;
  referenceFileUri?: string;
  referenceImages?: ReferenceImageItem[];
  aspectRatio?: '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2' | '4:5' | 'square';
  modelName?: string;
  resolution?: '1K' | '2K' | '4K';
  eventId?: string;
}

interface GeminiPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
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
      imageUrl,
      imageFileUri,
      promptTemplate,
      referenceImageBase64,
      referenceImageUrl,
      referenceFileUri,
      referenceImages,
      aspectRatio,
      modelName,
      resolution,
      eventId
    }: GenerateImageRequest = await req.json();

    // Validate required parameters
    if ((!imageBase64 && !imageUrl && !imageFileUri) || !promptTemplate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: (imageBase64, imageUrl, or imageFileUri) and promptTemplate' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch global settings to get the Gemini API key
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/global_settings?select=gemini_api_key,gemini_enabled,gemini_model,gemini_resolution&limit=1`,
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

    const { gemini_api_key, gemini_enabled, gemini_model, gemini_resolution } = settings[0];

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

    // Helper function to upload raw bytes to Gemini File API, returns {uri, mimeType}
    async function uploadBytesToGemini(imageBuffer: ArrayBuffer, rawMime: string): Promise<{ uri: string; mimeType: string }> {
      // Normalize mimeType — Gemini only accepts image/jpeg, image/png, image/webp, image/gif
      const mimeType = rawMime.startsWith('image/') ? rawMime : "image/jpeg";

      console.log(`Uploading bytes to Gemini File API, size: ${imageBuffer.byteLength} bytes, type: ${mimeType}`);

      const fileName = `image-${Date.now()}.jpg`;
      const initiateUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${gemini_api_key}`;

      // Step 1: Initiate resumable upload
      const initiateResponse = await fetch(initiateUrl, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": imageBuffer.byteLength.toString(),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: fileName } }),
      });

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text();
        throw new Error(`Gemini File API initiate error: ${initiateResponse.statusText} - ${errorText}`);
      }

      const uploadUrl = initiateResponse.headers.get("X-Goog-Upload-URL");
      if (!uploadUrl) {
        throw new Error("No upload URL returned from Gemini API");
      }

      // Step 2: Upload the file data
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Length": imageBuffer.byteLength.toString(),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: new Uint8Array(imageBuffer),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Gemini File API upload error: ${uploadResponse.statusText} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      const fileUri = result.file.uri;
      const fileMime = result.file.mimeType || mimeType;
      console.log(`File uploaded: ${fileUri}, mimeType: ${fileMime}, state: ${result.file.state}`);

      // Wait for file to become ACTIVE (processing can take a moment)
      if (result.file.state === 'PROCESSING') {
        const fileNameId = fileUri.split('/').pop();
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const stateResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/files/${fileNameId}?key=${gemini_api_key}`
          );
          if (stateResp.ok) {
            const stateData = await stateResp.json();
            console.log(`File state check ${i + 1}: ${stateData.state}`);
            if (stateData.state === 'ACTIVE') break;
            if (stateData.state === 'FAILED') throw new Error('Gemini file processing failed');
          }
        }
      }

      return { uri: fileUri, mimeType: fileMime };
    }

    // Helper: fetch a URL and upload its bytes to Gemini File API
    async function uploadUrlToGemini(url: string): Promise<{ uri: string; mimeType: string }> {
      console.log(`Fetching URL for Gemini File API upload: ${url}`);
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`);
      }
      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      const rawMime = imageBlob.type || "image/jpeg";
      return uploadBytesToGemini(imageBuffer, rawMime);
    }

    // Helper: decode a base64 string and upload its bytes to Gemini File API
    async function uploadBase64ToGemini(base64: string, mime: string = "image/jpeg"): Promise<{ uri: string; mimeType: string }> {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return uploadBytesToGemini(bytes.buffer, mime);
    }

    // Sanitize base64 strings (for backward compatibility)
    const cleanBase64 = imageBase64?.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const cleanRefBase64 = referenceImageBase64?.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

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
        case '2:3':
          return '2:3';
        case '3:2':
          return '3:2';
        case '4:5':
          return '4:5';
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
        case '2:3':
          return 'portrait orientation with 2:3 aspect ratio (width 683px, height 1024px)';
        case '3:2':
          return 'landscape orientation with 3:2 aspect ratio (width 1024px, height 683px)';
        case '4:5':
          return 'portrait orientation with 4:5 aspect ratio (width 819px, height 1024px)';
        case 'square':
        default:
          return 'square aspect ratio (1024px × 1024px)';
      }
    };

    const NANO_BANANA_21 = 'gemini-nano-banana-2.1';
    const NANO_BANANA_2 = 'gemini-3.1-flash-image';

    const normalizeModelName = (name: string | null | undefined): string | null => {
      if (name == null) return null;
      const trimmed = String(name).trim();
      if (!trimmed) return null;
      if (trimmed.toLowerCase() === 'latest') return NANO_BANANA_21;
      return trimmed;
    };

    const isMissingOrUnsupportedModel = (status: number, body: string): boolean => {
      if (status === 404) return true;
      const text = body.toLowerCase();
      return (
        text.includes('model-not-found') ||
        text.includes('model not found') ||
        text.includes('unsupported-model') ||
        text.includes('unsupported model') ||
        (text.includes('not_found') && text.includes('model')) ||
        (text.includes('is not found') && text.includes('model')) ||
        text.includes('not supported for generatecontent')
      );
    };

    let eventGeminiModel: string | null = null;
    const eventIdValue = typeof eventId === 'string' ? eventId.trim() : '';
    if (eventIdValue && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventIdValue)) {
      const eventResponse = await fetch(
        `${supabaseUrl}/rest/v1/events?id=eq.${eventIdValue}&select=gemini_model&limit=1`,
        {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          }
        }
      );

      if (!eventResponse.ok) {
        const errorText = await eventResponse.text();
        console.error('Failed to load event gemini_model:', eventResponse.status, errorText);
      } else {
        const eventRows = await eventResponse.json();
        const stored = eventRows?.[0]?.gemini_model;
        eventGeminiModel = typeof stored === 'string' && stored.trim() ? stored.trim() : null;
      }
    } else if (eventIdValue) {
      console.warn('Ignoring invalid eventId for gemini_model lookup:', eventIdValue);
    }

    const requestModel = normalizeModelName(modelName);
    const eventModel = normalizeModelName(eventGeminiModel);
    const globalModel = normalizeModelName(gemini_model);
    const model = requestModel || eventModel || globalModel || NANO_BANANA_21;
    const modelSource = requestModel ? 'request' : eventModel ? 'event' : globalModel ? 'global' : 'default';
    const imageResolution = resolution || gemini_resolution || '2K';
    const geminiAspectRatio = mapAspectRatioToGemini(aspectRatio);
    const aspectRatioSpec = getAspectRatioSpec(aspectRatio);

    // Construct prompt for Gemini image editing
    // Image 1 is always the source photo (sent first in the parts array below).
    // Reference images are sent AFTER the text prompt so Gemini clearly separates them.
    let finalPrompt = `Image 1 (sent first in this request) is the SOURCE PHOTO containing the person to transform. `;
    finalPrompt += `Transform the person in Image 1 into the following style: ${promptTemplate}. `;
    finalPrompt += `You MUST preserve the exact face, facial features, and identity of the person in Image 1. The output face must match Image 1. `;
    finalPrompt += `Change the clothing, background, and artistic style to match the description, but never alter the face. `;
    finalPrompt += `If you cannot determine which image is the source, default to using the first image provided. Never use any face except the one in the first image. `;
    finalPrompt += `Output format: ${aspectRatioSpec}.`;

    // Build parts array for multimodal request
    const parts: GeminiPart[] = [];

    // Add original image FIRST - always use File API (fileUri > URL > base64)
    if (imageFileUri) {
      parts.push({
        fileData: {
          mimeType: 'image/jpeg',
          fileUri: imageFileUri
        }
      });
    } else if (imageUrl) {
      const { uri, mimeType: srcMime } = await uploadUrlToGemini(imageUrl);
      parts.push({
        fileData: {
          mimeType: srcMime,
          fileUri: uri
        }
      });
    } else if (cleanBase64) {
      const { uri, mimeType: srcMime } = await uploadBase64ToGemini(cleanBase64, 'image/jpeg');
      parts.push({
        fileData: {
          mimeType: srcMime,
          fileUri: uri
        }
      });
    }

    // Push the text prompt BEFORE reference images so Gemini associates
    // identity instructions with Image 1 and treats later images as style only.
    parts.push({ text: finalPrompt });

    // Track whether any reference images were added
    let hasReference = false;

    // Add reference images AFTER the text prompt - multiple references with strength, or single legacy reference
    if (referenceImages && referenceImages.length > 0) {
      for (let i = 0; i < referenceImages.length; i++) {
        const ref = referenceImages[i];
        if (ref.url) {
          const { uri, mimeType: refMime } = await uploadUrlToGemini(ref.url);
          parts.push({
            fileData: {
              mimeType: refMime,
              fileUri: uri
            }
          });
        }
        const strength = ref.strength ?? 30;
        const imageNum = i + 2;
        finalPrompt += ` Image ${imageNum} (sent after the source) is a REFERENCE IMAGE. Apply the artistic style from Image ${imageNum} at ${strength}% intensity. Style means colors, lighting, and atmosphere only -- never facial features.`;
      }
      hasReference = true;
    } else if (referenceFileUri) {
      parts.push({
        fileData: {
          mimeType: 'image/jpeg',
          fileUri: referenceFileUri
        }
      });
      finalPrompt += ` Image 2 (sent after the source) is a REFERENCE IMAGE. Apply the artistic style from Image 2 at 30% intensity. Style means colors, lighting, and atmosphere only -- never facial features.`;
      hasReference = true;
    } else if (referenceImageUrl) {
      const { uri, mimeType: refMime } = await uploadUrlToGemini(referenceImageUrl);
      parts.push({
        fileData: {
          mimeType: refMime,
          fileUri: uri
        }
      });
      finalPrompt += ` Image 2 (sent after the source) is a REFERENCE IMAGE. Apply the artistic style from Image 2 at 30% intensity. Style means colors, lighting, and atmosphere only -- never facial features.`;
      hasReference = true;
    } else if (cleanRefBase64) {
      const { uri, mimeType: refMime } = await uploadBase64ToGemini(cleanRefBase64, 'image/jpeg');
      parts.push({
        fileData: {
          mimeType: refMime,
          fileUri: uri
        }
      });
      finalPrompt += ` Image 2 (sent after the source) is a REFERENCE IMAGE. Apply the artistic style from Image 2 at 30% intensity. Style means colors, lighting, and atmosphere only -- never facial features.`;
      hasReference = true;
    }

    // Add hard negative face-transfer constraint when reference images are present
    if (hasReference) {
      finalPrompt += ` Under no circumstances should the output contain any facial features, face shape, skin tone, or identity from the reference image(s). The reference is for lighting, color, and atmosphere ONLY.`;
      // Update the text part with the complete prompt (including reference instructions)
      parts[1] = { text: finalPrompt };
    }

    console.log('Calling Gemini API with model:', model, 'source:', modelSource, {
      requestModel: modelName ?? null,
      eventModel: eventGeminiModel,
      globalModel: gemini_model ?? null,
      eventId: eventIdValue || null,
    });
    console.log('Aspect ratio:', geminiAspectRatio);
    console.log('Resolution:', imageResolution);
    console.log('Prompt:', finalPrompt);

    // Build imageConfig — only include imageSize if it's a valid value
    const imageConfigObj: Record<string, string> = {
      aspectRatio: geminiAspectRatio,
    };
    // imageSize must be exactly "512", "1K", "2K", or "4K" (uppercase K required).
    // Sent for every model, including gemini-nano-banana-2.1. No model-name allowlist.
    if (imageResolution && ['512', '1K', '2K', '4K'].includes(imageResolution)) {
      imageConfigObj.imageSize = imageResolution;
    }

    const requestBody = {
      contents: [{
        role: "user",
        parts: parts
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: imageConfigObj
      }
    };

    console.log('Request body (without image data):', JSON.stringify({
      ...requestBody,
      contents: [{
        role: requestBody.contents[0].role,
        parts: requestBody.contents[0].parts.map((p: GeminiPart) =>
          p.inlineData ? { inlineData: { mimeType: p.inlineData.mimeType, data: '[BASE64]' } } :
          p.fileData ? { fileData: p.fileData } :
          p
        )
      }]
    }));

    const callGenerateContent = (modelToCall: string) => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToCall)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': gemini_api_key,
        },
        body: JSON.stringify(requestBody)
      }
    );

    // Call Gemini API for image editing
    let activeModel = model;
    let geminiResponse = await callGenerateContent(activeModel);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error Status:', geminiResponse.status);
      console.error('Gemini API Error Body:', errorText);

      const canFallback = activeModel !== NANO_BANANA_2 && isMissingOrUnsupportedModel(geminiResponse.status, errorText);
      if (!canFallback) {
        return new Response(
          JSON.stringify({
            error: `Gemini API error (${geminiResponse.status})`,
            detail: errorText,
            model: activeModel,
            success: false
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.warn(
        `Gemini model fallback: "${activeModel}" returned ${geminiResponse.status} (model not found or unsupported). Retrying once with ${NANO_BANANA_2}.`
      );
      activeModel = NANO_BANANA_2;
      geminiResponse = await callGenerateContent(activeModel);

      if (!geminiResponse.ok) {
        const fallbackErrorText = await geminiResponse.text();
        console.error('Gemini fallback error status:', geminiResponse.status);
        console.error('Gemini fallback error body:', fallbackErrorText);
        return new Response(
          JSON.stringify({
            error: `Gemini API error (${geminiResponse.status})`,
            detail: fallbackErrorText,
            model: activeModel,
            fallbackFrom: model,
            success: false
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    const geminiResult = await geminiResponse.json();
    console.log('Gemini result structure:', JSON.stringify({
      candidates: geminiResult.candidates?.length,
      finishReason: geminiResult.candidates?.[0]?.finishReason,
      parts: geminiResult.candidates?.[0]?.content?.parts?.map((p: GeminiPart) => p.inlineData ? 'image' : p.text ? 'text' : 'other')
    }));

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
      const finishReason = geminiResult.candidates?.[0]?.finishReason;
      console.error('No image in response. Full result:', JSON.stringify(geminiResult).substring(0, 2000));
      throw new Error(`No image generated. Finish reason: ${finishReason || 'unknown'}`);
    }

    if (activeModel !== model) {
      console.log(`Gemini model fallback succeeded. Requested ${model}, generated with ${activeModel}.`);
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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return new Response(
      JSON.stringify({
        error: errorMessage,
        stack: errorStack,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
