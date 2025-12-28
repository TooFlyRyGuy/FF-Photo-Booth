import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MigrationResult {
  totalFiles: number;
  converted: number;
  failed: string[];
  updatedRecords: {
    prompts: number;
    generatedImages: number;
    events: number;
    galleryUploads: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: MigrationResult = {
      totalFiles: 0,
      converted: 0,
      failed: [],
      updatedRecords: {
        prompts: 0,
        generatedImages: 0,
        events: 0,
        galleryUploads: 0,
      },
    };

    const allFiles: string[] = [];

    async function listAllFiles(prefix: string = ''): Promise<void> {
      const { data: items, error } = await supabase.storage
        .from('prompt-images')
        .list(prefix, { limit: 1000 });

      if (error) {
        console.warn(`Failed to list files in ${prefix}: ${error.message}`);
        return;
      }

      if (!items) return;

      for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

        if (item.id === null) {
          await listAllFiles(fullPath);
        } else if (item.name.toLowerCase().endsWith('.png')) {
          allFiles.push(fullPath);
        }
      }
    }

    await listAllFiles();

    result.totalFiles = allFiles.length;
    console.log(`Found ${allFiles.length} PNG files to convert`);

    for (const filePath of allFiles) {
      try {
        console.log(`Converting: ${filePath}`);

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('prompt-images')
          .download(filePath);

        if (downloadError || !fileData) {
          result.failed.push(`${filePath}: Download failed - ${downloadError?.message}`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        const pngDataUrl = `data:image/png;base64,${base64}`;

        const jpgDataUrl = await convertToJpeg(pngDataUrl);

        const jpgBlob = dataUrlToBlob(jpgDataUrl);
        const jpgPath = filePath.replace(/\.png$/i, '.jpg');

        const { error: uploadError } = await supabase.storage
          .from('prompt-images')
          .upload(jpgPath, jpgBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          result.failed.push(`${filePath}: Upload failed - ${uploadError.message}`);
          continue;
        }

        const oldUrl = `${supabaseUrl}/storage/v1/object/public/prompt-images/${filePath}`;
        const newUrl = `${supabaseUrl}/storage/v1/object/public/prompt-images/${jpgPath}`;

        const { count: promptsCount } = await supabase
          .from('prompts')
          .update({
            preview_image_url: newUrl,
          })
          .eq('preview_image_url', oldUrl);

        result.updatedRecords.prompts += promptsCount || 0;

        const { count: promptsRefCount } = await supabase
          .from('prompts')
          .update({
            reference_image_url: newUrl,
          })
          .eq('reference_image_url', oldUrl);

        result.updatedRecords.prompts += promptsRefCount || 0;

        const { count: promptsCompCount } = await supabase
          .from('prompts')
          .update({
            preview_image_compressed: newUrl,
          })
          .eq('preview_image_compressed', oldUrl);

        result.updatedRecords.prompts += promptsCompCount || 0;

        const { count: promptsRefCompCount } = await supabase
          .from('prompts')
          .update({
            reference_image_compressed: newUrl,
          })
          .eq('reference_image_compressed', oldUrl);

        result.updatedRecords.prompts += promptsRefCompCount || 0;

        const { count: genImagesOrigCount } = await supabase
          .from('generated_images')
          .update({
            original_image_url: newUrl,
          })
          .eq('original_image_url', oldUrl);

        result.updatedRecords.generatedImages += genImagesOrigCount || 0;

        const { count: genImagesGenCount } = await supabase
          .from('generated_images')
          .update({
            generated_image_url: newUrl,
          })
          .eq('generated_image_url', oldUrl);

        result.updatedRecords.generatedImages += genImagesGenCount || 0;

        const { count: eventsBgCount } = await supabase
          .from('events')
          .update({
            background_image_url: newUrl,
          })
          .eq('background_image_url', oldUrl);

        result.updatedRecords.events += eventsBgCount || 0;

        const { count: eventsOverlayCount } = await supabase
          .from('events')
          .update({
            overlay_image_url: newUrl,
          })
          .eq('overlay_image_url', oldUrl);

        result.updatedRecords.events += eventsOverlayCount || 0;

        const { count: galleryCount } = await supabase
          .from('gallery_uploads')
          .update({
            image_url: newUrl,
          })
          .eq('image_url', oldUrl);

        result.updatedRecords.galleryUploads += galleryCount || 0;

        const { error: deleteError } = await supabase.storage
          .from('prompt-images')
          .remove([filePath]);

        if (deleteError) {
          console.warn(`Failed to delete old PNG ${filePath}: ${deleteError.message}`);
        }

        result.converted++;
        console.log(`✅ Converted ${filePath} -> ${jpgPath}`);
      } catch (error) {
        result.failed.push(`${filePath}: ${error.message}`);
        console.error(`Failed to convert ${filePath}:`, error);
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
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

async function convertToJpeg(pngDataUrl: string): Promise<string> {
  const response = await fetch(pngDataUrl);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const pngBytes = new Uint8Array(arrayBuffer);

  const canvas = new OffscreenCanvas(1, 1);
  const img = await createImageBitmap(blob);

  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0);

  const jpgBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.92,
  });

  const jpgArrayBuffer = await jpgBlob.arrayBuffer();
  const jpgBase64 = btoa(
    new Uint8Array(jpgArrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    )
  );

  return `data:image/jpeg;base64,${jpgBase64}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}
