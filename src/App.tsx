import { useState, useEffect } from 'react';
import PhotoBooth from './components/PhotoBooth';
import Gallery from './components/Gallery';
import { supabase, Photo } from './lib/supabase';
import './styles/App.css';

function App() {
  const [view, setView] = useState<'booth' | 'gallery'>('booth');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading photos:', error);
    } else {
      setPhotos(data || []);
    }
  };

  const handlePhotoCapture = async (photoData: Photo) => {
    setPhotos((prev) => [photoData, ...prev]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fun Frame AI Booth</h1>
        <p className="tagline">Capture memories with style</p>
        <nav className="nav-buttons">
          <button
            className={`nav-btn ${view === 'booth' ? 'active' : ''}`}
            onClick={() => setView('booth')}
          >
            Photo Booth
          </button>
          <button
            className={`nav-btn ${view === 'gallery' ? 'active' : ''}`}
            onClick={() => setView('gallery')}
          >
            Gallery ({photos.length})
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'booth' ? (
          <PhotoBooth sessionId={sessionId} onPhotoCapture={handlePhotoCapture} />
        ) : (
          <Gallery photos={photos} onRefresh={loadPhotos} />
        )}
      </main>
    </div>
  );
}

export default App;
