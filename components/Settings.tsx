import React, { useState, useEffect } from 'react';
import { Tenant } from '../types';
import { Save, Eye, EyeOff, Check, X, Sparkles } from 'lucide-react';
import { getGlobalSettings, updateGlobalSettings } from '../services/backendService';

interface SettingsProps {
  tenant: Tenant;
  onSave: (updates: Partial<Tenant>) => Promise<void>;
  isAdmin?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ tenant, onSave, isAdmin = false }) => {
  const maskValue = (value: string | undefined) => {
    return value && value.length > 0 ? '•'.repeat(20) : '';
  };

  const [isConnectingDropbox, setIsConnectingDropbox] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(!!tenant.dropboxAccessToken);
  const [dropboxEnabled, setDropboxEnabled] = useState(tenant.dropboxEnabled || false);

  const [isConnectingSmugMug, setIsConnectingSmugMug] = useState(false);
  const [smugMugConnected, setSmugMugConnected] = useState(false);
  const [smugMugUserNickname, setSmugMugUserNickname] = useState('');
  const [smugMugConnectionStatus, setSmugMugConnectionStatus] = useState('disconnected');
  const [smugMugDefaultVisibility, setSmugMugDefaultVisibility] = useState('private');
  const [useSmugMugForSMS, setUseSmugMugForSMS] = useState(true);

  const [twilioSid, setTwilioSid] = useState(tenant.twilioAccountSid || '');
  const [twilioToken, setTwilioToken] = useState(maskValue(tenant.twilioAuthToken));
  const [twilioPhone, setTwilioPhone] = useState(tenant.twilioPhoneNumber || '');
  const [twilioEnabled, setTwilioEnabled] = useState(tenant.twilioEnabled || false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [twilioTokenChanged, setTwilioTokenChanged] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [geminiModel, setGeminiModel] = useState(tenant.geminiModel || 'gemini-3-pro-image-preview');
  const [geminiResolution, setGeminiResolution] = useState<'1K' | '2K' | '4K'>(tenant.geminiResolution || '1K');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeyChanged, setGeminiKeyChanged] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadGlobalSettings();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadGlobalSettings();
    }
  }, []);

  const loadGlobalSettings = async () => {
    try {
      const settings = await getGlobalSettings();
      setGeminiApiKey(maskValue(settings.gemini_api_key));
      setGeminiEnabled(settings.gemini_enabled === 'true');

      if (settings.smugmug_connection_status) {
        setSmugMugConnectionStatus(settings.smugmug_connection_status);
        setSmugMugConnected(settings.smugmug_connection_status === 'connected');
        setSmugMugUserNickname(settings.smugmug_user_nickname || '');
        setSmugMugDefaultVisibility(settings.smugmug_default_visibility || 'private');
        setUseSmugMugForSMS(settings.use_smugmug_for_sms !== false);
      }
    } catch (error) {
      console.error('Failed to load global settings:', error);
    }
  };

  const handleConnectDropbox = () => {
    setIsConnectingDropbox(true);

    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth-callback`;
    const authUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth-initiate?tenant_id=${tenant.id}`;

    const popup = window.open(authUrl, 'Dropbox OAuth', 'width=600,height=700');

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'dropbox-oauth-success') {
        setIsConnectingDropbox(false);
        window.removeEventListener('message', handleMessage);
        if (popup) popup.close();

        await onSave({});

        setDropboxConnected(true);
        setDropboxEnabled(true);
        alert('Successfully connected to Dropbox!');
      } else if (event.data.type === 'dropbox-oauth-error') {
        setIsConnectingDropbox(false);
        window.removeEventListener('message', handleMessage);
        if (popup) popup.close();
        alert(`Failed to connect to Dropbox: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);

    const checkPopup = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkPopup);
        setIsConnectingDropbox(false);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);
  };

  const handleDisconnectDropbox = async () => {
    if (confirm('Are you sure you want to disconnect Dropbox?')) {
      await onSave({
        dropboxAccessToken: null,
        dropboxRefreshToken: null,
        dropboxTokenExpiresAt: null,
        dropboxEnabled: false,
      });
      setDropboxConnected(false);
      setDropboxEnabled(false);
    }
  };

  const handleConnectSmugMug = async () => {
    setIsConnectingSmugMug(true);

    try {
      const appOrigin = window.location.origin;
      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-oauth-callback`;
      const initiateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-oauth-initiate?callback_url=${encodeURIComponent(callbackUrl)}&app_origin=${encodeURIComponent(appOrigin)}`;

      console.log('🔵 SmugMug OAuth - Initiating with URL:', initiateUrl);

      const response = await fetch(initiateUrl);

      console.log('🔵 SmugMug OAuth - Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 SmugMug OAuth - Error response:', errorText);
        throw new Error('Failed to initiate SmugMug OAuth');
      }

      const responseData = await response.json();
      console.log('🔵 SmugMug OAuth - Response data:', responseData);

      if (!responseData.authorizeUrl) {
        console.error('🔴 SmugMug OAuth - No authorizeUrl in response');
        throw new Error('No authorization URL received');
      }

      console.log('🔵 SmugMug OAuth - Opening popup to:', responseData.authorizeUrl);

      const popup = window.open(responseData.authorizeUrl, 'SmugMug OAuth', 'width=800,height=700');

      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'smugmug-oauth-success') {
          setIsConnectingSmugMug(false);
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();

          await loadGlobalSettings();
          alert('Successfully connected to SmugMug!');
        } else if (event.data.type === 'smugmug-oauth-error') {
          setIsConnectingSmugMug(false);
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();
          alert(`Failed to connect to SmugMug: ${event.data.error}`);
        }
      };

      window.addEventListener('message', handleMessage);

      const checkPopup = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopup);
          setIsConnectingSmugMug(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);
    } catch (error) {
      console.error('🔴 SmugMug OAuth error:', error);
      alert('Failed to connect to SmugMug. Please try again.');
      setIsConnectingSmugMug(false);
    }
  };

  const handleDisconnectSmugMug = async () => {
    if (confirm('Are you sure you want to disconnect SmugMug?')) {
      try {
        await updateGlobalSettings({
          smugmug_oauth_token: null,
          smugmug_oauth_token_secret: null,
          smugmug_user_nickname: null,
          smugmug_connection_status: 'disconnected',
        });
        setSmugMugConnected(false);
        setSmugMugConnectionStatus('disconnected');
        setSmugMugUserNickname('');
      } catch (error) {
        console.error('Failed to disconnect SmugMug:', error);
        alert('Failed to disconnect SmugMug. Please try again.');
      }
    }
  };

  const handleTwilioTokenChange = (value: string) => {
    setTwilioToken(value);
    setTwilioTokenChanged(true);
  };

  const handleGeminiKeyChange = (value: string) => {
    console.log('Gemini key changed:', { length: value.length, startsWithDot: value.startsWith('•') });
    setGeminiApiKey(value);
    setGeminiKeyChanged(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const tenantUpdates: any = {
        twilioAccountSid: twilioSid,
        twilioPhoneNumber: twilioPhone,
        twilioEnabled,
        geminiModel,
        geminiResolution,
      };

      if (twilioTokenChanged) {
        tenantUpdates.twilioAuthToken = twilioToken;
      }

      await onSave(tenantUpdates);

      if (isAdmin) {
        const globalSettings: Record<string, any> = {
          gemini_enabled: geminiEnabled ? 'true' : 'false',
          smugmug_default_visibility: smugMugDefaultVisibility,
          use_smugmug_for_sms: useSmugMugForSMS,
        };

        if (geminiKeyChanged) {
          globalSettings.gemini_api_key = geminiApiKey;
        }

        await updateGlobalSettings(globalSettings);
      }

      setTwilioTokenChanged(false);
      setGeminiKeyChanged(false);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <path d="M12 9.6L24 16.8L12 24L0 16.8L12 9.6Z" fill="#15803d"/>
              <path d="M0 24L12 31.2L24 24L12 16.8L0 24Z" fill="#15803d"/>
              <path d="M12 31.2L24 38.4L36 31.2L24 24L12 31.2Z" fill="#15803d"/>
              <path d="M24 24L36 31.2L48 24L36 16.8L24 24Z" fill="#15803d"/>
              <path d="M24 16.8L36 9.6L48 16.8L36 24L24 16.8Z" fill="#15803d"/>
            </svg>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Dropbox Integration</h3>
              <p className="text-slate-600 text-sm">Connect Dropbox to automatically backup all photos</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {dropboxConnected ? (
            <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="text-green-700" size={24} />
                <div>
                  <p className="font-medium text-green-800">Connected to Dropbox</p>
                  <p className="text-sm text-slate-600">Your photos will be automatically backed up</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectDropbox}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <div className="text-center py-8">
                <p className="text-slate-700 mb-6">Connect your Dropbox account to automatically backup all event photos.</p>
                <button
                  onClick={handleConnectDropbox}
                  disabled={isConnectingDropbox}
                  className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-8 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mx-auto"
                >
                  {isConnectingDropbox ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 48 48" fill="currentColor">
                        <path d="M12 9.6L24 16.8L12 24L0 16.8L12 9.6Z"/>
                        <path d="M0 24L12 31.2L24 24L12 16.8L0 24Z"/>
                        <path d="M12 31.2L24 38.4L36 31.2L24 24L12 31.2Z"/>
                        <path d="M24 24L36 31.2L48 24L36 16.8L24 24Z"/>
                        <path d="M24 16.8L36 9.6L48 16.8L36 24L24 16.8Z"/>
                      </svg>
                      Connect to Dropbox
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Simple Setup:</strong> Click the button above to log in with your Dropbox credentials. A folder will be automatically created for each event to organize all photos.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" fill="#0066CC"/>
                <path d="M24 14L34 19V29L24 34L14 29V19L24 14Z" fill="white"/>
              </svg>
              <div>
                <h3 className="text-xl font-bold text-slate-900">SmugMug Integration</h3>
                <p className="text-slate-600 text-sm">Connect SmugMug for photo galleries and SMS delivery</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {smugMugConnected ? (
              <div className={`p-4 rounded-lg border-2 flex items-center justify-between ${
                smugMugConnectionStatus === 'connected'
                  ? 'bg-green-50 border-green-700/30'
                  : 'bg-yellow-50 border-yellow-700/30'
              }`}>
                <div className="flex items-center gap-3">
                  {smugMugConnectionStatus === 'connected' ? (
                    <Check className="text-green-700" size={24} />
                  ) : (
                    <X className="text-yellow-700" size={24} />
                  )}
                  <div>
                    <p className={`font-medium ${
                      smugMugConnectionStatus === 'connected' ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {smugMugConnectionStatus === 'connected' ? 'Connected to SmugMug' : 'Needs Attention'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {smugMugUserNickname && `Account: ${smugMugUserNickname}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConnectSmugMug}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Reauthorize
                  </button>
                  <button
                    onClick={handleDisconnectSmugMug}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center py-8">
                  <p className="text-slate-700 mb-6">Connect your SmugMug account to automatically create galleries and share photos with guests.</p>
                  <button
                    onClick={handleConnectSmugMug}
                    disabled={isConnectingSmugMug}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-8 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mx-auto"
                  >
                    {isConnectingSmugMug ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 48 48" fill="currentColor">
                          <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z"/>
                          <path d="M24 14L34 19V29L24 34L14 29V19L24 14Z" fill="#0066CC"/>
                        </svg>
                        Connect to SmugMug
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 bg-blue-50 border-2 border-blue-700/30 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Simple Setup:</strong> Click the button above to authorize with your SmugMug account. The connection will remain active indefinitely, and galleries will be created automatically for each event.
                  </p>
                </div>
              </>
            )}

            {smugMugConnected && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Default Gallery Visibility</label>
                  <select
                    value={smugMugDefaultVisibility}
                    onChange={(e) => setSmugMugDefaultVisibility(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  >
                    <option value="private">Private (Link-Only)</option>
                    <option value="public">Public</option>
                  </select>
                  <p className="text-xs text-slate-600 mt-2">
                    Private galleries are not searchable or publicly listed, accessible only via direct URL.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
                  <input
                    type="checkbox"
                    checked={useSmugMugForSMS}
                    onChange={(e) => setUseSmugMugForSMS(e.target.checked)}
                    className="w-5 h-5 rounded accent-green-700"
                    id="smugmug-sms-enabled"
                  />
                  <label htmlFor="smugmug-sms-enabled" className="flex-1 cursor-pointer">
                    <span className="font-medium text-slate-900">Use SmugMug links for SMS delivery</span>
                    <p className="text-sm text-slate-600">Send gallery links instead of Dropbox links via text message</p>
                  </label>
                  {useSmugMugForSMS && <Check className="text-green-700" size={20} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#F22F46"/>
              <circle cx="18" cy="18" r="3.5" fill="white"/>
              <circle cx="30" cy="18" r="3.5" fill="white"/>
              <circle cx="18" cy="30" r="3.5" fill="white"/>
              <circle cx="30" cy="30" r="3.5" fill="white"/>
            </svg>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Twilio Integration</h3>
              <p className="text-slate-600 text-sm">Send photos via SMS to guests using Twilio</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
            <input
              type="checkbox"
              checked={twilioEnabled}
              onChange={(e) => setTwilioEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-green-700"
              id="twilio-enabled"
            />
            <label htmlFor="twilio-enabled" className="flex-1 cursor-pointer">
              <span className="font-medium text-slate-900">Enable SMS Delivery</span>
              <p className="text-sm text-slate-600">Allow guests to receive photos via text message</p>
            </label>
            {twilioEnabled && <Check className="text-green-700" size={20} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Account SID</label>
            <input
              type="text"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="AC..."
              className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Auth Token</label>
            <div className="relative">
              <input
                type={showTwilioToken ? 'text' : 'password'}
                value={twilioToken}
                onChange={(e) => handleTwilioTokenChange(e.target.value)}
                placeholder="Enter your Twilio auth token"
                className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-green-700"
              />
              <button
                type="button"
                onClick={() => setShowTwilioToken(!showTwilioToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900"
              >
                {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {twilioToken.startsWith('•') && (
              <p className="text-xs text-green-700 mt-2">✓ Token is saved (hidden for security)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Phone Number</label>
            <input
              type="tel"
              value={twilioPhone}
              onChange={(e) => setTwilioPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
            />
            <p className="text-xs text-slate-600 mt-2">
              Use E.164 format (e.g., +12125551234)
            </p>
          </div>

          <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Note:</strong> Get your credentials from the{' '}
              <a
                href="https://console.twilio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-700"
              >
                Twilio Console
              </a>
              . You'll need an active Twilio account with a phone number.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <Sparkles className="text-green-700" size={24} />
            <div>
              <h3 className="text-xl font-bold text-slate-900">AI Model Configuration</h3>
              <p className="text-slate-600 text-sm">Configure which Gemini model to use for image generation</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Gemini Model</label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
            >
              <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (Preview)</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </select>
            <p className="text-xs text-slate-600 mt-2">
              Select which Gemini model to use for AI image generation. Different models offer different capabilities and performance characteristics.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Image Resolution</label>
            <select
              value={geminiResolution}
              onChange={(e) => setGeminiResolution(e.target.value as '1K' | '2K' | '4K')}
              className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
            >
              <option value="1K">1K (Standard - Fastest)</option>
              <option value="2K">2K (High Quality)</option>
              <option value="4K">4K (Ultra Quality - Slowest)</option>
            </select>
            <p className="text-xs text-slate-600 mt-2">
              Higher resolutions provide better image quality but may take longer to generate and use more API credits.
            </p>
          </div>

          <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recommended:</strong> Gemini 3 Pro Image is optimized for high-quality image generation with advanced capabilities. Use 1K resolution for optimal performance and cost efficiency.
            </p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
            <div className="flex items-center gap-3">
              <Sparkles className="text-green-700" size={24} />
              <div>
                <h3 className="text-xl font-bold text-slate-900">Google Gemini Pro</h3>
                <p className="text-slate-600 text-sm">Global AI configuration for all users</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
            <input
              type="checkbox"
              checked={geminiEnabled}
              onChange={(e) => setGeminiEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-green-700"
              id="gemini-enabled"
            />
            <label htmlFor="gemini-enabled" className="flex-1 cursor-pointer">
              <span className="font-medium text-slate-900">Enable Gemini Pro API</span>
              <p className="text-sm text-slate-600">Use Google Gemini for AI image generation</p>
            </label>
            {geminiEnabled && <Check className="text-green-700" size={20} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => handleGeminiKeyChange(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-green-700"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900"
              >
                {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {geminiApiKey.startsWith('•') ? (
                <span className="text-green-700">✓ API key is saved (hidden for security)</span>
              ) : (
                <>
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Note:</strong> Gemini Pro provides advanced AI capabilities for generating high-quality images.
              You can get started for free at{' '}
              <a
                href="https://ai.google.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-700"
              >
                Google AI for Developers
              </a>
              .
            </p>
          </div>
        </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-700 animate-fade-in">
            <Check size={18} />
            <span className="text-sm font-medium">Settings saved successfully</span>
          </div>
        )}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;
