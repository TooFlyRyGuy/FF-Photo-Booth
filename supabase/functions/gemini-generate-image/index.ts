import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateImageRequest {
  imageBase64?: string;
  imageUrl?: string;
  imageFileUri?: string;
  promptTemplate: string;
  referenceImageBase64?: string;
  referenceImageUrl?: string;
  referenceFileUri?: string;
  aspectRatio?: '3:4' | '4:3' | '9:16' | '16:9' | 'square';
  modelName?: string;
  resolution?: '1K' | '2K' | '4K';
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
      aspectRatio,
      modelName,
      resolution
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

    // Helper function to upload URL to Gemini File API, returns {uri, mimeType}
    async function uploadUrlToGemini(url: string): Promise<{ uri: string; mimeType: string }> {
      console.log(`Uploading URL to Gemini File API: ${url}`);

      // Download the image first
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`);
      }

      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      // Normalize mimeType — Gemini only accepts image/jpeg, image/png, image/webp, image/gif
      const rawMime = imageBlob.type || "image/jpeg";
      const mimeType = rawMime.startsWith('image/') ? rawMime : "image/jpeg";

      console.log(`Image downloaded, size: ${imageBuffer.byteLength} bytes, type: ${mimeType}`);

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

    // Sanitize base64 strings (for backward compatibility)
    const cleanBase64 = imageBase64?.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
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

    const model = modelName || gemini_model || 'gemini-3.1-flash-image-preview';
    const imageResolution = resolution || gemini_resolution || '2K';
    const geminiAspectRatio = mapAspectRatioToGemini(aspectRatio);
    const aspectRatioSpec = getAspectRatioSpec(aspectRatio);

    // Construct prompt for Gemini image editing
    let finalPrompt = `Transform the person in this photo into the following style: ${promptTemplate}. `;
    finalPrompt += `Maintain the person's facial features and identity, but change the clothing, background, and artistic style to match the description. `;
    finalPrompt += `Output format: ${aspectRatioSpec}.`;

    // Build parts array for multimodal request
    const parts: GeminiPart[] = [];

    // Add original image - prioritize fileUri > URL > base64
    if (imageFileUri) {
      parts.push({
        fileData: {
          mimeType: 'image/jpeg',
          fileUri: imageFileUri
        }
      });
    } else if (imageUrl) {
      // Download image and send as inline base64 — more reliable than File API for small images
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error(`Failed to download image: ${imgResp.statusText}`);
      const imgBuffer = await imgResp.arrayBuffer();
      const rawMime = imgResp.headers.get('content-type') || 'image/jpeg';
      const imgMime = rawMime.split(';')[0].trim();
      const imgBytes = new Uint8Array(imgBuffer);
      let binary = '';
      for (let i = 0; i < imgBytes.byteLength; i++) binary += String.fromCharCode(imgBytes[i]);
      const imgBase64 = btoa(binary);
      console.log(`Image downloaded for inline: ${imgBuffer.byteLength} bytes, type: ${imgMime}`);
      parts.push({
        inlineData: {
          mimeType: imgMime,
          data: imgBase64
        }
      });
    } else if (cleanBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    // Add reference image if provided - prioritize fileUri > URL > base64
    if (referenceFileUri) {
      parts.push({
        fileData: {
          mimeType: 'image/jpeg',
          fileUri: referenceFileUri
        }
      });
      finalPrompt += " Use the second image as a style reference for color palette, lighting, and composition.";
    } else if (referenceImageUrl) {
      const { uri, mimeType: refMime } = await uploadUrlToGemini(referenceImageUrl);
      parts.push({
        fileData: {
          mimeType: refMime,
          fileUri: uri
        }
      });
      finalPrompt += " Use the second image as a style reference for color palette, lighting, and composition.";
    } else if (cleanRefBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanRefBase64
        }
      });
      finalPrompt += " Use the second image as a style reference for color palette, lighting, and composition.";
    }

    parts.push({ text: finalPrompt });

    console.log('Calling Gemini API with model:', model);
    console.log('Aspect ratio:', geminiAspectRatio);
    console.log('Resolution:', imageResolution);
    console.log('Prompt:', finalPrompt);

    // Build imageConfig — only include imageSize if it's a valid value
    const imageConfigObj: Record<string, string> = {
      aspectRatio: geminiAspectRatio,
    };
    // imageSize must be exactly "512", "1K", "2K", or "4K" (uppercase K required)
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

    // Call Gemini API for image editing
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': gemini_api_key,
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error Status:', geminiResponse.status);
      console.error('Gemini API Error Body:', errorText);
      return new Response(
        JSON.stringify({
          error: `Gemini API error (${geminiResponse.status})`,
          detail: errorText,
          model,
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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
