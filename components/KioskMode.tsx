import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Smartphone, Send, Download, Check, ArrowRight, SwitchCamera, Maximize, Minimize, Images, MessageCircle, Mail, Lock, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Event, Prompt, GeneratedImage, UserSettings, GlobalSettings } from '../types';
import { generateBoothImage } from '../services/geminiService';
import { sendSms, sendEmail, saveGeneratedImage, saveEventPhotoRecord, updateEventPhotoSmugmugUrl, getUserSettingsByUserId, getGlobalSettings, checkDeviceLimit, incrementDeviceUsage, getPromptTranslationsBatch, getKioskTextOverrides } from '../services/backendService';
import { uploadImageToDropbox } from '../services/dropboxService';
import { uploadToSmugMug } from '../services/smugmugService';
import { applyOverlayToImage, convertImageUrlToBase64 } from '../services/imageUtils';
import { checkCreditAvailability, consumeCredit } from '../services/creditService';
import { uploadImageWithRetry, uploadGeneratedPhoto } from '../services/storageService';
import { compressForUpload } from '../services/imageCompression';
import { LanguageCode, SUPPORTED_LANGUAGES, translateText } from '../lib/i18n';

interface KioskProps {
  event: Event;
  onExit: () => void;
  onLoaded?: () => void;
}

type KioskState = 'attract' | 'prompt-select' | 'camera' | 'review' | 'processing' | 'result' | 'delivery' | 'no-credits' | 'device-limit-reached';

