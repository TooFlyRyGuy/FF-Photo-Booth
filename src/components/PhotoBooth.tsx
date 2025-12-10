import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { supabase, Photo } from '../lib/supabase';
import FrameSelector from './FrameSelector';
import '../styles/PhotoBooth.css';

interface PhotoBoothProps {
  sessionId: string;
  onPhotoCapture: (photo: Photo) => void;
}

const PhotoBooth = ({ sessionId, onPhotoCapture }: PhotoBoothProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [selectedFrame, setSelectedFrame] = useState('classic');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: 'user',
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
      }
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImage(null);
  };

  const savePhoto = async () => {
    if (!capturedImage) return;

    setIsUploading(true);

    try {
      const base64Data = capturedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `${sessionId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('photo-booth')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert({
          file_path: fileName,
          frame_style: selectedFrame,
          session_id: sessionId,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      onPhotoCapture(photoData);
      setCapturedImage(null);
      alert('Photo saved successfully!');
    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Failed to save photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUserMediaError = () => {
    setCameraError(true);
  };

  if (cameraError) {
    return (
      <div className="photo-booth error-state">
        <div className="error-message">
          <h2>Camera Access Required</h2>
          <p>Please allow camera access to use the photo booth.</p>
          <p>Refresh the page and grant camera permissions when prompted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-booth">
      <div className="booth-container">
        <div className="camera-section">
          <div className={`camera-frame frame-${selectedFrame}`}>
            {capturedImage ? (
              <img src={capturedImage} alt="Captured" className="captured-image" />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={handleUserMediaError}
                className="webcam"
              />
            )}
          </div>

          <div className="controls">
            {capturedImage ? (
              <div className="capture-controls">
                <button onClick={retake} className="btn btn-secondary">
                  Retake
                </button>
                <button
                  onClick={savePhoto}
                  className="btn btn-primary"
                  disabled={isUploading}
                >
                  {isUploading ? 'Saving...' : 'Save Photo'}
                </button>
              </div>
            ) : (
              <button onClick={capture} className="btn btn-capture">
                Capture Photo
              </button>
            )}
          </div>
        </div>

        <FrameSelector
          selectedFrame={selectedFrame}
          onSelectFrame={setSelectedFrame}
          disabled={!!capturedImage}
        />
      </div>
    </div>
  );
};

export default PhotoBooth;
