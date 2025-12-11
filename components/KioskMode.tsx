import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Smartphone, Send, Download, Check, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Event, Prompt, GeneratedImage, Tenant } from '../types';
import { generateBoothImage } from '../services/geminiService';
import { sendSms, saveGeneratedImage, getTenantById } from '../services/backendService';
import { uploadImageToDropbox } from '../services/dropboxService';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const getBrandingColors = () => ({
    primary: event.primaryColor || '#6366f1',
    secondary: event.secondaryColor || '#8b5cf6',
    accent: event.accentColor || '#ec4899',
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

    if (!tenant.geminiEnabled || !tenant.geminiApiKey) {
      setErrorMsg('Gemini AI is not configured. Please contact the administrator.');
      return;
    }

    setView('processing');
    setErrorMsg('');

    try {
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
        hasKey: !!tenant.geminiApiKey,
        keyLength: tenant.geminiApiKey?.length,
        keyPrefix: tenant.geminiApiKey?.substring(0, 5),
        geminiEnabled: tenant.geminiEnabled,
      });

      const genImage = await generateBoothImage(
        capturedImage,
        selectedPrompt.promptText,
        event.name,
        tenant.geminiApiKey,
        selectedPrompt.referenceImage,
        event.aspectRatio
      );
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
    setIsSending(true);
    try {
      await sendSms(event.tenantId, phoneNumber, generatedImageUrl);
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

    if (isMobile) {
      try {
        const response = await fetch(finalImage);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed, opening in new tab:', error);
        window.open(finalImage, '_blank');
      }
    } else {
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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

  // 1. ATTRACT SCREEN
  if (view === 'attract') {
    const colors = getBrandingColors();
    const backgroundImage = event.backgroundImageUrl || 'https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=2670&auto=format&fit=crop';

    return (
      <div
        onClick={() => setView('prompt-select')}
        className="h-screen w-full bg-black relative flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 opacity-40">
           <img src={backgroundImage} className="w-full h-full object-cover animate-pulse-fast" alt="Background" />
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className="absolute top-4 left-4 md:top-8 md:left-8 z-20">
            <img src={event.logoUrl} alt={event.name} className="h-12 md:h-24 object-contain" />
          </div>
        )}

        {!event.hideEventName && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20">
            <h2 className="text-lg md:text-3xl font-bold text-white drop-shadow-lg">{event.name}</h2>
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 animate-bounce px-4">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold text-transparent bg-clip-text"
            style={{
              backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            TAP TO START
          </h1>
          <p className="text-base md:text-xl lg:text-2xl text-white font-light tracking-[0.3em] md:tracking-[0.5em] uppercase">AI Photo Experience</p>
        </div>
        <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 z-50">
           <button onClick={(e) => { e.stopPropagation(); onExit(); }} className="text-white/20 hover:text-white text-xs md:text-sm p-2 md:p-4">Exit Kiosk</button>
        </div>
      </div>
    );
  }

  // 2. PROMPT SELECT
  if (view === 'prompt-select') {
    return (
      <div className="h-screen w-full bg-kiosk-bg p-4 md:p-8 flex flex-col">
        <h2 className="text-2xl md:text-4xl font-display text-white mb-4 md:mb-8 text-center">Choose Your Style</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 flex-1 overflow-auto no-scrollbar">
          {event.prompts.map(prompt => (
            <button
              key={prompt.id}
              onClick={() => { setSelectedPrompt(prompt); setView('camera'); }}
              className="relative group rounded-xl md:rounded-2xl overflow-hidden border-2 border-transparent active:border-kiosk-accent hover:border-kiosk-accent transition-all transform active:scale-95 hover:scale-105 min-h-[150px]"
            >
              <img src={prompt.previewImage} alt={prompt.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-3 md:p-6">
                <h3 className="text-base md:text-2xl text-white font-bold">{prompt.name}</h3>
                <p className="text-gray-300 text-xs md:text-sm">{prompt.category}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => setView('attract')} className="mt-4 md:mt-8 text-gray-500 self-center py-2 px-4">Cancel</button>
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
      <div className="h-screen w-full bg-black relative flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover transform -scale-x-100" />
        <canvas ref={canvasRef} className="hidden" />

        {countdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
            <span className="text-[200px] font-bold text-white animate-ping">{countdown}</span>
          </div>
        )}

        <div className="absolute bottom-6 md:bottom-10 z-40 flex gap-4 md:gap-8 items-center">
           <button onClick={() => setView('prompt-select')} className="bg-white/10 backdrop-blur text-white px-4 py-3 md:p-4 rounded-full hover:bg-white/20 text-sm md:text-base min-h-[44px]">
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
      <div className="h-screen w-full bg-kiosk-bg flex flex-col items-center justify-center text-white space-y-4 md:space-y-8 px-4">
        <div className="relative h-32 w-32 md:h-48 md:w-48">
          <div
            className="absolute inset-0 rounded-full border-4 animate-spin"
            style={{
              borderTopColor: colors.accent,
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
              borderLeftColor: 'transparent',
            }}
          />
          <img src={capturedImage || ''} className="absolute inset-2 rounded-full object-cover opacity-50 grayscale" alt="original" />
        </div>
        <h2 className="text-2xl md:text-4xl font-display animate-pulse text-center">Creating Magic...</h2>
        <p className="text-sm md:text-base text-gray-400 text-center">Applying {selectedPrompt?.name} style</p>
      </div>
    );
  }

  // 5. REVIEW CAPTURE (Before Sending to AI)
  if (view === 'review') {
      const colors = getBrandingColors();
      return (
          <div className="h-screen w-full bg-kiosk-bg flex flex-col items-center p-4 md:p-8">
              <h2 className="text-2xl md:text-3xl text-white font-display mb-3 md:mb-4">Look Good?</h2>
              {errorMsg && (
                <div className="w-full max-w-2xl mb-3 md:mb-4 p-3 md:p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-center text-sm md:text-base">
                  {errorMsg}
                </div>
              )}
              <div className="flex-1 w-full max-w-2xl bg-black rounded-xl md:rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                <img src={capturedImage || ''} className="w-full h-full object-contain" alt="captured" />
              </div>
              <div className="flex gap-3 md:gap-6 mt-4 md:mt-8 w-full max-w-2xl">
                  <button onClick={() => { setCapturedImage(null); setErrorMsg(''); setView('camera'); }} className="flex items-center justify-center gap-2 flex-1 px-4 md:px-8 py-3 md:py-4 rounded-full bg-gray-800 text-white hover:bg-gray-700 active:bg-gray-700 font-bold text-base md:text-lg min-h-[44px]">
                    <RefreshCw size={20} className="md:w-6 md:h-6" /> Retake
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center justify-center gap-2 flex-1 px-4 md:px-8 py-3 md:py-4 rounded-full text-white font-bold text-base md:text-lg shadow-lg transition-all min-h-[44px]"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.accent})`,
                      boxShadow: `0 10px 25px ${colors.accent}50`,
                    }}
                  >
                    Generate AI <ArrowRight size={20} className="md:w-6 md:h-6" />
                  </button>
              </div>
          </div>
      )
  }

  // 6. RESULT & DELIVERY
  if (view === 'result' || view === 'delivery') {
    const colors = getBrandingColors();
    return (
      <div className="h-screen w-full bg-kiosk-bg flex flex-col lg:flex-row overflow-hidden">
        {/* Image Side */}
        <div className="lg:w-2/3 h-2/5 lg:h-full bg-black p-3 md:p-6 lg:p-8 flex items-center justify-center relative">
          <img src={finalImage || ''} className="max-h-full max-w-full rounded-lg md:rounded-xl shadow-2xl border border-gray-800" alt="Final AI" />
          <button
            onClick={handleDownload}
            className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-3 bg-white text-black font-bold text-sm md:text-base rounded-lg md:rounded-xl hover:bg-gray-200 active:bg-gray-200 transition-all shadow-lg hover:shadow-xl min-h-[44px]"
          >
            <Download size={16} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>

        {/* Input Side */}
        <div className="lg:w-1/3 h-3/5 lg:h-full bg-gray-900 p-4 md:p-6 lg:p-12 flex flex-col justify-center space-y-4 md:space-y-6 lg:space-y-8 relative overflow-y-auto">

           {view === 'delivery' ? (
             <div className="text-center space-y-4 md:space-y-6">
                <div className="h-16 w-16 md:h-24 md:w-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                    <Check size={32} className="md:w-12 md:h-12 text-white" />
                </div>
                <h2 className="text-2xl md:text-4xl text-white font-bold">Sent!</h2>
                <p className="text-sm md:text-base text-gray-400">Check your phone for the link.</p>
                <p className="text-xs md:text-sm text-gray-500 mt-8 md:mt-12">Closing in 5 seconds...</p>
             </div>
           ) : (
             <>
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl text-white font-display font-bold mb-1 md:mb-2">Get Your Photo</h2>
                    <p className="text-sm md:text-base text-gray-400">Download now or receive via SMS.</p>
                </div>

                <button
                    onClick={handleDownload}
                    className="w-full text-white font-bold text-base md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 min-h-[44px]"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.accent})`,
                      boxShadow: `0 10px 25px ${colors.accent}50`,
                    }}
                >
                    <Download size={20} className="md:w-6 md:h-6" /> Download Now
                </button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs md:text-sm">
                        <span className="px-3 md:px-4 bg-gray-900 text-gray-500">or send via SMS</span>
                    </div>
                </div>

                <div className="space-y-2 md:space-y-4">
                    <label className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                    <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 md:px-6 py-3 md:py-4 text-lg md:text-xl lg:text-2xl text-white focus:border-kiosk-accent focus:outline-none placeholder-gray-600 font-mono min-h-[44px]"
                    />
                </div>

                <button
                    onClick={handleSendSms}
                    disabled={isSending || phoneNumber.length < 3}
                    className="w-full bg-white text-black font-bold text-base md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl hover:bg-gray-200 active:bg-gray-200 transition-colors flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 min-h-[44px]"
                >
                    {isSending ? 'Sending...' : <><Send size={20} className="md:w-6 md:h-6" /> Send SMS</>}
                </button>

                {generatedImageUrl && !generatedImageUrl.startsWith('data:') && generatedImageUrl.length < 500 && (
                  <div className="pt-4 md:pt-8 border-t border-gray-800">
                      <div className="flex items-center gap-3 md:gap-4 bg-gray-800 p-3 md:p-4 rounded-xl">
                          <div className="bg-white p-1.5 md:p-2 rounded-lg flex-shrink-0">
                              <QRCodeSVG
                                value={generatedImageUrl}
                                size={60}
                                level="M"
                                includeMargin={false}
                                className="md:w-20 md:h-20"
                              />
                          </div>
                          <div>
                              <p className="text-sm md:text-base text-white font-bold">Scan for Instant Access</p>
                              <p className="text-xs text-gray-500">No phone number required</p>
                          </div>
                      </div>
                  </div>
                )}

                <button onClick={resetKiosk} className="text-center text-sm md:text-base text-gray-600 hover:text-gray-400 active:text-gray-400 py-2 mt-2">
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
