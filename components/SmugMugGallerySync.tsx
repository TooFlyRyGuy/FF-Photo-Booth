import React, { useState } from 'react';
import { Link, ExternalLink, RefreshCw, ShieldAlert, Save } from 'lucide-react';

interface SmugMugGallerySyncProps {
  eventId: string;
  eventName: string;
  currentGalleryKey?: string;
  currentGalleryUrl?: string;
  onSync: (galleryKey: string, galleryUrl: string) => Promise<void>;
  onCreateNew: () => Promise<{ galleryKey: string; galleryUrl: string }>;
  onUpdateUrl: (galleryUrl: string) => Promise<void>;
  isAdmin: boolean;
}

export function SmugMugGallerySync({
  eventId,
  eventName,
  currentGalleryKey,
  currentGalleryUrl,
  onSync,
  onCreateNew,
  onUpdateUrl,
  isAdmin,
}: SmugMugGallerySyncProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [manualGalleryKey, setManualGalleryKey] = useState('');
  const [manualGalleryUrl, setManualGalleryUrl] = useState('');
  const [showManualSync, setShowManualSync] = useState(false);
  const [editableUrl, setEditableUrl] = useState(currentGalleryUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="text-gray-400" size={20} />
          <h3 className="text-lg font-semibold text-gray-600">SmugMug Gallery Management</h3>
        </div>
        <p className="text-sm text-gray-500">
          SmugMug gallery management is only available to administrators.
        </p>
      </div>
    );
  }

  const handleCreateNew = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const { galleryKey, galleryUrl } = await onCreateNew();
      setSuccess(`Gallery created successfully! Key: ${galleryKey}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gallery');
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      await onSync(manualGalleryKey, manualGalleryUrl);
      setSuccess('Gallery synced successfully!');
      setManualGalleryKey('');
      setManualGalleryUrl('');
      setShowManualSync(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync gallery');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Link className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold">SmugMug Gallery</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {currentGalleryKey && currentGalleryUrl ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gallery Key
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentGalleryKey}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gallery URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={editableUrl}
                onChange={(e) => setEditableUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.smugmug.com/..."
              />
              <button
                onClick={async () => {
                  if (!editableUrl) return;
                  setIsSavingUrl(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await onUpdateUrl(editableUrl);
                    setSuccess('Gallery URL updated successfully!');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to update gallery URL');
                    setEditableUrl(currentGalleryUrl || '');
                  } finally {
                    setIsSavingUrl(false);
                  }
                }}
                disabled={isSavingUrl || editableUrl === currentGalleryUrl}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                title="Save URL"
              >
                {isSavingUrl ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save</span>
              </button>
              <a
                href={editableUrl || currentGalleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center gap-2"
              >
                <ExternalLink size={16} />
                <span>Open</span>
              </a>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Edit this URL if your SmugMug gallery link changed. The gallery key (used for uploads) stays the same.
            </p>
          </div>

          <button
            onClick={() => setShowManualSync(!showManualSync)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showManualSync ? 'Hide Manual Sync' : 'Update Gallery Link'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            No SmugMug gallery linked to this event.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Link size={16} />
                  <span>Create New Gallery</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowManualSync(!showManualSync)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {showManualSync ? 'Cancel' : 'Link Existing Gallery'}
            </button>
          </div>
        </div>
      )}

      {showManualSync && (
        <form onSubmit={handleManualSync} className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div>
            <label htmlFor="galleryKey" className="block text-sm font-medium text-gray-700 mb-1">
              Gallery Key
            </label>
            <input
              type="text"
              id="galleryKey"
              value={manualGalleryKey}
              onChange={(e) => setManualGalleryKey(e.target.value)}
              placeholder="/api/v2/album/ABC123"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              The SmugMug album API path (e.g., /api/v2/album/ABC123)
            </p>
          </div>

          <div>
            <label htmlFor="galleryUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Gallery URL
            </label>
            <input
              type="url"
              id="galleryUrl"
              value={manualGalleryUrl}
              onChange={(e) => setManualGalleryUrl(e.target.value)}
              placeholder="https://www.smugmug.com/..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              The public URL to view the gallery
            </p>
          </div>

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Link size={16} />
                <span>Sync Gallery</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
