import React, { useState, useEffect } from 'react';
import { UserSettings, GlobalSettings, UserProfile } from '../types';
import { Save, Eye, EyeOff, Check, Sparkles, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../lib/i18n';

interface SettingsProps {
  userSettings: UserSettings;
  globalSettings: GlobalSettings;
  userProfile: UserProfile;
  onSaveUserSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onSaveGlobalSettings: (updates: Partial<GlobalSettings>) => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({
  userSettings,
  globalSettings,
  userProfile,
  onSaveUserSettings,
  onSaveGlobalSettings,
}) => {
  const isAdmin = userProfile.role === 'admin';

  // Dropbox states (user-specific)
  const [isConnectingDropbox, setIsConnectingDropbox] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(!!userSettings.dropboxAccessToken);
  const [dropboxEnabled, setDropboxEnabled] = useState(userSettings.dropboxEnabled || false);
  const [dropboxAppKey, setDropboxAppKey] = useState(userProfile.dropbox_app_key || '');
  const [dropboxAppSecret, setDropboxAppSecret] = useState(userProfile.dropbox_app_secret || '');
  const [showDropboxSecret, setShowDropboxSecret] = useState(false);

  // SmugMug states (global, admin only)
  const [isConnectingSmugMug, setIsConnectingSmugMug] = useState(false);
  const [smugMugConnected, setSmugMugConnected] = useState(globalSettings.smugmugConnectionStatus === 'connected');
  const [smugMugUserNickname, setSmugMugUserNickname] = useState(globalSettings.smugmugUserNickname || '');
  const [smugMugConnectionStatus, setSmugMugConnectionStatus] = useState(globalSettings.smugmugConnectionStatus || 'disconnected');

  // Twilio states (global, admin only)
  // twilioToken holds a NEW value typed by admin; never receives the stored token from server
  const [twilioSid, setTwilioSid] = useState(globalSettings.twilioAccountSid || '');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioPhone, setTwilioPhone] = useState(globalSettings.twilioPhoneNumber || '');
  const [twilioEnabled, setTwilioEnabled] = useState(globalSettings.twilioEnabled || false);

  // Gemini states (global, admin only)
  // geminiApiKey holds a NEW value typed by admin; never receives the stored key from server
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiEnabled, setGeminiEnabled] = useState(globalSettings.geminiEnabled || false);
  const [geminiModel, setGeminiModel] = useState(globalSettings.geminiModel || 'gemini-3.1-flash-image');
  const [geminiResolution, setGeminiResolution] = useState<'1K' | '2K' | '4K'>(globalSettings.geminiResolution || '1K');

  // Library webhook (global, admin only)
  const [libraryWebhookUrl, setLibraryWebhookUrl] = useState(globalSettings.libraryWebhookUrl || '');

  // SMTP states (global, admin only)
  // smtpPassword holds a NEW value typed by admin; never receives the stored password from server
  const [smtpHost, setSmtpHost] = useState(globalSettings.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState<number | ''>(globalSettings.smtpPort || '');
  const [smtpUsername, setSmtpUsername] = useState(globalSettings.smtpUsername || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState(globalSettings.smtpFromEmail || '');
  const [smtpFromName, setSmtpFromName] = useState(globalSettings.smtpFromName || '');
  const [smtpEnabled, setSmtpEnabled] = useState(globalSettings.smtpEnabled || false);

  // Account language
  const [accountLanguage, setAccountLanguage] = useState<LanguageCode>(
    (userSettings.accountLanguage as LanguageCode) || 'en-US'
  );

  // Save states
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [saveUserSuccess, setSaveUserSuccess] = useState(false);
  const [saveGlobalSuccess, setSaveGlobalSuccess] = useState(false);

  useEffect(() => {
    setDropboxConnected(!!userSettings.dropboxAccessToken);
    setDropboxEnabled(userSettings.dropboxEnabled || false);
    setAccountLanguage((userSettings.accountLanguage as LanguageCode) || 'en-US');
  }, [userSettings.dropboxAccessToken, userSettings.dropboxEnabled, userSettings.accountLanguage]);

  useEffect(() => {
    setSmugMugConnected(globalSettings.smugmugConnectionStatus === 'connected');
    setSmugMugUserNickname(globalSettings.smugmugUserNickname || '');
    setSmugMugConnectionStatus(globalSettings.smugmugConnectionStatus || 'disconnected');
    setTwilioSid(globalSettings.twilioAccountSid || '');
    setTwilioPhone(globalSettings.twilioPhoneNumber || '');
    setTwilioEnabled(globalSettings.twilioEnabled || false);
    setGeminiEnabled(globalSettings.geminiEnabled || false);
    setGeminiModel(globalSettings.geminiModel || 'gemini-3.1-flash-image');
    setGeminiResolution(globalSettings.geminiResolution || '1K');
    setLibraryWebhookUrl(globalSettings.libraryWebhookUrl || '');
    setSmtpHost(globalSettings.smtpHost || '');
    setSmtpPort(globalSettings.smtpPort || '');
    setSmtpUsername(globalSettings.smtpUsername || '');
    setSmtpFromEmail(globalSettings.smtpFromEmail || '');
    setSmtpFromName(globalSettings.smtpFromName || '');
    setSmtpEnabled(globalSettings.smtpEnabled || false);
    // Never populate key fields from server — admin must type a new value to update
  }, [globalSettings]);

  const handleConnectDropbox = async () => {
    setIsConnectingDropbox(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Not authenticated');
        setIsConnectingDropbox(false);
        return;
      }

      const initiateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth-initiate`;

      const response = await fetch(initiateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to initiate Dropbox connection');
      }

      const { authUrl } = await response.json();

      const popup = window.open(authUrl, 'Dropbox OAuth', 'width=600,height=700');

      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'dropbox-oauth-success') {
          setIsConnectingDropbox(false);
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();

          await onSaveUserSettings({});
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
    } catch (error) {
      console.error('Dropbox connection error:', error);
      alert(`Failed to connect to Dropbox: ${error instanceof Error ? error.message : String(error)}`);
      setIsConnectingDropbox(false);
    }
  };

  const handleDisconnectDropbox = async () => {
    if (confirm('Are you sure you want to disconnect Dropbox?')) {
      await onSaveUserSettings({
        dropboxAccessToken: null,
        dropboxRefreshToken: null,
        dropboxTokenExpiresAt: null,
        dropboxEnabled: false,
      });
    }
  };

  const handleConnectSmugMug = async () => {
    setIsConnectingSmugMug(true);

    try {
      const appOrigin = window.location.origin;
      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-oauth-callback`;
      const initiateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-oauth-initiate?callback_url=${encodeURIComponent(callbackUrl)}&app_origin=${encodeURIComponent(appOrigin)}`;

      const response = await fetch(initiateUrl);

      if (!response.ok) {
        throw new Error('Failed to initiate SmugMug OAuth');
      }

      const responseData = await response.json();

      if (!responseData.authorizeUrl) {
        throw new Error('No authorization URL received');
      }

      const popup = window.open(responseData.authorizeUrl, 'SmugMug OAuth', 'width=800,height=700');

      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'smugmug-oauth-success') {
          setIsConnectingSmugMug(false);
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();

          // Reload settings to get updated SmugMug connection info
          setSmugMugConnected(true);
          setSmugMugConnectionStatus('connected');
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
      console.error('SmugMug OAuth error:', error);
      alert('Failed to connect to SmugMug. Please try again.');
      setIsConnectingSmugMug(false);
    }
  };

  const handleDisconnectSmugMug = async () => {
    if (confirm('Are you sure you want to disconnect SmugMug?')) {
      try {
        await onSaveGlobalSettings({
          smugmugOauthToken: undefined,
          smugmugOauthTokenSecret: undefined,
          smugmugUserNickname: undefined,
          smugmugConnectionStatus: 'disconnected',
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
  };

  const handleGeminiKeyChange = (value: string) => {
    setGeminiApiKey(value);
  };

  const handleSaveUserSettings = async () => {
    setIsSavingUser(true);
    setSaveUserSuccess(false);

    try {
      const updates: Partial<UserSettings> = {
        dropboxEnabled,
        accountLanguage,
      };

      await onSaveUserSettings(updates);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          dropbox_app_key: dropboxAppKey || null,
          dropbox_app_secret: dropboxAppSecret || null,
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      setSaveUserSuccess(true);
      setTimeout(() => setSaveUserSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save user settings:', error);
      alert('Failed to save user settings. Please try again.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    setIsSavingGlobal(true);
    setSaveGlobalSuccess(false);

    try {
      const updates: Partial<GlobalSettings> = {
        twilioAccountSid: twilioSid,
        twilioPhoneNumber: twilioPhone,
        twilioEnabled,
        geminiEnabled,
        geminiModel,
        geminiResolution,
        libraryWebhookUrl,
        smtpHost,
        smtpPort: smtpPort === '' ? undefined : Number(smtpPort),
        smtpUsername,
        smtpFromEmail,
        smtpFromName,
        smtpEnabled,
      };

      // Only send the new token/key if admin actually typed one
      if (twilioToken.trim()) {
        updates.twilioAuthToken = twilioToken.trim();
      }
      if (geminiApiKey.trim()) {
        updates.geminiApiKey = geminiApiKey.trim();
      }
      if (smtpPassword.trim()) {
        updates.smtpPassword = smtpPassword.trim();
      }

      await onSaveGlobalSettings(updates);

      // Clear the input fields after save so they don't persist in state
      setTwilioToken('');
      setGeminiApiKey('');
      setSmtpPassword('');

      setSaveGlobalSuccess(true);
      setTimeout(() => setSaveGlobalSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save global settings:', error);
      alert('Failed to save global settings. Please try again.');
    } finally {
      setIsSavingGlobal(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Account Language */}
      <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <Globe className="text-green-700" size={24} />
            <div>
              <h3 className="text-xl font-bold text-slate-900">Account Language</h3>
              <p className="text-slate-600 text-sm">Choose the language for your dashboard and admin interface</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Language</label>
            <select
              value={accountLanguage}
              onChange={(e) => setAccountLanguage(e.target.value as LanguageCode)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 bg-white text-slate-900"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel === lang.label ? lang.nativeLabel : `${lang.nativeLabel} (${lang.label})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600 mt-2">
              This controls the language of your dashboard. Event kiosk language is set per-event in the event editor.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saveUserSuccess && (
              <div className="flex items-center gap-2 text-green-700 animate-fade-in">
                <Check size={18} />
                <span className="text-sm font-medium">Settings saved successfully</span>
              </div>
            )}
            <button
              onClick={handleSaveUserSettings}
              disabled={isSavingUser}
              className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {isSavingUser ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Language
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dropbox Integration */}
      <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <path d="M12 9.6L24 16.8L12 24L0 16.8L12 9.6Z" fill="#0061FF"/>
              <path d="M0 24L12 31.2L24 24L12 16.8L0 24Z" fill="#0061FF"/>
              <path d="M12 31.2L24 38.4L36 31.2L24 24L12 31.2Z" fill="#0061FF"/>
              <path d="M24 24L36 31.2L48 24L36 16.8L24 24Z" fill="#0061FF"/>
              <path d="M24 16.8L36 9.6L48 16.8L36 24L24 16.8Z" fill="#0061FF"/>
            </svg>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Dropbox Integration</h3>
              <p className="text-slate-600 text-sm">Connect your Dropbox account to automatically backup photos</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {!dropboxConnected && (
            <div className="space-y-4 mb-6 p-6 bg-slate-50 border-2 border-slate-300 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 mb-2">Setup Your Dropbox App</h4>
                  <p className="text-sm text-slate-700 mb-3">
                    To use Dropbox integration, you need to create your own Dropbox app and provide the credentials below.
                  </p>
                  <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
                    <li>Go to <a href="https://www.dropbox.com/developers/apps/create" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Dropbox App Console</a></li>
                    <li>Choose "Scoped access" API type</li>
                    <li>Choose "Full Dropbox" access type</li>
                    <li>Name your app (e.g., "My Event Photos")</li>
                    <li>In the Settings tab, add this redirect URI: <code className="bg-slate-200 px-2 py-0.5 rounded text-xs">{`${window.location.origin}/oauth-success.html`}</code></li>
                    <li>In the Permissions tab, enable: <code className="bg-slate-200 px-1 rounded text-xs">files.content.write</code> and <code className="bg-slate-200 px-1 rounded text-xs">files.content.read</code></li>
                    <li>Copy your App key and App secret below</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Dropbox App Key</label>
                  <input
                    type="text"
                    value={dropboxAppKey}
                    onChange={(e) => setDropboxAppKey(e.target.value)}
                    placeholder="Enter your Dropbox App Key"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Dropbox App Secret</label>
                  <div className="relative">
                    <input
                      type={showDropboxSecret ? "text" : "password"}
                      value={dropboxAppSecret}
                      onChange={(e) => setDropboxAppSecret(e.target.value)}
                      placeholder="Enter your Dropbox App Secret"
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDropboxSecret(!showDropboxSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showDropboxSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSaveUserSettings}
                  disabled={isSavingUser || !dropboxAppKey || !dropboxAppSecret}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {isSavingUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Dropbox Credentials
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

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
              {dropboxAppKey && dropboxAppSecret && (
                <>
                  <div className="text-center py-8">
                    <p className="text-slate-700 mb-6">Connect your Dropbox account to automatically backup all event photos.</p>
                    <button
                      onClick={handleConnectDropbox}
                      disabled={isConnectingDropbox}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-8 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mx-auto"
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

                  <div className="p-4 bg-blue-50 border-2 border-blue-700/30 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Simple Setup:</strong> Click the button above to log in with your Dropbox credentials. A folder will be automatically created for each event to organize all photos.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {dropboxConnected && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
              <input
                type="checkbox"
                checked={dropboxEnabled}
                onChange={(e) => setDropboxEnabled(e.target.checked)}
                className="w-5 h-5 rounded accent-blue-600"
                id="dropbox-enabled"
              />
              <label htmlFor="dropbox-enabled" className="flex-1 cursor-pointer">
                <span className="font-medium text-slate-900">Enable Dropbox Backup</span>
                <p className="text-sm text-slate-600">Automatically backup photos to your Dropbox</p>
              </label>
              {dropboxEnabled && <Check className="text-green-700" size={20} />}
            </div>
          )}
        </div>

        {dropboxConnected && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-end gap-3">
              {saveUserSuccess && (
                <div className="flex items-center gap-2 text-green-700 animate-fade-in">
                  <Check size={18} />
                  <span className="text-sm font-medium">Settings saved successfully</span>
                </div>
              )}
              <button
                onClick={handleSaveUserSettings}
                disabled={isSavingUser}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                {isSavingUser ? (
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
        )}
      </div>

      {/* Global API Settings - Admin Only */}
      {isAdmin && (
        <>
          <div className="bg-slate-100 px-6 py-3 rounded-lg">
            <h2 className="text-lg font-bold text-slate-900">Global API Settings</h2>
            <p className="text-sm text-slate-600">Configure global settings for all users</p>
          </div>

          {/* Gemini API Configuration */}
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
              <div className="flex items-center gap-3">
                <Sparkles className="text-green-700" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Google Gemini API</h3>
                  <p className="text-slate-600 text-sm">Global AI configuration for image generation</p>
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
                  <span className="font-medium text-slate-900">Enable Gemini API</span>
                  <p className="text-sm text-slate-600">Use Google Gemini for AI image generation</p>
                </label>
                {geminiEnabled && <Check className="text-green-700" size={20} />}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">API Key</label>
                {globalSettings.geminiKeySet && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-green-700 font-medium">
                    <Check size={14} />
                    API key is configured — enter a new value below only to replace it
                  </div>
                )}
                <div className="relative">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => handleGeminiKeyChange(e.target.value)}
                    placeholder={globalSettings.geminiKeySet ? 'Enter new key to replace existing' : 'Enter your Gemini API key'}
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  />
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                >
                  <option value="gemini-3-pro-image">Gemini 3 Pro Image (Recommended)</option>
                  <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Fast)</option>
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Fast)</option>
                </select>
                <p className="text-xs text-slate-600 mt-2">
                  Select which Gemini model to use for AI image generation
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
                  Higher resolutions provide better image quality but may take longer to generate
                </p>
              </div>

              <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> Get started for free at{' '}
                  <a
                    href="https://ai.google.dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-700"
                  >
                    Google AI for Developers
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Twilio Configuration */}
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
                {globalSettings.twilioTokenSet && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-green-700 font-medium">
                    <Check size={14} />
                    Auth token is configured — enter a new value below only to replace it
                  </div>
                )}
                <input
                  type="password"
                  value={twilioToken}
                  onChange={(e) => handleTwilioTokenChange(e.target.value)}
                  placeholder={globalSettings.twilioTokenSet ? 'Enter new token to replace existing' : 'Enter your Twilio auth token'}
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                />
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

          {/* SmugMug Configuration */}
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" fill="#0066CC"/>
                  <path d="M24 14L34 19V29L24 34L14 29V19L24 14Z" fill="white"/>
                </svg>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">SmugMug Integration</h3>
                  <p className="text-slate-600 text-sm">Connect SmugMug for photo galleries</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {smugMugConnected ? (
                <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Check className="text-green-700" size={24} />
                    <div>
                      <p className="font-medium text-green-800">Connected to SmugMug</p>
                      {smugMugUserNickname && (
                        <p className="text-sm text-slate-600">Account: {smugMugUserNickname}</p>
                      )}
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
                    <p className="text-slate-700 mb-6">Connect your SmugMug account to automatically create galleries and share photos.</p>
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
                      <strong>Simple Setup:</strong> Click the button above to authorize with your SmugMug account. Galleries will be created automatically for each event.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Library Webhook Configuration */}
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Public Library</h3>
                  <p className="text-slate-600 text-sm">Configure the client-facing theme selection library at <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">/library</code></p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Checkout Webhook URL</label>
                <input
                  type="url"
                  value={libraryWebhookUrl}
                  onChange={e => setLibraryWebhookUrl(e.target.value)}
                  placeholder="https://your-crm.example.com/webhooks/library"
                  className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  When a client submits their theme selections, a POST request is sent here with their name, event date, booking ID, and selected themes.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg text-sm text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Webhook payload example:</p>
                <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-x-auto text-slate-600">{`{
  "submittedAt": "2026-05-01T12:00:00Z",
  "client": {
    "name": "Jane Smith",
    "eventDate": "2026-06-15",
    "bookingId": "BK-12345"
  },
  "selections": [
    { "id": "...", "name": "Neon Glow", "category": "Modern", "tags": ["neon"] }
  ],
  "totalSelected": 3
}`}</pre>
              </div>
            </div>
          </div>

          {/* SMTP / Email Configuration */}
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-300">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-10 5L2 7"/>
                </svg>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">SMTP Email Server</h3>
                  <p className="text-slate-600 text-sm">Send photos to guests via email using your own SMTP server</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
                <input
                  type="checkbox"
                  checked={smtpEnabled}
                  onChange={(e) => setSmtpEnabled(e.target.checked)}
                  className="w-5 h-5 rounded accent-green-700"
                  id="smtp-enabled"
                />
                <label htmlFor="smtp-enabled" className="flex-1 cursor-pointer">
                  <span className="font-medium text-slate-900">Enable Email Delivery</span>
                  <p className="text-sm text-slate-600">Allow guests to receive photos via email</p>
                </label>
                {smtpEnabled && <Check className="text-green-700" size={20} />}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-900 mb-2">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value === '' ? '' : parseInt(e.target.value))}
                    placeholder="587"
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-600 -mt-2">Use port 465 for SSL, 587 for STARTTLS, or 25 for plain.</p>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Username</label>
                <input
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Password</label>
                {globalSettings.smtpPasswordSet && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-green-700 font-medium">
                    <Check size={14} />
                    Password is configured — enter a new value below only to replace it
                  </div>
                )}
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={globalSettings.smtpPasswordSet ? 'Enter new password to replace existing' : 'Enter your SMTP password'}
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">From Email</label>
                  <input
                    type="email"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="photos@yourdomain.com"
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">From Name</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Lumina Booth"
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-4 py-3 focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div className="p-4 bg-green-50 border-2 border-green-700/30 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> The password is stored securely and never shown again after saving. Only enter a new password if you want to replace the existing one.
                </p>
              </div>
            </div>
          </div>

          {/* Save Global Settings Button */}
          <div className="flex items-center justify-end gap-3">
            {saveGlobalSuccess && (
              <div className="flex items-center gap-2 text-green-700 animate-fade-in">
                <Check size={18} />
                <span className="text-sm font-medium">Global settings saved successfully</span>
              </div>
            )}
            <button
              onClick={handleSaveGlobalSettings}
              disabled={isSavingGlobal}
              className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {isSavingGlobal ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Global Settings
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
