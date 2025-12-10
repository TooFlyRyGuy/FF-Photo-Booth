import React, { useState } from 'react';
import { Tenant } from '../types';
import { Save, Eye, EyeOff, Check, X, Sparkles } from 'lucide-react';

interface SettingsProps {
  tenant: Tenant;
  onSave: (updates: Partial<Tenant>) => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({ tenant, onSave }) => {
  const maskValue = (value: string | undefined) => {
    return value && value.length > 0 ? '•'.repeat(20) : '';
  };

  const [dropboxAppKey, setDropboxAppKey] = useState(tenant.dropboxAppKey || '');
  const [dropboxAppSecret, setDropboxAppSecret] = useState(maskValue(tenant.dropboxAppSecret));
  const [dropboxEnabled, setDropboxEnabled] = useState(tenant.dropboxEnabled || false);
  const [showDropboxSecret, setShowDropboxSecret] = useState(false);
  const [dropboxSecretChanged, setDropboxSecretChanged] = useState(false);

  const [twilioSid, setTwilioSid] = useState(tenant.twilioAccountSid || '');
  const [twilioToken, setTwilioToken] = useState(maskValue(tenant.twilioAuthToken));
  const [twilioPhone, setTwilioPhone] = useState(tenant.twilioPhoneNumber || '');
  const [twilioEnabled, setTwilioEnabled] = useState(tenant.twilioEnabled || false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [twilioTokenChanged, setTwilioTokenChanged] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState(maskValue(tenant.geminiApiKey));
  const [geminiEnabled, setGeminiEnabled] = useState(tenant.geminiEnabled || false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeyChanged, setGeminiKeyChanged] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleDropboxSecretChange = (value: string) => {
    setDropboxAppSecret(value);
    setDropboxSecretChanged(true);
  };

  const handleTwilioTokenChange = (value: string) => {
    setTwilioToken(value);
    setTwilioTokenChanged(true);
  };

  const handleGeminiKeyChange = (value: string) => {
    setGeminiApiKey(value);
    setGeminiKeyChanged(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updates: any = {
        dropboxAppKey,
        dropboxEnabled,
        twilioAccountSid: twilioSid,
        twilioPhoneNumber: twilioPhone,
        twilioEnabled,
        geminiEnabled,
      };

      if (dropboxSecretChanged) {
        updates.dropboxAppSecret = dropboxAppSecret;
      }

      if (twilioTokenChanged) {
        updates.twilioAuthToken = twilioToken;
      }

      if (geminiKeyChanged) {
        updates.geminiApiKey = geminiApiKey;
      }

      await onSave(updates);

      setDropboxSecretChanged(false);
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
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <path d="M12 9.6L24 16.8L12 24L0 16.8L12 9.6Z" fill="#0061FF"/>
              <path d="M0 24L12 31.2L24 24L12 16.8L0 24Z" fill="#0061FF"/>
              <path d="M12 31.2L24 38.4L36 31.2L24 24L12 31.2Z" fill="#0061FF"/>
              <path d="M24 24L36 31.2L48 24L36 16.8L24 24Z" fill="#0061FF"/>
              <path d="M24 16.8L36 9.6L48 16.8L36 24L24 16.8Z" fill="#0061FF"/>
            </svg>
            <div>
              <h3 className="text-xl font-bold">Dropbox Integration</h3>
              <p className="text-slate-400 text-sm">Connect Dropbox to automatically backup all photos</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              checked={dropboxEnabled}
              onChange={(e) => setDropboxEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-blue-500"
              id="dropbox-enabled"
            />
            <label htmlFor="dropbox-enabled" className="flex-1 cursor-pointer">
              <span className="font-medium">Enable Dropbox Sync</span>
              <p className="text-sm text-slate-400">Automatically upload photos to your Dropbox</p>
            </label>
            {dropboxEnabled && <Check className="text-green-400" size={20} />}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">App Key</label>
            <input
              type="text"
              value={dropboxAppKey}
              onChange={(e) => setDropboxAppKey(e.target.value)}
              placeholder="Enter your Dropbox app key"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">App Secret</label>
            <div className="relative">
              <input
                type={showDropboxSecret ? 'text' : 'password'}
                value={dropboxAppSecret}
                onChange={(e) => handleDropboxSecretChange(e.target.value)}
                placeholder="Enter your Dropbox app secret"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowDropboxSecret(!showDropboxSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showDropboxSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {dropboxAppSecret.startsWith('•') ? (
                <span className="text-green-400">✓ Secret is saved (hidden for security)</span>
              ) : (
                <>
                  Create a Dropbox app and get your credentials from the{' '}
                  <a
                    href="https://www.dropbox.com/developers/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Dropbox App Console
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> A new folder will be automatically created in your Dropbox for each event to organize all photos.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#F22F46"/>
              <circle cx="18" cy="18" r="3.5" fill="white"/>
              <circle cx="30" cy="18" r="3.5" fill="white"/>
              <circle cx="18" cy="30" r="3.5" fill="white"/>
              <circle cx="30" cy="30" r="3.5" fill="white"/>
            </svg>
            <div>
              <h3 className="text-xl font-bold">Twilio Integration</h3>
              <p className="text-slate-400 text-sm">Send photos via SMS to guests using Twilio</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              checked={twilioEnabled}
              onChange={(e) => setTwilioEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-green-500"
              id="twilio-enabled"
            />
            <label htmlFor="twilio-enabled" className="flex-1 cursor-pointer">
              <span className="font-medium">Enable SMS Delivery</span>
              <p className="text-sm text-slate-400">Allow guests to receive photos via text message</p>
            </label>
            {twilioEnabled && <Check className="text-green-400" size={20} />}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Account SID</label>
            <input
              type="text"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="AC..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Auth Token</label>
            <div className="relative">
              <input
                type={showTwilioToken ? 'text' : 'password'}
                value={twilioToken}
                onChange={(e) => handleTwilioTokenChange(e.target.value)}
                placeholder="Enter your Twilio auth token"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => setShowTwilioToken(!showTwilioToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {twilioToken.startsWith('•') && (
              <p className="text-xs text-green-400 mt-2">✓ Token is saved (hidden for security)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={twilioPhone}
              onChange={(e) => setTwilioPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              Use E.164 format (e.g., +12125551234)
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> Get your credentials from the{' '}
              <a
                href="https://console.twilio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-200"
              >
                Twilio Console
              </a>
              . You'll need an active Twilio account with a phone number.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Sparkles className="text-amber-400" size={24} />
            <div>
              <h3 className="text-xl font-bold">Google Gemini Pro</h3>
              <p className="text-slate-400 text-sm">Power AI image generation with Google Gemini Pro</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              checked={geminiEnabled}
              onChange={(e) => setGeminiEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-amber-500"
              id="gemini-enabled"
            />
            <label htmlFor="gemini-enabled" className="flex-1 cursor-pointer">
              <span className="font-medium">Enable Gemini Pro API</span>
              <p className="text-sm text-slate-400">Use Google Gemini for AI image generation</p>
            </label>
            {geminiEnabled && <Check className="text-green-400" size={20} />}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => handleGeminiKeyChange(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {geminiApiKey.startsWith('•') ? (
                <span className="text-green-400">✓ API key is saved (hidden for security)</span>
              ) : (
                <>
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-300">
              <strong>Note:</strong> Gemini Pro provides advanced AI capabilities for generating high-quality images.
              You can get started for free at{' '}
              <a
                href="https://ai.google.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-200"
              >
                Google AI for Developers
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-400 animate-fade-in">
            <Check size={18} />
            <span className="text-sm font-medium">Settings saved successfully</span>
          </div>
        )}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
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
