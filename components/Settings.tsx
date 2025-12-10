import React, { useState } from 'react';
import { Tenant } from '../types';
import { Save, Eye, EyeOff, Link2, MessageSquare, Check, X } from 'lucide-react';

interface SettingsProps {
  tenant: Tenant;
  onSave: (updates: Partial<Tenant>) => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({ tenant, onSave }) => {
  const [dropboxToken, setDropboxToken] = useState(tenant.dropboxAccessToken || '');
  const [dropboxEnabled, setDropboxEnabled] = useState(tenant.dropboxEnabled || false);
  const [showDropboxToken, setShowDropboxToken] = useState(false);

  const [twilioSid, setTwilioSid] = useState(tenant.twilioAccountSid || '');
  const [twilioToken, setTwilioToken] = useState(tenant.twilioAuthToken || '');
  const [twilioPhone, setTwilioPhone] = useState(tenant.twilioPhoneNumber || '');
  const [twilioEnabled, setTwilioEnabled] = useState(tenant.twilioEnabled || false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSave({
        dropboxAccessToken: dropboxToken,
        dropboxEnabled,
        twilioAccountSid: twilioSid,
        twilioAuthToken: twilioToken,
        twilioPhoneNumber: twilioPhone,
        twilioEnabled,
      });

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
            <Link2 className="text-blue-400" size={24} />
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
            <label className="block text-sm font-medium mb-2">Access Token</label>
            <div className="relative">
              <input
                type={showDropboxToken ? 'text' : 'password'}
                value={dropboxToken}
                onChange={(e) => setDropboxToken(e.target.value)}
                placeholder="Enter your Dropbox access token"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowDropboxToken(!showDropboxToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showDropboxToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Get your access token from the{' '}
              <a
                href="https://www.dropbox.com/developers/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Dropbox App Console
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-green-400" size={24} />
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
                onChange={(e) => setTwilioToken(e.target.value)}
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
