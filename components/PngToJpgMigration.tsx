import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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

export function PngToJpgMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to run this migration');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-png-to-jpg`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Migration failed');
      }

      const migrationResult = await response.json();
      setResult(migrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">PNG to JPG Migration</h2>

      <p className="mb-4 text-gray-600">
        This tool will convert all PNG images in your storage to JPG format.
        It will update all database references and delete the old PNG files.
      </p>

      <button
        onClick={runMigration}
        disabled={isRunning}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isRunning ? 'Running Migration...' : 'Start Migration'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-3">Migration Complete!</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Total PNG Files Found:</span>
              <span className="font-bold">{result.totalFiles}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-medium">Successfully Converted:</span>
              <span className="font-bold text-green-600">{result.converted}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-medium">Failed:</span>
              <span className="font-bold text-red-600">{result.failed.length}</span>
            </div>

            <div className="mt-4 pt-4 border-t border-green-300">
              <h4 className="font-semibold mb-2">Database Records Updated:</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span>Prompts:</span>
                  <span className="font-bold">{result.updatedRecords.prompts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Generated Images:</span>
                  <span className="font-bold">{result.updatedRecords.generatedImages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Events:</span>
                  <span className="font-bold">{result.updatedRecords.events}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gallery Uploads:</span>
                  <span className="font-bold">{result.updatedRecords.galleryUploads}</span>
                </div>
              </div>
            </div>

            {result.failed.length > 0 && (
              <div className="mt-4 pt-4 border-t border-green-300">
                <h4 className="font-semibold mb-2 text-red-800">Failed Files:</h4>
                <div className="pl-4 space-y-1 max-h-40 overflow-y-auto">
                  {result.failed.map((failure, index) => (
                    <div key={index} className="text-xs text-red-600">
                      {failure}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
