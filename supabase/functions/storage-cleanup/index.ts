import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CleanupStats {
  totalFiles: number;
  deletedFiles: number;
  failedDeletions: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const stats: CleanupStats = {
      totalFiles: 0,
      deletedFiles: 0,
      failedDeletions: 0,
      errors: [],
    };

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 48);
    const cutoffTimestamp = cutoffDate.toISOString();

    console.log(`Cleaning up files older than: ${cutoffTimestamp}`);

    const listResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/list/temp-booth-images`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefix: "",
          limit: 1000,
          sortBy: { column: "created_at", order: "asc" },
        }),
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      throw new Error(`Failed to list files: ${errorText}`);
    }

    const files = await listResponse.json();
    stats.totalFiles = files.length;

    console.log(`Found ${files.length} files in bucket`);

    const filesToDelete: string[] = [];

    for (const file of files) {
      const fileCreatedAt = new Date(file.created_at);
      if (fileCreatedAt < cutoffDate) {
        filesToDelete.push(file.name);
      }
    }

    console.log(`Deleting ${filesToDelete.length} old files...`);

    if (filesToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < filesToDelete.length; i += batchSize) {
        const batch = filesToDelete.slice(i, i + batchSize);

        const deleteResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/temp-booth-images`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prefixes: batch,
            }),
          }
        );

        if (deleteResponse.ok) {
          stats.deletedFiles += batch.length;
          console.log(`Deleted batch of ${batch.length} files`);
        } else {
          const errorText = await deleteResponse.text();
          stats.failedDeletions += batch.length;
          stats.errors.push(`Batch deletion failed: ${errorText}`);
          console.error(`Failed to delete batch: ${errorText}`);
        }
      }
    }

    console.log("Cleanup complete:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Cleanup completed. Deleted ${stats.deletedFiles} of ${filesToDelete.length} old files.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in storage-cleanup:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