const KioskMode: React.FC<KioskProps> = ({ event, onExit, onLoaded }) => {
  const eventLanguages: LanguageCode[] = (event.kioskLanguages && event.kioskLanguages.length > 0
    ? event.kioskLanguages
    : [event.kioskLanguage || 'en-US']
  ).filter((l): l is LanguageCode => SUPPORTED_LANGUAGES.some(s => s.code === l));
  const initialKioskLanguage: LanguageCode = ((): LanguageCode => {
    const defaultLang = event.defaultKioskLanguage;
    if (defaultLang && eventLanguages.includes(defaultLang as LanguageCode)) {
      return defaultLang as LanguageCode;
    }
    return eventLanguages[0] || 'en-US';
  })();
  const [kioskLanguage, setKioskLanguage] = useState<LanguageCode>(initialKioskLanguage);
  const [promptTranslationsMap, setPromptTranslationsMap] = useState<Record<string, { name: string; description: string }>>({});
  const [kioskTextOverrides, setKioskTextOverrides] = useState<Record<string, string>>({});
  const [view, setView] = useState<KioskState>('attract');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageStorageUrl, setCapturedImageStorageUrl] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedImageId, setGeneratedImageId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [bucketPhotoId, setBucketPhotoId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const [emailAddress, setEmailAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [eventTimeStatus, setEventTimeStatus] = useState<'before' | 'active' | 'after'>('active');
  const [deliveryCountdown, setDeliveryCountdown] = useState<number>(15);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [deviceLimitRemaining, setDeviceLimitRemaining] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeAction, setPasscodeAction] = useState<'exit' | 'fullscreen'>('exit');

  const hasPasscode = !!(event.kioskPasscode && event.kioskPasscode.trim().length > 0);
  const fullscreenEnabled = event.fullscreenEnabled === true;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kioskContainerRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);

  const requestFullscreen = useCallback(async () => {
    try {
      const el = kioskContainerRef.current || document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (!document.fullscreenElement && (el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }, []);

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

  const getLogoPositionClass = () => {
    switch (event.logoPosition) {
      case 'center': return 'top-4 left-1/2 -translate-x-1/2 md:top-8';
      case 'top-right': return 'top-4 right-4 md:top-8 md:right-8';
      default: return 'top-4 left-4 md:top-8 md:left-8';
    }
  };

  const getLogoSizeClass = () => {
    switch (event.logoSize) {
      case 'small': return 'h-8 md:h-16';
      case 'large': return 'h-24 md:h-40';
      case 'extra-large': return 'h-36 md:h-64';
      default: return 'h-12 md:h-24';
    }
  };

  const handleTapToStart = async () => {
    if (!event.userId) {
      setErrorMsg('Event owner not found. Please contact the administrator.');
      return;
    }

    setIsCheckingCredits(true);

    try {
      if (event.limitPhotosPerDevice) {
        try {
          const deviceCheck = await checkDeviceLimit(event.id);
          if (!deviceCheck.allowed) {
            setView('device-limit-reached');
            return;
          }
          setDeviceLimitRemaining(deviceCheck.remaining);
        } catch (err) {
          console.error('Device limit check failed, allowing through:', err);
        }
      }

      const creditCheck = await checkCreditAvailability(event.userId, 'image');

      if (!creditCheck.available) {
        setView('no-credits');
      } else {
        setView('prompt-select');
      }
    } finally {
      setIsCheckingCredits(false);
    }
  };

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
        video: { width: 1280, height: 720, facingMode: facingMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error", err);
      setErrorMsg("Camera access denied.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

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

        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, canvas.width, canvas.height
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const dataUrl = URL.createObjectURL(blob);
              setCapturedImage(dataUrl);
              setCapturedImageBlob(blob);
              setView('review');
              stopCamera();
            }
          },
          'image/jpeg',
          0.9
        );
      }
    }
  };

  // --- GENERATION LOGIC ---
  const handleGenerate = async () => {
    if (!capturedImage || !selectedPrompt) return;

    if (!globalSettings || !userSettings) {
      setErrorMsg('Configuration not loaded. Please try again.');
      return;
    }

    setView('processing');
    setErrorMsg('');

    try {
      console.log('🎯 Event userId being checked:', event.userId);

      if (!event.userId) {
        setErrorMsg('Event owner not found. Please contact the administrator.');
        setView('camera');
        return;
      }

      if (!globalSettings?.geminiEnabled) {
        console.error('❌ Gemini check failed:', {
          globalSettings,
          geminiEnabled: globalSettings?.geminiEnabled,
          hasGlobalSettings: !!globalSettings
        });
        setErrorMsg('Gemini AI is not configured. Please contact the administrator.');
        setView('camera');
        return;
      }

      // 1. Upload captured image to Supabase Storage
      setUploadProgress('Uploading image...');
      console.log('📤 Uploading captured image to storage...');

      let uploadedImageUrl = capturedImageStorageUrl;

      if (!uploadedImageUrl) {
        if (!capturedImageBlob) {
          throw new Error('No image blob available for upload');
        }

        const uploadResult = await uploadImageWithRetry(capturedImageBlob, 'booth-captures');

        if (uploadResult.error) {
          throw new Error(`Failed to upload image: ${uploadResult.error}`);
        }

        uploadedImageUrl = uploadResult.url;
        setCapturedImageStorageUrl(uploadedImageUrl);
        console.log('✅ Image uploaded to storage:', uploadedImageUrl);
      }

      // 2. Generate with Gemini using URL
      setUploadProgress('Generating AI image...');
      console.log('🎨 Starting Gemini image generation...', {
        geminiEnabled: globalSettings.geminiEnabled,
        model: globalSettings.geminiModel,
        resolution: globalSettings.geminiResolution,
      });

      let referenceImageUrl = selectedPrompt.referenceImage;

      let genImage = await generateBoothImage(
        uploadedImageUrl,
        selectedPrompt.promptText,
        referenceImageUrl,
        event.aspectRatio,
        globalSettings.geminiModel,
        globalSettings.geminiResolution
      );

      setUploadProgress('');

      if (event.overlayImageUrl) {
        try {
          genImage = await applyOverlayToImage(genImage, event.overlayImageUrl);
        } catch (overlayErr) {
          console.error('Failed to apply overlay:', overlayErr);
        }
      }

      setFinalImage(genImage);

      // Upload generated image to event-photos bucket (fast, blocking)
      setUploadProgress('Saving your photo...');
      const bucketResult = await uploadGeneratedPhoto(genImage, event.id);

      let bucketUrl = genImage;
      let bucketPath = '';

      if (bucketResult.error) {
        console.error('Bucket upload failed, falling back to base64:', bucketResult.error);
      } else {
        bucketUrl = bucketResult.url;
        bucketPath = bucketResult.path;
        console.log('✅ Uploaded generated to event-photos bucket:', bucketUrl);
      }

      setGeneratedImageUrl(bucketUrl);

      if (!event.smugmugGalleryKey) {
        setShareUrl(bucketUrl);
      }

      const photoRecordId = await saveEventPhotoRecord(
        event.id,
        selectedPrompt.id,
        bucketPath,
        bucketUrl
      );
      setBucketPhotoId(photoRecordId);

      // Save analytics record
      const imageId = await saveGeneratedImage(
        event.id,
        selectedPrompt.id,
        null,
        null,
        null,
        'completed'
      );

      const consumed = await consumeCredit(event.userId);
      if (!consumed) {
        console.error('Failed to consume credit, but image was generated');
      }

      if (event.limitPhotosPerDevice) {
        try {
          const incResult = await incrementDeviceUsage(event.id);
          setDeviceLimitRemaining(incResult.remaining);
        } catch (err) {
          console.error('Failed to increment device usage:', err);
        }
      }

      setGeneratedImageId(imageId);
      setFinalImage(genImage);
      setUploadProgress('');

      setView('result');

      // Background uploads (SmugMug, Dropbox) - do not block the user
      const backgroundPromises: Promise<any>[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (event.smugmugGalleryKey) {
        const fileName = `${event.name}-${selectedPrompt.name}-generated-${timestamp}.jpg`;
        backgroundPromises.push(
          (async () => {
            const compressedImage = await compressForUpload(genImage);
            return uploadToSmugMug(
              event.smugmugGalleryKey,
              compressedImage,
              fileName,
              import.meta.env.VITE_SUPABASE_ANON_KEY
            );
          })()
            .then((result) => {
              console.log('✅ Uploaded generated to SmugMug:', result.imageUrl);
              setShareUrl(result.imageUrl);
              if (photoRecordId) {
                updateEventPhotoSmugmugUrl(photoRecordId, result.imageUrl);
              }
            })
            .catch((smugmugErr) => {
              console.error('SmugMug upload failed for generated:', smugmugErr);
              setShareUrl(bucketUrl);
            })
        );
      }

      if (event.uploadOriginalsToGallery && event.smugmugGalleryKey) {
        const originalFileName = `${event.name}-${selectedPrompt.name}-original-${timestamp}.jpg`;
        backgroundPromises.push(
          (async () => {
            const compressedOriginal = await compressForUpload(capturedImage);
            return uploadToSmugMug(
              event.smugmugGalleryKey,
              compressedOriginal,
              originalFileName,
              import.meta.env.VITE_SUPABASE_ANON_KEY
            );
          })()
            .then((originalResult) => {
              console.log('✅ Uploaded original to SmugMug:', originalResult.imageUrl);
            })
            .catch((smugmugOrigErr) => {
              console.error('SmugMug upload failed for original:', smugmugOrigErr);
            })
        );
      }

      if (userSettings?.dropboxEnabled && userSettings?.dropboxAccessToken) {
        backgroundPromises.push(
          uploadImageToDropbox({
            userId: event.userId,
            eventId: event.id,
            eventName: event.name,
            imageBase64: genImage,
            imageType: 'generated',
            promptName: selectedPrompt.name,
          })
            .then((dropboxUrl) => {
              console.log('✅ Uploaded generated to Dropbox:', dropboxUrl);
            })
            .catch((dropboxErr) => {
              console.error('Dropbox upload failed for generated:', dropboxErr);
            })
        );

        backgroundPromises.push(
          uploadImageToDropbox({
            userId: event.userId,
            eventId: event.id,
            eventName: event.name,
            imageBase64: capturedImage,
            imageType: 'original',
            promptName: selectedPrompt.name,
          })
            .then((dropboxOrigUrl) => {
              console.log('✅ Uploaded original to Dropbox:', dropboxOrigUrl);
            })
            .catch((dropboxErr) => {
              console.error('Dropbox upload failed for original:', dropboxErr);
            })
        );
      }

      if (backgroundPromises.length > 0) {
        console.log(`📤 ${backgroundPromises.length} background upload(s) continuing...`);
        Promise.allSettled(backgroundPromises).then((results) => {
          const succeeded = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          console.log(`✅ Background uploads complete: ${succeeded} succeeded, ${failed} failed`);
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "AI Generation Failed");
      setView('review');
    }
  };

  // --- SMS LOGIC ---
  const handleSendSms = async () => {
    if (phoneNumber.length < 10 || !shareUrl || !generatedImageId) return;

    setIsSending(true);
    setErrorMsg('');
    try {
      await sendSms(phoneNumber, shareUrl, generatedImageId, event.id);
      setPhoneNumber('');
      setDeliveryCountdown(15);
      setView('delivery');
    } catch (error) {
      console.error('SMS send failed:', error);
      setErrorMsg('Failed to send SMS. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!shareUrl) return;

    const template = event.smsMessage || "Here's your AI-generated photo from {event_name}! {image_url}";
    const message = template
      .replace(/\{event_name\}/g, event.name)
      .replace(/\{image_url\}/g, shareUrl);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setDeliveryCountdown(15);
    setView('delivery');
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@') || !shareUrl || !generatedImageId) return;

    setIsSending(true);
    setErrorMsg('');
    try {
      await sendEmail(emailAddress, shareUrl, generatedImageId, event.id);
      setEmailAddress('');
      setDeliveryCountdown(15);
      setView('delivery');
    } catch (error) {
      console.error('Email send failed:', error);
      setErrorMsg('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const resetKiosk = () => {
    setView('attract');
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedImageStorageUrl(null);
    setFinalImage(null);
    setGeneratedImageUrl(null);
    setShareUrl(null);
    setBucketPhotoId(null);
    setSelectedPrompt(null);
    setPhoneNumber('');
    setEmailAddress('');
    setUploadProgress('');
    stopCamera();
  };

  const handleDownload = async () => {
    const downloadUrl = generatedImageUrl || finalImage;
    if (!downloadUrl) return;

    const filename = `${event.name.replace(/\s+/g, '_')}_${selectedPrompt?.name.replace(/\s+/g, '_')}_${Date.now()}.jpg`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share && navigator.canShare) {
      try {
        const response = await fetch(downloadUrl);
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
      window.open(downloadUrl, '_blank');
    } else {
      try {
        const response = await fetch(downloadUrl);
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
        window.open(downloadUrl, '_blank');
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

  // Fetch user and global settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log('🔄 Loading settings for event:', event.id, 'userId:', event.userId);
        const [userSettingsData, globalSettingsData] = await Promise.all([
          getUserSettingsByUserId(event.userId),
          getGlobalSettings()
        ]);
        console.log('⚙️ Settings loaded:', {
          geminiEnabled: globalSettingsData.geminiEnabled,
          geminiModel: globalSettingsData.geminiModel,
          geminiResolution: globalSettingsData.geminiResolution,
        });
        setUserSettings(userSettingsData);
        setGlobalSettings(globalSettingsData);
        onLoaded?.();
      } catch (err) {
        console.error('❌ Failed to load settings:', err);
        setErrorMsg('Failed to load configuration. Please contact support.');
        onLoaded?.();
      }
    };
    loadSettings();
  }, [event.userId, onLoaded]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      exitFullscreen();
    };
  }, [stopCamera, exitFullscreen]);

  // Track fullscreen state changes
  useEffect(() => {
    const handleChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (fullscreenEnabled && !isNowFullscreen && !showPasscodePrompt) {
        if (hasPasscode) {
          setPasscodeAction('fullscreen');
          setPasscodeInput('');
          setPasscodeError(false);
          setShowPasscodePrompt(true);
        } else {
          requestFullscreen();
        }
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenEnabled, hasPasscode, showPasscodePrompt]);

  // Auto-enter fullscreen on mount when enabled
  useEffect(() => {
    if (fullscreenEnabled) {
      requestFullscreen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start camera when entering camera view or when facingMode changes
  useEffect(() => {
    if (view === 'camera') startCamera();
  }, [view, facingMode, startCamera]);

  // Handle delivery countdown
  useEffect(() => {
    if (view === 'delivery') {
      const interval = setInterval(() => {
        setDeliveryCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            resetKiosk();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [view]);

  // Preload prompt images for faster display
  useEffect(() => {
    if (event.prompts && event.prompts.length > 0) {
      event.prompts.forEach(prompt => {
        const img = new Image();
        img.src = prompt.previewImage;
      });
    }
  }, [event.prompts]);

  // Load prompt translations for the kiosk language
  useEffect(() => {
    const loadTranslations = async () => {
      if (!event.prompts || event.prompts.length === 0 || kioskLanguage === 'en-US') return;
      try {
        const promptIds = event.prompts.map(p => p.id).filter(Boolean);
        if (promptIds.length === 0) return;
        const batch = await getPromptTranslationsBatch(promptIds);
        const map: Record<string, { name: string; description: string }> = {};
        for (const [, trans] of Object.entries(batch)) {
          for (const t of trans) {
            if (t.languageCode === kioskLanguage) {
              map[t.promptId] = { name: t.name, description: t.description || '' };
            }
          }
        }
        setPromptTranslationsMap(map);
      } catch (err) {
        console.warn('Failed to load prompt translations:', err);
      }
    };
    loadTranslations();
  }, [event.prompts, kioskLanguage]);

  // Load kiosk text overrides for the kiosk language
  useEffect(() => {
    const loadOverrides = async () => {
      if (!event.id || kioskLanguage === 'en-US') {
        setKioskTextOverrides({});
        return;
      }
      try {
        const overrides = await getKioskTextOverrides(event.id);
        const map: Record<string, string> = {};
        for (const o of overrides) {
          if (o.languageCode === kioskLanguage) {
            map[o.textKey] = o.textValue;
          }
        }
        setKioskTextOverrides(map);
      } catch (err) {
        console.warn('Failed to load kiosk text overrides:', err);
        setKioskTextOverrides({});
      }
    };
    loadOverrides();
  }, [event.id, kioskLanguage]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (kioskTextOverrides[key]) {
      let value = kioskTextOverrides[key];
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return value;
    }
    return translateText(key, kioskLanguage, params);
  }, [kioskTextOverrides, kioskLanguage]);

  const getPromptDisplayName = (prompt: Prompt): string => {
    if (kioskLanguage !== 'en-US' && promptTranslationsMap[prompt.id]?.name) {
      return promptTranslationsMap[prompt.id].name;
    }
    return prompt.name;
  };

  const getPromptDisplayDescription = (prompt: Prompt): string => {
    if (kioskLanguage !== 'en-US' && promptTranslationsMap[prompt.id]?.description) {
      return promptTranslationsMap[prompt.id].description;
    }
    return prompt.description;
  };

  // --- RENDER VIEWS ---

  const renderView = (): React.ReactNode => {
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
          <div className={`absolute ${getLogoPositionClass()} z-20`}>
            <img src={event.logoUrl} alt={event.name} className={`${getLogoSizeClass()} object-contain`} />
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 px-4 max-w-2xl">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            {t('kiosk.eventNotStarted')}
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-slate-900 font-light">
            {t('kiosk.eventNotStartedDesc')}
          </p>
          {startDate && (
            <div className="mt-8 p-6 bg-white backdrop-blur-sm rounded-xl border-2 border-slate-300">
              <p className="text-slate-900 text-lg md:text-xl mb-2">{t('kiosk.eventStarts')}</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: colors.primary }}>
                {startDate.toLocaleString(kioskLanguage, {
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
        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 z-50">
          <button onClick={handleExitKiosk} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">{t('kiosk.exitKiosk')}</button>
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
          <div className={`absolute ${getLogoPositionClass()} z-20`}>
            <img src={event.logoUrl} alt={event.name} className={`${getLogoSizeClass()} object-contain`} />
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 px-4 max-w-2xl">
          <h1
            className="text-4xl md:text-6xl lg:text-8xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            {t('kiosk.eventHasEnded')}
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-slate-900 font-light">
            {t('kiosk.eventConcluded')}
          </p>
          {endDate && (
            <div className="mt-8 p-6 bg-white backdrop-blur-sm rounded-xl border-2 border-slate-300">
              <p className="text-slate-900 text-lg md:text-xl mb-2">{t('kiosk.eventEnded')}</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: colors.primary }}>
                {endDate.toLocaleString(kioskLanguage, {
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
            {t('kiosk.thankYou')}
          </p>
        </div>
        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 z-50">
          <button onClick={handleExitKiosk} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">{t('kiosk.exitKiosk')}</button>
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
        onClick={handleTapToStart}
        className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
           <img src={backgroundImage} className="w-full h-full object-cover animate-pulse-fast" alt="Background" />
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className={`absolute ${getLogoPositionClass()} z-20`}>
            <img src={event.logoUrl} alt={event.name} className={`${getLogoSizeClass()} object-contain`} />
          </div>
        )}

        {!event.hideEventName && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20">
            <h2 className="text-lg md:text-3xl font-bold text-slate-900 drop-shadow-sm">{event.name}</h2>
          </div>
        )}

        <div className="z-10 text-center space-y-4 md:space-y-6 px-4">
          {isCheckingCredits ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 md:h-24 md:w-24 border-b-4 mx-auto" style={{ borderColor: colors.secondary }}></div>
              <p className="text-xl md:text-3xl text-slate-900 font-light">{t('kiosk.checkingCredits')}</p>
            </>
          ) : (
            <>
              <h1
                className="text-4xl md:text-6xl lg:text-8xl font-display font-bold animate-bounce"
                style={{ color: colors.secondary }}
              >
                {t('kiosk.tapToStart')}
              </h1>
              <p className="text-base md:text-xl lg:text-2xl text-slate-900 font-light tracking-[0.3em] md:tracking-[0.5em] uppercase">{t('kiosk.aiPhotoExperience')}</p>
              {event.limitPhotosPerDevice && deviceLimitRemaining !== null && deviceLimitRemaining > 0 && (
                <p className="text-sm md:text-lg text-slate-700 font-medium mt-2">
                  {deviceLimitRemaining} of {event.maxPhotosPerDevice} {event.maxPhotosPerDevice === 1 ? t('kiosk.photoRemaining') : t('kiosk.photosRemaining')}
                </p>
              )}
            </>
          )}
        </div>
        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 z-50 flex flex-col items-start gap-2">
          {eventLanguages.length > 1 && !event.hideLanguageSelector && (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full p-1 border border-slate-200 shadow-sm">
                {eventLanguages.map((lang) => {
                  const langOption = SUPPORTED_LANGUAGES.find(l => l.code === lang);
                  return (
                    <button
                      key={lang}
                      onClick={() => setKioskLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        kioskLanguage === lang
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title={langOption?.label}
                    >
                      {langOption?.nativeLabel || lang}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
           <button onClick={(e) => { e.stopPropagation(); handleExitKiosk(); }} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">{t('kiosk.exitKiosk')}</button>
        </div>
      </div>
    );
  }

  // 2. NO CREDITS WARNING
  if (view === 'no-credits') {
    const colors = getBrandingColors();
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900"></div>
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className={`absolute ${getLogoPositionClass()} z-20`}>
            <img src={event.logoUrl} alt={event.name} className={`${getLogoSizeClass()} object-contain`} />
          </div>
        )}

        <div className="z-10 text-center space-y-6 md:space-y-8 max-w-2xl">
          <div
            className="h-20 w-20 md:h-32 md:w-32 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-lg"
            style={{
              backgroundColor: '#ef4444',
              boxShadow: '0 10px 30px rgba(239, 68, 68, 0.5)',
            }}
          >
            <span className="text-4xl md:text-6xl">⚠️</span>
          </div>

          <h1
            className="text-3xl md:text-5xl lg:text-7xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            {t('kiosk.outOfCredits')}
          </h1>

          <p className="text-lg md:text-2xl text-slate-900 font-light">
            {t('kiosk.outOfCreditsDesc')}
          </p>

          <div className="mt-8 space-y-4 md:space-y-6">
            <p className="text-base md:text-lg text-slate-700 mb-6">
              {t('kiosk.upgradePrompt')}
            </p>

            <div className="space-y-3 md:space-y-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`${window.location.origin}?view=subscription`, '_blank');
                }}
                className="w-full max-w-md mx-auto text-white font-bold text-base md:text-xl py-4 md:py-5 rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 shadow-lg"
                style={{
                  backgroundColor: colors.primary,
                  boxShadow: `0 10px 25px ${colors.primary}50`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {t('kiosk.upgradeSubscription')}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`${window.location.origin}?view=topup`, '_blank');
                }}
                className="w-full max-w-md mx-auto bg-slate-900 text-white font-bold text-base md:text-xl py-4 md:py-5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 md:gap-3 shadow-lg"
              >
                {t('kiosk.purchaseCredits')}
              </button>
            </div>

            <div className="mt-8 p-4 md:p-6 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-slate-300 max-w-md mx-auto">
              <p className="text-sm md:text-base text-slate-700">
                <strong>{t('kiosk.needHelp')}</strong><br />
                {t('kiosk.contactOrganizer')}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 z-50">
          <button onClick={(e) => { e.stopPropagation(); handleExitKiosk(); }} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">
            {t('kiosk.exitKiosk')}
          </button>
        </div>
      </div>
    );
  }

  // DEVICE LIMIT REACHED SCREEN
  if (view === 'device-limit-reached') {
    const colors = getBrandingColors();
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 relative flex flex-col items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-800"></div>
        </div>

        {event.logoUrl && !event.hideLogo && (
          <div className={`absolute ${getLogoPositionClass()} z-20`}>
            <img src={event.logoUrl} alt={event.name} className={`${getLogoSizeClass()} object-contain`} />
          </div>
        )}

        <div className="z-10 text-center space-y-6 md:space-y-8 max-w-2xl">
          <div
            className="h-20 w-20 md:h-32 md:w-32 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-lg"
            style={{
              backgroundColor: '#f59e0b',
              boxShadow: '0 10px 30px rgba(245, 158, 11, 0.5)',
            }}
          >
            <Camera className="w-10 h-10 md:w-16 md:h-16 text-white" />
          </div>

          <h1
            className="text-3xl md:text-5xl lg:text-7xl font-display font-bold"
            style={{ color: colors.secondary }}
          >
            {t('kiosk.photoLimitReached')}
          </h1>

          <p className="text-lg md:text-2xl text-slate-900 font-light">
            {t('kiosk.deviceLimitDesc')}
          </p>

          <div className="mt-8 p-4 md:p-6 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-slate-300 max-w-md mx-auto">
            <p className="text-sm md:text-base text-slate-700">
              <strong>{t('kiosk.limit')}</strong> {event.maxPhotosPerDevice} {event.maxPhotosPerDevice === 1 ? t('kiosk.photoPerDevice') : t('kiosk.photosPerDevice')}<br />
              {t('kiosk.askOrganizer')}
            </p>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 z-50">
          <button onClick={(e) => { e.stopPropagation(); handleExitKiosk(); }} className="text-slate-400 hover:text-slate-900 text-xs md:text-sm p-2 md:p-4">
            {t('kiosk.exitKiosk')}
          </button>
        </div>
      </div>
    );
  }

  // 3. PROMPT SELECT
  if (view === 'prompt-select') {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col p-4 md:p-8 overflow-hidden">
        <h2 className="text-2xl md:text-4xl font-display text-slate-900 mb-4 md:mb-6 text-center flex-shrink-0">{t('kiosk.chooseYourStyle')}</h2>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full max-w-7xl mx-auto justify-items-center">
            {event.prompts.map(prompt => (
              <button
                key={prompt.id}
                onClick={() => { setSelectedPrompt(prompt); setView('camera'); }}
                className="relative group rounded-2xl overflow-hidden border-2 border-slate-300 transition-all transform active:scale-95 hover:scale-105 aspect-square w-full max-w-[300px] sm:max-w-[280px] md:max-w-[320px] lg:max-w-[360px]"
                style={{
                  borderColor: '#cbd5e1',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = getBrandingColors().accent}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <img
                  src={prompt.previewImage}
                  alt={prompt.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-4 md:p-6">
                  <h3 className="text-lg md:text-2xl text-white font-bold">{getPromptDisplayName(prompt)}</h3>
                  <p className="text-gray-300 text-sm md:text-base">{getPromptDisplayDescription(prompt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 text-center pt-2">
          <button onClick={() => setView('attract')} className="text-slate-600 hover:text-slate-900 py-2 px-4 min-h-[44px]">{t('kiosk.cancel')}</button>
        </div>
      </div>
    );
  }

  // 4. CAMERA & CAPTURE
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <div
              className={`relative ${getAspectRatioClass()} max-w-full max-h-full border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]`}
              style={{
                width: event.aspectRatio === '9:16' || event.aspectRatio === '3:4' ? 'auto' : '90%',
                height: event.aspectRatio === '16:9' || event.aspectRatio === '4:3' ? 'auto' : '85%'
              }}
            >
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-white text-sm font-semibold">
                  {event.aspectRatio === 'square' ? '1:1 Square' :
                   event.aspectRatio === '3:4' ? '3:4 Portrait' :
                   event.aspectRatio === '4:3' ? '4:3 Landscape' :
                   event.aspectRatio === '9:16' ? '9:16 Portrait' :
                   event.aspectRatio === '16:9' ? '16:9 Landscape' : '1:1 Square'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {countdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50">
            <span className="text-[200px] font-bold text-white animate-ping">{countdown}</span>
          </div>
        )}

        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={toggleCamera}
            disabled={!!countdown}
            className="bg-white/90 backdrop-blur text-slate-900 p-3 md:p-4 rounded-full hover:bg-white border-2 border-slate-300 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={facingMode === 'user' ? t('kiosk.switchCamera') : t('kiosk.switchToFront')}
          >
            <SwitchCamera className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="fixed bottom-20 md:bottom-24 left-0 right-0 z-40 flex justify-center gap-4 md:gap-8 items-center px-4">
           <button onClick={() => setView('prompt-select')} className="bg-white/90 backdrop-blur text-slate-900 px-4 py-3 md:p-4 rounded-full hover:bg-white border-2 border-slate-300 text-sm md:text-base min-h-[44px] font-semibold">
             {t('kiosk.back')}
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

  // 5. PROCESSING (AI)
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
        <h2 className="text-2xl md:text-4xl font-display animate-pulse text-center" style={{ color: colors.secondary }}>{t('kiosk.creatingMagic')}</h2>
        <p className="text-sm md:text-base text-slate-600 text-center">
          {uploadProgress || t('kiosk.applyingStyle', { style: getPromptDisplayName(selectedPrompt!) })}
        </p>
      </div>
    );
  }

  // 6. REVIEW CAPTURE (Before Sending to AI)
  if (view === 'review') {
      const colors = getBrandingColors();
      return (
          <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center p-3 md:p-8 overflow-hidden">
              <h2 className="text-xl md:text-3xl text-slate-900 font-display mb-2 md:mb-4 flex-shrink-0">{t('kiosk.lookGood')}</h2>
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
                    <RefreshCw size={18} className="md:w-6 md:h-6" /> {t('kiosk.retake')}
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
                    {t('kiosk.generateAI')} <ArrowRight size={18} className="md:w-6 md:h-6" />
                  </button>
              </div>
          </div>
      )
  }

  // 7. RESULT & DELIVERY
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
            {t('kiosk.longPressToSave')}
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
                <h2 className="text-xl md:text-4xl text-slate-900 font-bold">{t('kiosk.sent')}</h2>
                <p className="text-sm md:text-base text-slate-600">{t('kiosk.checkYourPhone')}</p>

                <div className="pt-3 md:pt-6 space-y-2 md:space-y-4">
                  {event.downloadEnabled !== false && (
                  <button
                    onClick={handleDownload}
                    className="w-full text-white font-bold text-sm md:text-lg py-3 md:py-4 rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px]"
                    style={{
                      backgroundColor: colors.primary,
                      boxShadow: `0 10px 25px ${colors.primary}50`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <Download size={18} className="md:w-6 md:h-6" /> {t('kiosk.downloadPhoto')}
                  </button>
                  )}

                  <button
                    onClick={() => setView('result')}
                    className="w-full bg-slate-900 text-white font-bold text-sm md:text-lg py-3 md:py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <RefreshCw size={18} className="md:w-6 md:h-6" /> {t('kiosk.sendToAnother')}
                  </button>
                </div>

                {event.galleryEnabled && event.smugmugGalleryUrl && (
                  <button
                    onClick={() => window.open(event.smugmugGalleryUrl!, '_blank', 'noopener,noreferrer')}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm md:text-lg py-3 md:py-4 rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px] border-2 border-slate-300"
                  >
                    <Images size={18} className="md:w-6 md:h-6" /> {t('kiosk.viewEventGallery')}
                  </button>
                )}

                <p className="text-xs md:text-sm text-slate-500 mt-4 md:mt-8">{t('kiosk.startingOverIn', { seconds: deliveryCountdown })}</p>
                <button onClick={resetKiosk} className="text-xs md:text-sm text-slate-600 hover:text-slate-900 py-2">
                  {t('kiosk.startOverNow')}
                </button>

                {event.showAccountPromo !== false && (
                  <div className="mt-6 pt-6 border-t border-slate-300">
                    <p className="text-xs md:text-sm text-slate-600 mb-3">{t('kiosk.wantToCreate')}</p>
                    <a
                      href="/"
                      className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      {t('kiosk.getYourOwnAccount')}
                    </a>
                  </div>
                )}
             </div>
           ) : (
             <>
                <div>
                    <h2 className="text-xl md:text-3xl lg:text-4xl text-slate-900 font-display font-bold mb-1 md:mb-2">{t('kiosk.getYourPhoto')}</h2>
                    <p className="text-xs md:text-base text-slate-600">
                      {!shareUrl ? t('kiosk.downloadNow') : event.downloadEnabled !== false ? t('kiosk.downloadNowOrSent') : t('kiosk.getItSent')}
                    </p>
                </div>

                {errorMsg && (
                  <div className="w-full p-2 md:p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-800 text-center text-xs md:text-sm">
                    {errorMsg}
                  </div>
                )}

                {event.downloadEnabled !== false && (
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
                    <Download size={18} className="md:w-6 md:h-6" /> {t('kiosk.downloadNowBtn')}
                </button>
                )}

                {shareUrl && (event.smsEnabled !== false || event.whatsappEnabled || event.emailEnabled) && (
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-2 md:px-4 bg-white text-slate-500">{t('kiosk.orGetItSent')}</span>
                    </div>
                  </div>
                )}

                {shareUrl && event.smsEnabled !== false && (
                  <div className="space-y-1.5 md:space-y-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Smartphone size={14} /> {t('kiosk.sms')}
                    </label>
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
                    <button
                        onClick={handleSendSms}
                        disabled={isSending || phoneNumber.length < 3 || !shareUrl}
                        className="w-full bg-slate-900 text-white font-bold text-sm md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl hover:bg-slate-800 active:bg-slate-800 transition-colors flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 min-h-[44px]"
                    >
                        {!shareUrl ? t('kiosk.preparingLink') : isSending ? t('kiosk.sending') : <><Send size={18} className="md:w-6 md:h-6" /> {t('kiosk.sendSms')}</>}
                    </button>
                  </div>
                )}

                {shareUrl && event.whatsappEnabled && (
                  <div className="space-y-1.5 md:space-y-4">
                    <button
                        onClick={handleSendWhatsApp}
                        disabled={!shareUrl}
                        className="w-full bg-green-600 text-white font-bold text-sm md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl hover:bg-green-700 active:bg-green-700 transition-colors flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 min-h-[44px]"
                    >
                        {!shareUrl ? t('kiosk.preparingLink') : <><MessageCircle size={18} className="md:w-6 md:h-6" /> {t('kiosk.sendViaWhatsApp')}</>}
                    </button>
                    <p className="text-xs text-slate-500 text-center px-2">
                      {t('kiosk.whatsappConsent')}
                    </p>
                  </div>
                )}

                {shareUrl && event.emailEnabled && (
                  <div className="space-y-1.5 md:space-y-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Mail size={14} /> {t('kiosk.email')}
                    </label>
                    <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 md:px-6 py-2.5 md:py-4 text-base md:text-xl lg:text-2xl text-slate-900 focus:outline-none placeholder-slate-400 min-h-[44px]"
                        style={{
                          borderColor: emailAddress ? colors.accent : undefined,
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = colors.accent}
                        onBlur={(e) => {
                          if (!emailAddress) e.currentTarget.style.borderColor = '';
                        }}
                    />
                    <button
                        onClick={handleSendEmail}
                        disabled={isSending || !emailAddress.includes('@') || !shareUrl}
                        className="w-full bg-blue-600 text-white font-bold text-sm md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-xl hover:bg-blue-700 active:bg-blue-700 transition-colors flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 min-h-[44px]"
                    >
                        {!shareUrl ? t('kiosk.preparingLink') : isSending ? t('kiosk.sending') : <><Mail size={18} className="md:w-6 md:h-6" /> {t('kiosk.sendViaEmail')}</>}
                    </button>
                  </div>
                )}

                {shareUrl && shareUrl.length < 500 && event.qrSharingEnabled !== false && (
                  <div className="pt-2 md:pt-8 border-t border-slate-300">
                      <div className="flex items-center gap-2 md:gap-4 bg-slate-50 p-2 md:p-4 rounded-xl border-2 border-slate-300">
                          <div className="bg-white p-1 md:p-2 rounded-lg flex-shrink-0 border border-slate-300">
                              <QRCodeSVG
                                value={shareUrl}
                                size={50}
                                level="M"
                                includeMargin={false}
                                className="md:w-20 md:h-20"
                              />
                          </div>
                          <div>
                              <p className="text-xs md:text-base text-slate-900 font-bold">{t('kiosk.scanForInstantAccess')}</p>
                              <p className="text-xs text-slate-600">{t('kiosk.noPhoneRequired')}</p>
                          </div>
                      </div>
                  </div>
                )}

                {event.galleryEnabled && event.smugmugGalleryUrl && (
                  <button
                    onClick={() => window.open(event.smugmugGalleryUrl!, '_blank', 'noopener,noreferrer')}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm md:text-lg py-3 md:py-4 rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px] border-2 border-slate-300"
                  >
                    <Images size={18} className="md:w-6 md:h-6" /> {t('kiosk.viewEventGallery')}
                  </button>
                )}

                <button onClick={resetKiosk} className="text-center text-xs md:text-base text-slate-600 hover:text-slate-900 active:text-slate-900 py-2">
                    {t('kiosk.skipStartOver')}
                </button>

                {event.showAccountPromo !== false && (
                  <div className="mt-6 pt-6 border-t border-slate-300">
                    <p className="text-xs md:text-sm text-slate-600 mb-3">{t('kiosk.wantToCreate')}</p>
                    <a
                      href="/"
                      className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      {t('kiosk.getYourOwnAccount')}
                    </a>
                  </div>
                )}
             </>
           )}
        </div>
      </div>
    );
  }

  return <div>{t('kiosk.loading')}</div>;
  };

  const verifyPasscode = (): boolean => {
    return hasPasscode && passcodeInput === event.kioskPasscode;
  };

  const handlePasscodeSubmit = () => {
    if (passcodeInput === event.kioskPasscode) {
      setShowPasscodePrompt(false);
      setPasscodeInput('');
      setPasscodeError(false);
      if (passcodeAction === 'exit') {
        exitFullscreen();
        onExit();
      }
    } else {
      setPasscodeError(true);
      setPasscodeInput('');
    }
  };

  const handlePasscodeCancel = () => {
    setShowPasscodePrompt(false);
    setPasscodeInput('');
    setPasscodeError(false);
    if (passcodeAction === 'fullscreen' && fullscreenEnabled && !document.fullscreenElement) {
      requestFullscreen();
    }
  };

  const handleExitKiosk = () => {
    if (hasPasscode) {
      setPasscodeAction('exit');
      setPasscodeInput('');
      setPasscodeError(false);
      setShowPasscodePrompt(true);
    } else {
      exitFullscreen();
      onExit();
    }
  };

  return (
    <div ref={kioskContainerRef} className="kiosk-fullscreen-container">
      {renderView()}
      {showPasscodePrompt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="text-slate-700" size={20} />
                <h3 className="text-lg font-bold text-slate-900">{t('kiosk.enterPasscode')}</h3>
              </div>
              <button onClick={handlePasscodeCancel} className="text-slate-400 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600">{t('kiosk.enterPasscodeDesc')}</p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={passcodeInput}
              onChange={(e) => { setPasscodeInput(e.target.value); setPasscodeError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasscodeSubmit(); }}
              className={`w-full text-center text-2xl tracking-[0.5em] font-mono px-4 py-3 border-2 rounded-lg focus:outline-none ${
                passcodeError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-slate-700'
              }`}
              placeholder="••••"
            />
            {passcodeError && (
              <p className="text-sm text-red-600 text-center">{t('kiosk.incorrectPasscode')}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handlePasscodeCancel}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
              >
                {t('kiosk.cancel')}
              </button>
              <button
                onClick={handlePasscodeSubmit}
                disabled={!passcodeInput}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                {t('kiosk.enterPasscode')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskMode;
