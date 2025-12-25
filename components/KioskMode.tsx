import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Smartphone, Send, Download, Check, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Event, Prompt, GeneratedImage, Tenant } from '../types';
import { generateBoothImage } from '../services/geminiService';
import { sendSms, saveGeneratedImage, getTenantById, getGlobalSetting } from '../services/backendService';
import { uploadImageToDropbox } from '../services/dropboxService';
import { applyOverlayToImage } from '../services/imageUtils';

interface KioskProps {
  event: Event;
  onExit: () => void;
}

type KioskState = 'attract' | 'prompt-select' | 'camera' | 'review' | 'processing' | 'result' | 'delivery';

const KioskMode: React.FC<KioskProps> = ({ event, onExit }) => {
  const [view, setView] = useState<KioskState>('attract');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [eventTimeStatus, setEventTimeStatus] = useState<'before' | 'active' | 'after'>('active');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const checkEventTimeStatus = useCallback(() => {
    const now = new Date();

    if (event.startDatetime) {
      const startTime = new Date(event.startDatetime);
      if (now < startTime) {
        return 'before';
      }
    }

    if (event.endDatetime) {
      const endTime = new Date(event.endDatetime);
      if (now > endTime) {
        return 'after';
      }
    }

    return 'active';
  }, [event.startDatetime, event.endDatetime]);

  const getBrandingColors = () => ({
    primary: event.primaryColor || '#6366f1',
    secondary: event.secondaryColor || '#8b5cf6',
    accent: event.accentColor || '#ec4899',
    background: event.backgroundColor || '#f8fafc',
  });

  const getAspectRatioDimensions = (ratio: string = 'square'): { width: number; height: number } => {
    const baseSize = 1024;
    switch (ratio) {
      case 'square': return { width: baseSize, height: baseSize };
      case '3:4': return { width: baseSize * 3 / 4, height: baseSize };
      case '4:3': return { width: baseSize, height: baseSize * 3 / 4 };
      case '9:16': return { width: baseSize * 9 / 16, height: baseSize };
      case '16:9': return { width: baseSize, height: baseSize * 9 / 16 };
      default: return { width: baseSize, height: baseSize };
    }
  };

  // --- CAMERA LOGIC ---
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error", err);
      setErrorMsg("Camera access denied.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  const takePhoto = () => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        captureFrame();
      }
    }, 1000);
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const targetDimensions = getAspectRatioDimensions(event.aspectRatio);
        canvas.width = targetDimensions.width;
        canvas.height = targetDimensions.height;

        const videoAspect = video.videoWidth / video.videoHeight;
        const targetAspect = targetDimensions.width / targetDimensions.height;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = video.videoWidth;
        let sourceHeight = video.videoHeight;

        if (videoAspect > targetAspect) {
          sourceWidth = video.videoHeight * targetAspect;
          sourceX = (video.videoWidth - sourceWidth) / 2;
        } else {
          sourceHeight = video.videoWidth / targetAspect;
          sourceY = (video.videoHeight - sourceHeight) / 2;
        }

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, canvas.width, canvas.height
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        setView('review');
        stopCamera();
      }
    }
  };

  // --- GENERATION LOGIC ---
  const handleGenerate = async () => {
    if (!capturedImage || !selectedPrompt) return;

    if (!tenant) {
      setErrorMsg('Configuration not loaded. Please try again.');
      return;
    }

    setView('processing');
    setErrorMsg('');

    try {
      const geminiEnabled = await getGlobalSetting('gemini_enabled');
      const geminiApiKey = await getGlobalSetting('gemini_api_key');

      if (geminiEnabled !== 'true' || !geminiApiKey) {
        setErrorMsg('Gemini AI is not configured. Please contact the administrator.');
        setView('camera');
        return;
      }

      // 1. Upload original image to Dropbox
      let originalUrl = capturedImage;
      if (tenant.dropboxEnabled && tenant.dropboxAppKey && tenant.dropboxAppSecret) {
        try {
          originalUrl = await uploadImageToDropbox({
            tenantId: event.tenantId,
            eventId: event.id,
            eventName: event.name,
            imageBase64: capturedImage,
            imageType: 'original',
            promptName: selectedPrompt.name,
          });
        } catch (dropboxErr) {
          console.error('Dropbox upload failed for original:', dropboxErr);
        }
      }

      // 2. Generate with Gemini
      console.log('🔑 Gemini API Key Check:', {
        hasKey: !!geminiApiKey,
        keyLength: geminiApiKey?.length,
        keyPrefix: geminiApiKey?.substring(0, 5),
        geminiEnabled,
      });

      let genImage = await generateBoothImage(
        capturedImage,
        selectedPrompt.promptText,
        geminiApiKey,
        selectedPrompt.referenceImage,
        event.aspectRatio,
        tenant.geminiModel,
        tenant.geminiResolution
      );

      if (event.overlayImageUrl) {
        try {
          genImage = await applyOverlayToImage(genImage, event.overlayImageUrl);
        } catch (overlayErr) {
          console.error('Failed to apply overlay:', overlayErr);
        }
      }

      setFinalImage(genImage);

      // 3. Upload generated image to Dropbox
      let generatedUrl = genImage;
      if (tenant.dropboxEnabled && tenant.dropboxAppKey && tenant.dropboxAppSecret) {
        try {
          generatedUrl = await uploadImageToDropbox({
            tenantId: event.tenantId,
            eventId: event.id,
            eventName: event.name,
            imageBase64: genImage,
            imageType: 'generated',
            promptName: selectedPrompt.name,
          });
        } catch (dropboxErr) {
          console.error('Dropbox upload failed for generated:', dropboxErr);
        }
      }

      // 4. Save URLs to database
      await saveGeneratedImage(
        event.id,
        selectedPrompt.id,
        event.tenantId,
        originalUrl,
        generatedUrl,
        'completed'
      );

      setGeneratedImageUrl(generatedUrl);
      setView('result');
    } catch (err: any) {
      setErrorMsg(err.message || "AI Generation Failed");
      setView('review');
    }
  };

  // --- SMS LOGIC ---
  const handleSendSms = async () => {
    if (phoneNumber.length < 10 || !generatedImageUrl) return;

    // Check if the URL is a data URL (base64) - cannot be sent via SMS
    if (generatedImageUrl.startsWith('data:')) {
      setErrorMsg('SMS unavailable: Image hosting is not configured. Please download the image instead.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      await sendSms(event.tenantId, phoneNumber, generatedImageUrl, event.id);
      setView('delivery');
      setTimeout(() => {
        resetKiosk();
      }, 5000);
    } catch (error) {
      console.error('SMS send failed:', error);
      setErrorMsg('Failed to send SMS. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const resetKiosk = () => {
    setView('attract');
    setCapturedImage(null);
    setFinalImage(null);
    setGeneratedImageUrl(null);
    setSelectedPrompt(null);
    setPhoneNumber('');
    stopCamera();
  };

  const handleDownload = async () => {
    if (!finalImage) return;

    const filename = `${event.name.replace(/\s+/g, '_')}_${selectedPrompt?.name.replace(/\s+/g, '_')}_${Date.now()}.jpg`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share && navigator.canShare) {
      try {
        const response = await fetch(finalImage);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My AI Photo',
            text: 'Check out my AI-generated photo!',
          });
          return;
        }
      } catch (error) {
        console.error('Web Share failed:', error);
      }
    }

    if (isMobile) {
      window.open(finalImage, '_blank');
    } else {
      try {
        const response = await fetch(finalImage);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
        window.open(finalImage, '_blank');
      }
    }
  };

  // Check event time status on mount and periodically
  useEffect(() => {
    const updateStatus = () => {
      const status = checkEventTimeStatus();
      setEventTimeStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [checkEventTimeStatus]);

  // Fetch tenant data on mount
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenantData = await getTenantById(event.tenantId);
        console.log('🏢 Tenant loaded:', {
          hasGeminiKey: !!tenantData.geminiApiKey,
          geminiKeyLength: tenantData.geminiApiKey?.length,
          geminiEnabled: tenantData.geminiEnabled,
        });
        setTenant(tenantData);
      } catch (err) {
        console.error('Failed to load tenant:', err);
        setErrorMsg('Failed to load configuration. Please contact support.');
      }
    };
    loadTenant();
  }, [event.tenantId]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Start camera when entering camera view
  useEffect(() => {
    if (view === 'camera') startCamera();
  }, [view, startCamera]);

  // --- RENDER VIEWS ---

  // EVENT TIME RESTRICTION SCREENS
  if (eventTimeStatus === 'before') {
    const colors = getBrandingColors();
    const startDate = event.startDatetime ? new Date(event.startDatetime) : null;

    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-gradient-to-br from-green-700 to-green-800"></div>
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className="absolute top-4 left-4 md:top-8 md:left-8 z-20">
            <img src={event.logoUrl} alt={event.name} className="h-12 md:h-24 object-contain" />
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 px-4 max-w-2xl">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            EVENT NOT STARTED
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-slate-900 font-light">
            This event has not started yet
          </p>
          {startDate && (
            <div className="mt-8 p-6 bg-white backdrop-blur-sm rounded-xl border-2 border-slate-300">
              <p className="text-slate-900 text-lg md:text-xl mb-2">Event starts:</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: colors.primary }}>
                {startDate.toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 z-50">
          <button onClick={onExit} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">Exit Kiosk</button>
        </div>
      </div>
    );
  }

  if (eventTimeStatus === 'after') {
    const colors = getBrandingColors();
    const endDate = event.endDatetime ? new Date(event.endDatetime) : null;

    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-gradient-to-br from-green-700 to-green-800"></div>
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className="absolute top-4 left-4 md:top-8 md:left-8 z-20">
            <img src={event.logoUrl} alt={event.name} className="h-12 md:h-24 object-contain" />
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 px-4 max-w-2xl">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            EVENT HAS ENDED
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-slate-900 font-light">
            This event has concluded
          </p>
          {endDate && (
            <div className="mt-8 p-6 bg-white backdrop-blur-sm rounded-xl border-2 border-slate-300">
              <p className="text-slate-900 text-lg md:text-xl mb-2">Event ended:</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: colors.primary }}>
                {endDate.toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          )}
          <p className="text-lg text-slate-700 mt-6">
            Thank you for participating!
          </p>
        </div>
        <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 z-50">
          <button onClick={onExit} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">Exit Kiosk</button>
        </div>
      </div>
    );
  }

  // 1. ATTRACT SCREEN
  if (view === 'attract') {
    const colors = getBrandingColors();
    const backgroundImage = event.backgroundImageUrl || 'https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=2670&auto=format&fit=crop';

    return (
      <div
        onClick={() => setView('prompt-select')}
        className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
           <img src={backgroundImage} className="w-full h-full object-cover animate-pulse-fast" alt="Background" />
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className="absolute top-4 left-4 md:top-8 md:left-8 z-20">
            <img src={event.logoUrl} alt={event.name} className="h-12 md:h-24 object-contain" />
          </div>
        )}

        {!event.hideEventName && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20">
            <h2 className="text-lg md:text-3xl font-bold text-slate-900 drop-shadow-sm">{event.name}</h2>
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 animate-bounce px-4">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            TAP TO START
          </h1>
          <p className="text-base md:text-xl lg:text-2xl text-slate-900 font-light tracking-[0.3em] md:tracking-[0.5em] uppercase">AI Photo Experience</p>
        </div>
        <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 z-50">
           <button onClick={(e) => { e.stopPropagation(); onExit(); }} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">Exit Kiosk</button>
        </div>
      </div>
    );
  }

  // 2. PROMPT SELECT
  if (view === 'prompt-select') {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-4 md:p-8 flex flex-col">
        <h2 className="text-2xl md:text-4xl font-display text-slate-900 mb-4 md:mb-8 text-center">Choose Your Style</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 flex-1 overflow-auto no-scrollbar">
          {event.prompts.map(prompt => (
            <button
              key={prompt.id}
              onClick={() => { setSelectedPrompt(prompt); setView('camera'); }}
              className="relative group rounded-xl md:rounded-2xl overflow-hidden border-2 border-slate-300 transition-all transform active:scale-95 hover:scale-105 min-h-[150px]"
              style={{
                borderColor: '#cbd5e1',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = getBrandingColors().accent}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <img src={prompt.previewImage} alt={prompt.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-3 md:p-6">
                <h3 className="text-base md:text-2xl text-white font-bold">{prompt.name}</h3>
                <p className="text-gray-300 text-xs md:text-sm">{prompt.description}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => setView('attract')} className="mt-4 md:mt-8 text-slate-600 hover:text-slate-900 self-center py-2 px-4">Cancel</button>
      </div>
    );
  }

  // 3. CAMERA & CAPTURE
  if (view === 'camera') {
    const colors = getBrandingColors();
    const getAspectRatioClass = () => {
      const ratio = event.aspectRatio || 'square';
      switch (ratio) {
        case 'square': return 'aspect-square';
        case '3:4': return 'aspect-[3/4]';
        case '4:3': return 'aspect-[4/3]';
        case '9:16': return 'aspect-[9/16]';
        case '16:9': return 'aspect-[16/9]';
        default: return 'aspect-square';
      }
    };

    return (
      <div className="h-screen w-full bg-black relative flex flex-col items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover transform -scale-x-100" />
        <canvas ref={canvasRef} className="hidden" />

        {countdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50">
            <span className="text-[200px] font-bold text-white animate-ping">{countdown}</span>
          </div>
        )}

        <div className="fixed bottom-20 md:bottom-24 left-0 right-0 z-40 flex justify-center gap-4 md:gap-8 items-center px-4">
           <button onClick={() => setView('prompt-select')} className="bg-white/90 backdrop-blur text-slate-900 px-4 py-3 md:p-4 rounded-full hover:bg-white border-2 border-slate-300 text-sm md:text-base min-h-[44px] font-semibold">
             Back
           </button>
           <button
             onClick={takePhoto}
             disabled={!!countdown}
             className="h-16 w-16 md:h-24 md:w-24 rounded-full border-4 md:border-8 active:scale-95 transition-transform"
             style={{
               backgroundColor: 'white',
               borderColor: colors.primary,
               boxShadow: `0 0 30px ${colors.primary}80`,
             }}
           />
        </div>
      </div>
    );
  }

  // 4. PROCESSING (AI)
  if (view === 'processing') {
    const colors = getBrandingColors();
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center justify-center text-slate-900 space-y-4 md:space-y-8 px-4">
        <div className="relative h-32 w-32 md:h-48 md:w-48">
          <div
            className="absolute inset-0 rounded-full border-4 animate-spin"
            style={{
              borderTopColor: colors.primary,
              borderRightColor: 'transparent',
              borderBottomColor: colors.accent,
              borderLeftColor: 'transparent',
            }}
          />
          <div className="absolute inset-2 rounded-full overflow-hidden">
            <img
              src={capturedImage || ''}
              className="w-full h-full object-cover opacity-50 grayscale"
              alt="original"
            />
          </div>
        </div>
        <h2 className="text-2xl md:text-4xl font-display animate-pulse text-center" style={{ color: colors.secondary }}>Creating Magic...</h2>
        <p className="text-sm md:text-base text-slate-600 text-center">Applying {selectedPrompt?.name} style</p>
      </div>
    );
  }

  // 5. REVIEW CAPTURE (Before Sending to AI)
  if (view === 'review') {
      const colors = getBrandingColors();
      return (
          <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center p-3 md:p-8 overflow-hidden">
              <h2 className="text-xl md:text-3xl text-slate-900 font-display mb-2 md:mb-4 flex-shrink-0">Look Good?</h2>
              {errorMsg && (
                <div className="w-full max-w-2xl mb-2 md:mb-4 p-2 md:p-4 bg-red-100 border-2 border-red-300 rounded-lg text-red-800 text-center text-sm md:text-base flex-shrink-0">
                  {errorMsg}
                </div>
              )}
              <div className="w-full max-w-2xl bg-white rounded-lg md:rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-300 flex-shrink min-h-0" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                <img src={capturedImage || ''} className="w-full h-full object-contain" alt="captured" />
              </div>
              <div className="flex gap-2 md:gap-6 mt-3 md:mt-8 w-full max-w-2xl flex-shrink-0">
                  <button onClick={() => { setCapturedImage(null); setErrorMsg(''); setView('camera'); }} className="flex items-center justify-center gap-1 md:gap-2 flex-1 px-3 md:px-8 py-3 md:py-4 rounded-full bg-white border-2 border-slate-300 text-slate-900 hover:bg-slate-50 active:bg-slate-50 font-bold text-sm md:text-lg min-h-[44px]">
                    <RefreshCw size={18} className="md:w-6 md:h-6" /> Retake
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center justify-center gap-1 md:gap-2 flex-1 px-3 md:px-8 py-3 md:py-4 rounded-full text-white font-bold text-sm md:text-lg shadow-lg transition-all min-h-[44px]"
                    style={{
                      backgroundColor: colors.primary,
                      boxShadow: `0 10px 25px ${colors.primary}50`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Generate AI <ArrowRight size={18} className="md:w-6 md:h-6" />
                  </button>
              </div>
          </div>
      )
  }

  // 6. RESULT & DELIVERY
  if (view === 'result' || view === 'delivery') {
    const colors = getBrandingColors();
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col lg:flex-row overflow-hidden">
        {/* Image Side */}
        <div className="lg:w-2/3 h-[35vh] lg:h-full bg-white p-2 md:p-6 lg:p-8 flex items-center justify-center relative flex-shrink-0">
          <img
            src={finalImage || ''}
            className="max-h-full max-w-full rounded-lg md:rounded-xl shadow-2xl border-2 border-slate-300 touch-auto select-auto"
            alt="Final AI"
            style={{ WebkitUserSelect: 'auto', userSelect: 'auto', WebkitTouchCallout: 'default' }}
            onContextMenu={(e) => e.stopPropagation()}
          />
          <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-slate-900/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md pointer-events-none lg:hidden">
            Long-press to save
          </div>
        </div>

        {/* Input Side */}
        <div className="lg:w-1/3 flex-1 lg:h-full bg-white p-3 md:p-6 lg:p-12 flex flex-col justify-center space-y-3 md:space-y-6 lg:space-y-8 relative overflow-y-auto border-l-2 border-slate-300">

           {view === 'delivery' ? (
             <div className="text-center space-y-3 md:space-y-6">
                <div
                  className="h-12 w-12 md:h-24 md:w-24 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-6 shadow-lg"
                  style={{
                    backgroundColor: colors.primary,
                    boxShadow: `0 10px 30px ${colors.primary}50`,
                  }}
                >
                    <Check size={24} className="md:w-12 md:h-12 text-white" />
                </div>
                <h2 className="text-xl md:text-4xl text-slate-900 font-bold">Sent!</h2>
                <p className="text-sm md:text-base text-slate-600">Check your phone for the link.</p>
                <p className="text-xs md:text-sm text-slate-500 mt-4 md:mt-12">Closing in 5 seconds...</p>
             </div>
           ) : (
             <>
                <div>
                    <h2 className="text-xl md:text-3xl lg:text-4xl text-slate-900 font-display font-bold mb-1 md:mb-2">Get Your Photo</h2>
                    <p className="text-xs md:text-base text-slate-600">
                      {generatedImageUrl?.startsWith('data:') ? 'Download now (SMS unavailable)' : 'Download now or receive via SMS.'}
                    </p>
                </div>

                {errorMsg && (
                  <div className="w-full p-2 md:p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-800 text-center text-xs md:text-sm">
                    {errorMsg}
                  </div>
                )}

                <button
                    onClick={handleDownload}
                    className="w-full text-white font-bold text-sm md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 min-h-[44px]"
                    style={{
                      backgroundColor: colors.primary,
                      boxShadow: `0 10px 25px ${colors.primary}50`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <Download size={18} className="md:w-6 md:h-6" /> Download Now
                </button>

                {!generatedImageUrl?.startsWith('data:') && (
                  <>
                    <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-300"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 md:px-4 bg-white text-slate-500">or send via SMS</span>
                        </div>
                    </div>

                    <div className="space-y-1.5 md:space-y-4">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone Number</label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="(555) 123-4567"
                            className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 md:px-6 py-2.5 md:py-4 text-base md:text-xl lg:text-2xl text-slate-900 focus:outline-none placeholder-slate-400 font-mono min-h-[44px]"
                            style={{
                              borderColor: phoneNumber ? colors.accent : undefined,
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = colors.accent}
                            onBlur={(e) => {
                              if (!phoneNumber) e.currentTarget.style.borderColor = '';
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSendSms}
                        disabled={isSending || phoneNumber.length < 3}
                        className="w-full bg-slate-900 text-white font-bold text-sm md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl hover:bg-slate-800 active:bg-slate-800 transition-colors flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 min-h-[44px]"
                    >
                        {isSending ? 'Sending...' : <><Send size={18} className="md:w-6 md:h-6" /> Send SMS</>}
                    </button>
                  </>
                )}

                {generatedImageUrl && !generatedImageUrl.startsWith('data:') && generatedImageUrl.length < 500 && (
                  <div className="pt-2 md:pt-8 border-t border-slate-300">
                      <div className="flex items-center gap-2 md:gap-4 bg-slate-50 p-2 md:p-4 rounded-xl border-2 border-slate-300">
                          <div className="bg-white p-1 md:p-2 rounded-lg flex-shrink-0 border border-slate-300">
                              <QRCodeSVG
                                value={generatedImageUrl}
                                size={50}
                                level="M"
                                includeMargin={false}
                                className="md:w-20 md:h-20"
                              />
                          </div>
                          <div>
                              <p className="text-xs md:text-base text-slate-900 font-bold">Scan for Instant Access</p>
                              <p className="text-xs text-slate-600">No phone number required</p>
                          </div>
                      </div>
                  </div>
                )}

                <button onClick={resetKiosk} className="text-center text-xs md:text-base text-slate-600 hover:text-slate-900 active:text-slate-900 py-2">
                    Skip & Start Over
                </button>
             </>
           )}
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
};

export default KioskMode;
