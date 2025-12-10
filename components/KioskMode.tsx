import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Smartphone, Send, Download, Check, ArrowRight } from 'lucide-react';
import { Event, Prompt, GeneratedImage, Tenant } from '../types';
import { generateBoothImage } from '../services/geminiService';
import { sendSms, uploadToDropbox, saveGeneratedImage, getTenantById } from '../services/backendService';

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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror effect for natural feel
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
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
      // 1. Generate with Gemini
      const genImage = await generateBoothImage(
        capturedImage,
        selectedPrompt.promptText,
        event.name,
        tenant.geminiApiKey,
        selectedPrompt.referenceImage
      );
      setFinalImage(genImage);

      // 2. Save to database
      await saveGeneratedImage(
        event.id,
        selectedPrompt.id,
        event.tenantId,
        capturedImage,
        genImage,
        'completed'
      );

      // 3. Background upload to Dropbox (Mock)
      uploadToDropbox(genImage);

      setView('result');
    } catch (err: any) {
      setErrorMsg(err.message || "AI Generation Failed");
      setView('review');
    }
  };

  // --- SMS LOGIC ---
  const handleSendSms = async () => {
    if (phoneNumber.length < 10) return;
    setIsSending(true);
    await sendSms(phoneNumber, "https://lumina.booth/img/123"); // Mock URL
    setIsSending(false);
    setView('delivery');
    setTimeout(() => {
      // Reset kiosk after 5 seconds
      resetKiosk();
    }, 5000);
  };

  const resetKiosk = () => {
    setView('attract');
    setCapturedImage(null);
    setFinalImage(null);
    setSelectedPrompt(null);
    setPhoneNumber('');
    stopCamera();
  };

  // Fetch tenant data on mount
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenantData = await getTenantById(event.tenantId);
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
    return (
      <div 
        onClick={() => setView('prompt-select')}
        className="h-screen w-full bg-black relative flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 opacity-40">
           <img src="https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=2670&auto=format&fit=crop" className="w-full h-full object-cover animate-pulse-fast" alt="Background" />
        </div>
        <div className="z-10 text-center space-y-6 animate-bounce">
          <h1 className="text-8xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
            TAP TO START
          </h1>
          <p className="text-2xl text-white font-light tracking-[0.5em] uppercase">AI Photo Experience</p>
        </div>
        <div className="absolute bottom-10 right-10 z-50">
           <button onClick={(e) => { e.stopPropagation(); onExit(); }} className="text-white/20 hover:text-white text-sm p-4">Exit Kiosk</button>
        </div>
      </div>
    );
  }

  // 2. PROMPT SELECT
  if (view === 'prompt-select') {
    return (
      <div className="h-screen w-full bg-kiosk-bg p-8 flex flex-col">
        <h2 className="text-4xl font-display text-white mb-8 text-center">Choose Your Style</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 flex-1 overflow-auto no-scrollbar">
          {event.prompts.map(prompt => (
            <button
              key={prompt.id}
              onClick={() => { setSelectedPrompt(prompt); setView('camera'); }}
              className="relative group rounded-2xl overflow-hidden border-2 border-transparent hover:border-kiosk-accent transition-all transform hover:scale-105"
            >
              <img src={prompt.previewImage} alt={prompt.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-6">
                <h3 className="text-2xl text-white font-bold">{prompt.name}</h3>
                <p className="text-gray-300 text-sm">{prompt.category}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => setView('attract')} className="mt-8 text-gray-500 self-center">Cancel</button>
      </div>
    );
  }

  // 3. CAMERA & CAPTURE
  if (view === 'camera') {
    return (
      <div className="h-screen w-full bg-black relative flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover transform -scale-x-100" />
        <canvas ref={canvasRef} className="hidden" />
        
        {countdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
            <span className="text-[200px] font-bold text-white animate-ping">{countdown}</span>
          </div>
        )}

        <div className="absolute bottom-10 z-40 flex gap-8 items-center">
           <button onClick={() => setView('prompt-select')} className="bg-white/10 backdrop-blur text-white p-4 rounded-full hover:bg-white/20">
             Back
           </button>
           <button 
             onClick={takePhoto} 
             disabled={!!countdown}
             className="h-24 w-24 bg-white rounded-full border-8 border-gray-300 shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95 transition-transform"
           />
        </div>
      </div>
    );
  }

  // 4. PROCESSING (AI)
  if (view === 'processing') {
    return (
      <div className="h-screen w-full bg-kiosk-bg flex flex-col items-center justify-center text-white space-y-8">
        <div className="relative h-48 w-48">
          <div className="absolute inset-0 rounded-full border-4 border-t-kiosk-accent border-r-transparent border-b-purple-500 border-l-transparent animate-spin"></div>
          <img src={capturedImage || ''} className="absolute inset-2 rounded-full object-cover opacity-50 grayscale" alt="original" />
        </div>
        <h2 className="text-4xl font-display animate-pulse">Creating Magic...</h2>
        <p className="text-gray-400">Applying {selectedPrompt?.name} style</p>
      </div>
    );
  }

  // 5. REVIEW CAPTURE (Before Sending to AI)
  if (view === 'review') {
      return (
          <div className="h-screen w-full bg-kiosk-bg flex flex-col items-center p-8">
              <h2 className="text-3xl text-white font-display mb-4">Look Good?</h2>
              {errorMsg && (
                <div className="w-full max-w-2xl mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-center">
                  {errorMsg}
                </div>
              )}
              <div className="flex-1 w-full max-w-2xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                <img src={capturedImage || ''} className="w-full h-full object-contain" alt="captured" />
              </div>
              <div className="flex gap-6 mt-8">
                  <button onClick={() => { setCapturedImage(null); setErrorMsg(''); setView('camera'); }} className="flex items-center gap-2 px-8 py-4 rounded-full bg-gray-800 text-white hover:bg-gray-700 font-bold text-lg">
                    <RefreshCw size={24} /> Retake
                  </button>
                  <button onClick={handleGenerate} className="flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-purple-500/50 transition-all">
                    Generate AI <ArrowRight size={24} />
                  </button>
              </div>
          </div>
      )
  }

  // 6. RESULT & DELIVERY
  if (view === 'result' || view === 'delivery') {
    return (
      <div className="h-screen w-full bg-kiosk-bg flex flex-col lg:flex-row">
        {/* Image Side */}
        <div className="lg:w-2/3 h-1/2 lg:h-full bg-black p-8 flex items-center justify-center">
          <img src={finalImage || ''} className="max-h-full max-w-full rounded-xl shadow-2xl border border-gray-800" alt="Final AI" />
        </div>

        {/* Input Side */}
        <div className="lg:w-1/3 h-1/2 lg:h-full bg-gray-900 p-12 flex flex-col justify-center space-y-8 relative">
           
           {view === 'delivery' ? (
             <div className="text-center space-y-6">
                <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                    <Check size={48} className="text-white" />
                </div>
                <h2 className="text-4xl text-white font-bold">Sent!</h2>
                <p className="text-gray-400">Check your phone for the link.</p>
                <p className="text-sm text-gray-500 mt-12">Closing in 5 seconds...</p>
             </div>
           ) : (
             <>
                <div>
                    <h2 className="text-4xl text-white font-display font-bold mb-2">Get Your Photo</h2>
                    <p className="text-gray-400">Enter your number to receive the HD download link.</p>
                </div>
                
                <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                    <input 
                        type="tel" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-6 py-4 text-2xl text-white focus:border-kiosk-accent focus:outline-none placeholder-gray-600 font-mono"
                    />
                </div>

                <button 
                    onClick={handleSendSms}
                    disabled={isSending || phoneNumber.length < 3}
                    className="w-full bg-white text-black font-bold text-xl py-5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {isSending ? 'Sending...' : <><Send size={24} /> Send SMS</>}
                </button>

                <div className="pt-8 border-t border-gray-800">
                    <div className="flex items-center gap-4 bg-gray-800 p-4 rounded-xl">
                        <div className="bg-white p-1 rounded-lg">
                             {/* Mock QR Code */}
                            <div className="w-16 h-16 bg-white flex items-center justify-center">
                                <div className="grid grid-cols-3 gap-1 w-12 h-12">
                                    <div className="bg-black col-span-2 row-span-2"></div>
                                    <div className="bg-black"></div>
                                    <div className="bg-black"></div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <p className="text-white font-bold">Scan for Instant Access</p>
                            <p className="text-xs text-gray-500">No phone number required</p>
                        </div>
                    </div>
                </div>

                <button onClick={resetKiosk} className="absolute bottom-8 left-0 right-0 text-center text-gray-600 hover:text-gray-400">
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
