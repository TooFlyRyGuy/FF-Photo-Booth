import { useState } from 'react';
import { supabase, Photo } from '../lib/supabase';
import '../styles/Gallery.css';

interface GalleryProps {
  photos: Photo[];
  onRefresh: () => void;
}

const Gallery = ({ photos, onRefresh }: GalleryProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const getPhotoUrl = (filePath: string) => {
    const { data } = supabase.storage.from('photo-booth').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      const url = getPhotoUrl(photo.file_path);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `fun-frame-${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading photo:', error);
      alert('Failed to download photo');
    }
  };

  const sharePhoto = async (photo: Photo) => {
    const url = getPhotoUrl(photo.file_path);

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fun Frame AI Booth Photo',
          text: 'Check out my photo from Fun Frame AI Booth!',
          url: url,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing photo:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Photo link copied to clipboard!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        alert('Failed to copy link');
      }
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('photo-booth')
        .remove([photo.file_path]);

      if (storageError) {
        throw storageError;
      }

      const { error: dbError } = await supabase.from('photos').delete().eq('id', photo.id);

      if (dbError) {
        throw dbError;
      }

      setSelectedPhoto(null);
      onRefresh();
      alert('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo');
    }
  };

  if (photos.length === 0) {
    return (
      <div className="gallery empty">
        <div className="empty-state">
          <span className="empty-icon">📷</span>
          <h2>No photos yet</h2>
          <p>Capture your first photo in the booth!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2>Photo Gallery</h2>
        <button onClick={onRefresh} className="refresh-btn">
          Refresh
        </button>
      </div>

      <div className="photo-grid">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="photo-card"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={getPhotoUrl(photo.file_path)}
              alt={`Photo with ${photo.frame_style} frame`}
              className="photo-thumbnail"
            />
            <div className="photo-info">
              <span className="frame-badge">{photo.frame_style}</span>
              <span className="photo-date">
                {new Date(photo.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPhoto(null)}>
              &times;
            </button>

            <img
              src={getPhotoUrl(selectedPhoto.file_path)}
              alt="Selected photo"
              className="modal-image"
            />

            <div className="modal-actions">
              <button
                onClick={() => downloadPhoto(selectedPhoto)}
                className="action-btn download"
              >
                Download
              </button>
              <button
                onClick={() => sharePhoto(selectedPhoto)}
                className="action-btn share"
              >
                Share
              </button>
              <button
                onClick={() => deletePhoto(selectedPhoto)}
                className="action-btn delete"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
