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

    // --- Phase 1: Clean temp-booth-images bucket (48-hour cutoff) ---
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 48);
    const cutoffTimestamp = cutoffDate.toISOString();

    console.log(`[temp-booth-images] Cleaning up files older than: ${cutoffTimestamp}`);

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
      stats.errors.push(`temp-booth-images list failed: ${errorText}`);
      console.error(`Failed to list temp-booth-images files: ${errorText}`);
    } else {
      const files = await listResponse.json();
      stats.totalFiles = files.length;
      console.log(`[temp-booth-images] Found ${files.length} files`);

      const filesToDelete: string[] = [];
      for (const file of files) {
        const fileCreatedAt = new Date(file.created_at);
        if (fileCreatedAt < cutoffDate) {
          filesToDelete.push(file.name);
        }
      }

      console.log(`[temp-booth-images] Deleting ${filesToDelete.length} old files...`);

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
              body: JSON.stringify({ prefixes: batch }),
            }
          );
          if (deleteResponse.ok) {
            stats.deletedFiles += batch.length;
          } else {
            const errorText = await deleteResponse.text();
            stats.failedDeletions += batch.length;
            stats.errors.push(`temp-booth-images batch deletion failed: ${errorText}`);
            console.error(`Failed to delete temp batch: ${errorText}`);
          }
        }
      }
    }

    // --- Phase 2: Clean event-photos bucket based on retention_expires_at ---
    const nowIso = new Date().toISOString();
    console.log(`[event-photos] Cleaning up photos expired before: ${nowIso}`);

    // Query event_photos for expired records (retention_expires_at is not null and has passed)
    const expiredResponse = await fetch(
      `${supabaseUrl}/rest/v1/event_photos?select=id,storage_path,overlay_storage_path&retention_expires_at=not.is.null&retention_expires_at=lt.${nowIso}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!expiredResponse.ok) {
      const errorText = await expiredResponse.text();
      stats.errors.push(`event_photos query failed: ${errorText}`);
      console.error(`Failed to query expired event_photos: ${errorText}`);
    } else {
      const expiredRecords = await expiredResponse.json();
      console.log(`[event-photos] Found ${expiredRecords.length} expired photo records`);

      // Collect all storage paths to delete (both clean and overlay paths)
      const pathsToDelete: string[] = [];
      const recordIdsToDelete: string[] = [];

      for (const record of expiredRecords) {
        recordIdsToDelete.push(record.id);
        if (record.storage_path) {
          pathsToDelete.push(record.storage_path);
        }
        if (record.overlay_storage_path && record.overlay_storage_path !== record.storage_path) {
          pathsToDelete.push(record.overlay_storage_path);
        }
      }

      // Delete files from event-photos bucket
      if (pathsToDelete.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < pathsToDelete.length; i += batchSize) {
          const batch = pathsToDelete.slice(i, i + batchSize);
          const deleteResponse = await fetch(
            `${supabaseUrl}/storage/v1/object/event-photos`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ prefixes: batch }),
            }
          );
          if (deleteResponse.ok) {
            stats.deletedFiles += batch.length;
            console.log(`[event-photos] Deleted batch of ${batch.length} files`);
          } else {
            const errorText = await deleteResponse.text();
            stats.failedDeletions += batch.length;
            stats.errors.push(`event-photos batch deletion failed: ${errorText}`);
            console.error(`Failed to delete event-photos batch: ${errorText}`);
          }
        }
      }

      // Delete the database records
      if (recordIdsToDelete.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < recordIdsToDelete.length; i += batchSize) {
          const batch = recordIdsToDelete.slice(i, i + batchSize);
          const inFilter = `in.(${batch.map((id) => `"${id}"`).join(",")})`;
          const deleteRecordResponse = await fetch(
            `${supabaseUrl}/rest/v1/event_photos?id=${inFilter}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
                "Content-Type": "application/json",
              },
            }
          );
          if (!deleteRecordResponse.ok) {
            const errorText = await deleteRecordResponse.text();
            stats.errors.push(`event_photos record deletion failed: ${errorText}`);
            console.error(`Failed to delete event_photos records: ${errorText}`);
          } else {
            console.log(`[event-photos] Deleted ${batch.length} expired records`);
          }
        }
      }
    }

    console.log("Cleanup complete:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Cleanup completed. Deleted ${stats.deletedFiles} files (${stats.failedDeletions} failures).`,
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
