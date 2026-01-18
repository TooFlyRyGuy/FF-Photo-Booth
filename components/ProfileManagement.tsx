import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User, Upload, Save, X, Camera, Mail, UserCircle, Globe, Receipt } from 'lucide-react';
import { COMMON_TIMEZONES, detectUserTimezone, getTimezoneAbbreviation } from '../services/timezoneService';
import BillingHistory from './BillingHistory';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  role: string;
  timezone?: string | null;
}

interface ProfileManagementProps {
  userProfile: UserProfile;
  onProfileUpdate: () => void;
}

const ProfileManagement: React.FC<ProfileManagementProps> = ({ userProfile, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('profile');
  const [displayName, setDisplayName] = useState(userProfile.display_name || userProfile.full_name || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(userProfile.profile_picture_url || '');
  const [timezone, setTimezone] = useState(userProfile.timezone || detectUserTimezone());
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile.id}/${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(data.path);

      setProfilePictureUrl(publicUrl);
      setError('');
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePictureUrl('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          profile_picture_url: profilePictureUrl || null,
          timezone: timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onProfileUpdate();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    const name = displayName || userProfile.full_name || userProfile.email;
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="bg-white border-2 border-slate-300 rounded-xl">
        <div className="flex border-b-2 border-slate-300">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-4 font-bold transition-colors ${
              activeTab === 'profile'
                ? 'text-green-700 border-b-4 border-green-700 -mb-[2px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={20} />
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex items-center gap-2 px-6 py-4 font-bold transition-colors ${
              activeTab === 'billing'
                ? 'text-green-700 border-b-4 border-green-700 -mb-[2px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt size={20} />
            Billing History
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Profile Picture Section */}
          <div className="pb-6 border-b border-slate-200">
            <label className="block text-sm font-bold text-slate-900 mb-4">Profile Picture</label>
            <div className="flex items-start gap-6">
              <div className="relative">
                {profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-slate-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center border-4 border-slate-200">
                    <span className="text-4xl font-bold text-white">{getInitials()}</span>
                  </div>
                )}
                {profilePictureUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    className="absolute -top-2 -right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
                    title="Remove photo"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      {profilePictureUrl ? 'Change Photo' : 'Upload Photo'}
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-600">
                  JPG, PNG or GIF. Max 5MB. Recommended: 400x400px square image.
                </p>
              </div>
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              <div className="flex items-center gap-2">
                <Mail size={16} />
                Email Address
              </div>
            </label>
            <input
              type="email"
              value={userProfile.email}
              disabled
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              <div className="flex items-center gap-2">
                <UserCircle size={16} />
                Display Name
              </div>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={100}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">
              This is how your name will appear throughout the app
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself (optional)"
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 resize-none transition-colors"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-slate-500">Optional</p>
              <p className="text-xs text-slate-500">{bio.length}/500</p>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              <div className="flex items-center gap-2">
                <Globe size={16} />
                Time Zone
              </div>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 transition-colors"
            >
              {COMMON_TIMEZONES.reduce((acc, tz) => {
                if (!acc.find(group => group.label === tz.group)) {
                  acc.push({ label: tz.group, options: [] });
                }
                const group = acc.find(g => g.label === tz.group);
                if (group) {
                  group.options.push(tz);
                }
                return acc;
              }, [] as Array<{ label: string; options: typeof COMMON_TIMEZONES }>).map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({getTimezoneAbbreviation(tz.value)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              This timezone will be used for all date and time displays throughout the app
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {saveSuccess && (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg flex items-center gap-2">
              <Save className="text-green-700" size={18} />
              <p className="text-sm text-green-800 font-medium">Profile updated successfully!</p>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>

          {/* Account Info Section */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Account Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Role:</span>
                <span className="font-semibold text-slate-900 capitalize">{userProfile.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">User ID:</span>
                <span className="font-mono text-xs text-slate-700">{userProfile.id}</span>
              </div>
            </div>
          </div>
            </div>
          ) : (
            <BillingHistory userId={userProfile.id} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;
