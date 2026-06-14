import { Event, Prompt, UserProfile, UserCredits, GlobalSettings, UserEventPass, UserSubscriptionType, EventTimeValidation, ConcurrentEventLimit } from '../types';
import { supabase } from '../lib/supabase';
import { addHours } from './timezoneService';

let cachedUserId: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 60000;

let cachedPrompts: Prompt[] | null = null;
let promptsCacheTimestamp: number | null = null;
const PROMPTS_CACHE_TTL = 300000;

let cachedEvents: Event[] | null = null;
let eventsCacheTimestamp: number | null = null;
const EVENTS_CACHE_TTL = 120000;

let cachedGlobalSettings: GlobalSettings | null = null;
let globalSettingsCacheTimestamp: number | null = null;
const GLOBAL_SETTINGS_CACHE_TTL = 60000;

const getUserId = async (): Promise<string | null> => {
  if (cachedUserId && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedUserId;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    if (user) {
      cachedUserId = user.id;
      cacheTimestamp = Date.now();
      return user.id;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch user ID:', error);
    return null;
  }
};

export const clearUserCache = () => {
  cachedUserId = null;
  cacheTimestamp = null;
};

export const clearPromptsCache = () => {
  cachedPrompts = null;
  promptsCacheTimestamp = null;
};

export const clearEventsCache = () => {
  cachedEvents = null;
  eventsCacheTimestamp = null;
};

export const clearGlobalSettingsCache = () => {
  cachedGlobalSettings = null;
  globalSettingsCacheTimestamp = null;
};

const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

const uploadImageToStorage = async (
  base64Image: string,
  folder: 'preview' | 'reference',
  promptId?: string
): Promise<string> => {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    throw new Error('Invalid image data');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = base64Image;
  });

  const canvas = document.createElement('canvas');

  let targetWidth = img.width;
  let targetHeight = img.height;

  if (folder === 'preview') {
    const maxWidth = 800;
    if (img.width > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = (img.height * maxWidth) / img.width;
    }
  } else if (folder === 'reference') {
    const maxWidth = 1920;
    if (img.width > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = (img.height * maxWidth) / img.width;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const imageToUpload = canvas.toDataURL('image/jpeg', 0.85);

  const blob = base64ToBlob(imageToUpload);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const fileName = promptId
    ? `${folder}/${promptId}_${timestamp}.jpg`
    : `${folder}/${timestamp}_${randomId}.jpg`;

  const { data, error } = await supabase.storage
    .from('prompt-images')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('Failed to upload image to storage:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('prompt-images')
    .getPublicUrl(data.path);

  console.log(`✅ Uploaded image to storage: ${publicUrl}`);
  return publicUrl;
};

const deleteImageFromStorage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl || !imageUrl.includes('prompt-images')) {
    return;
  }

  try {
    const urlParts = imageUrl.split('/prompt-images/');
    if (urlParts.length !== 2) return;

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('prompt-images')
      .remove([filePath]);

    if (error) {
      console.error('Failed to delete image from storage:', error);
    } else {
      console.log(`✅ Deleted image from storage: ${filePath}`);
    }
  } catch (error) {
    console.error('Error deleting image from storage:', error);
  }
};

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch error:', error);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    let profile = profileData;

    if (!profile) {
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          role: 'user',
          subscription_status: 'inactive',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        })
        .select()
        .maybeSingle();

      if (insertError) {
        throw new Error(`Failed to create user profile: ${insertError.message}`);
      }

      if (!newProfile) {
        throw new Error('User profile could not be created');
      }

      profile = newProfile;
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role || 'user',
      subscriptionStatus: profile.subscription_status,
      subscriptionTierId: profile.subscription_tier_id,
      stripeCustomerId: profile.stripe_customer_id,
      stripeSubscriptionId: profile.stripe_subscription_id,
      subscriptionStartDate: profile.subscription_start_date,
      subscriptionEndDate: profile.subscription_end_date,
      timezone: profile.timezone || 'UTC',
      onboardingCompleted: profile.onboarding_completed || false,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    console.error('getUserProfile failed:', error);
    throw error;
  }
};

export const completeOnboarding = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to complete onboarding:', error);
    throw error;
  }
};

export const getUserCredits = async (): Promise<UserCredits> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  let { data: creditsData, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user credits: ${error.message}`);
  }

  if (!creditsData) {
    const { data: newCredits, error: insertError } = await supabase
      .from('user_credits')
      .insert({
        user_id: user.id,
        images_limit: 10,
        images_used: 0,
        sms_limit: 5,
        sms_used: 0,
        events_limit: 1,
        reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create user credits: ${insertError.message}`);
    }

    creditsData = newCredits;
  }

  const subscription_credits = creditsData.subscription_credits || 0;
  const purchased_credits = creditsData.purchased_credits || 0;
  const event_credits = creditsData.event_credits || 0;
  const image_credits = subscription_credits + purchased_credits;
  const total_credits = image_credits + event_credits;

  return {
    id: creditsData.id,
    userId: creditsData.user_id,
    images_limit: creditsData.images_limit,
    images_used: creditsData.images_used,
    sms_limit: creditsData.sms_limit,
    sms_used: creditsData.sms_used,
    events_limit: creditsData.events_limit,
    reset_date: creditsData.reset_date,
    subscription_credits,
    purchased_credits,
    event_credits,
    image_credits,
    total_credits,
    createdAt: creditsData.created_at,
    updatedAt: creditsData.updated_at,
  };
};

export const getUserSettings = async (): Promise<UserSettings> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  let { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user settings:', error);
    return {};
  }

  if (!data) {
    const { data: newSettings, error: insertError } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        dropbox_enabled: false
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Failed to create user settings:', insertError);
      return {};
    }

    data = newSettings;
  }

  if (!data) {
    return {};
  }

  return {
    dropboxAppKey: data.dropbox_app_key,
    dropboxAppSecret: data.dropbox_app_secret,
    dropboxAccessToken: data.dropbox_access_token,
    dropboxRefreshToken: data.dropbox_refresh_token,
    dropboxTokenExpiresAt: data.dropbox_token_expires_at,
    dropboxEnabled: data.dropbox_enabled || false,
  };
};

export const getUserSettingsByUserId = async (userId: string | null | undefined): Promise<UserSettings> => {
  if (!userId) {
    return {};
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user settings:', error);
    return {};
  }

  if (!data) {
    return {};
  }

  return {
    dropboxAppKey: data.dropbox_app_key,
    dropboxAppSecret: data.dropbox_app_secret,
    dropboxAccessToken: data.dropbox_access_token,
    dropboxRefreshToken: data.dropbox_refresh_token,
    dropboxTokenExpiresAt: data.dropbox_token_expires_at,
    dropboxEnabled: data.dropbox_enabled || false,
  };
};

export const updateUserSettings = async (settings: Partial<UserSettings>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const updateData: any = { user_id: user.id };
  if (settings.dropboxAppKey !== undefined) updateData.dropbox_app_key = settings.dropboxAppKey;
  if (settings.dropboxAppSecret !== undefined) updateData.dropbox_app_secret = settings.dropboxAppSecret;
  if (settings.dropboxAccessToken !== undefined) updateData.dropbox_access_token = settings.dropboxAccessToken;
  if (settings.dropboxRefreshToken !== undefined) updateData.dropbox_refresh_token = settings.dropboxRefreshToken;
  if (settings.dropboxTokenExpiresAt !== undefined) updateData.dropbox_token_expires_at = settings.dropboxTokenExpiresAt;
  if (settings.dropboxEnabled !== undefined) updateData.dropbox_enabled = settings.dropboxEnabled;

  const { error } = await supabase
    .from('user_settings')
    .upsert(updateData, { onConflict: 'user_id' });

  if (error) {
    throw new Error(`Failed to update user settings: ${error.message}`);
  }

  console.log('User settings updated successfully');
};

export const getGlobalSettings = async (skipCache: boolean = false): Promise<GlobalSettings> => {
  if (!skipCache && cachedGlobalSettings && globalSettingsCacheTimestamp &&
      Date.now() - globalSettingsCacheTimestamp < GLOBAL_SETTINGS_CACHE_TTL) {
    console.log('📦 Using cached global settings');
    return cachedGlobalSettings;
  }

  console.log('🔍 Fetching global settings from database...');

  // Try to fetch from global_settings table first (admin access)
  let { data, error } = await supabase
    .from('global_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  // If no data returned (RLS denied access silently) or error, try public view
  if (!data || error) {
    if (error) {
      console.log('🔓 Error accessing global_settings, trying public view...', error.code);
    } else {
      console.log('🔓 No data from global_settings (likely RLS), trying public view...');
    }

    const publicResult = await supabase
      .from('public_global_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    data = publicResult.data;
    error = publicResult.error;
  }

  if (error) {
    console.error('❌ Failed to fetch global settings:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return {};
  }

  if (!data) {
    console.warn('⚠️ No global settings found in database');
    return {};
  }

  console.log('✅ Global settings fetched successfully:', {
    geminiEnabled: data.gemini_enabled,
    geminiKeySet: !!data.gemini_api_key,
    twilioEnabled: data.twilio_enabled,
    twilioTokenSet: !!data.twilio_auth_token,
  });

  const settings: GlobalSettings = {
    dropboxAppKey: data.dropbox_app_key,
    dropboxAppSecret: data.dropbox_app_secret,
    twilioAccountSid: data.twilio_account_sid,
    // Never expose the actual token to the browser — only a boolean sentinel
    twilioTokenSet: !!data.twilio_auth_token,
    twilioPhoneNumber: data.twilio_phone_number,
    twilioEnabled: data.twilio_enabled || false,
    // Never expose the actual API key to the browser — only a boolean sentinel
    geminiKeySet: !!data.gemini_api_key,
    geminiEnabled: data.gemini_enabled || false,
    geminiModel: data.gemini_model || 'gemini-3.1-flash-image-preview',
    geminiResolution: data.gemini_resolution || '1K',
    smugmugUserNickname: data.smugmug_user_nickname,
    smugmugConnectionStatus: data.smugmug_connection_status,
    smugmugUsername: data.smugmug_username,
    libraryWebhookUrl: data.library_webhook_url,
  };

  cachedGlobalSettings = settings;
  globalSettingsCacheTimestamp = Date.now();

  return settings;
};

export const updateGlobalSettings = async (settings: Partial<GlobalSettings>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const updateData: any = {};
  if (settings.dropboxAppKey !== undefined) updateData.dropbox_app_key = settings.dropboxAppKey;
  if (settings.dropboxAppSecret !== undefined) updateData.dropbox_app_secret = settings.dropboxAppSecret;
  if (settings.twilioAccountSid !== undefined) updateData.twilio_account_sid = settings.twilioAccountSid;
  if (settings.twilioAuthToken !== undefined) updateData.twilio_auth_token = settings.twilioAuthToken;
  if (settings.twilioPhoneNumber !== undefined) updateData.twilio_phone_number = settings.twilioPhoneNumber;
  if (settings.twilioEnabled !== undefined) updateData.twilio_enabled = settings.twilioEnabled;
  if (settings.geminiApiKey !== undefined) updateData.gemini_api_key = settings.geminiApiKey;
  if (settings.geminiEnabled !== undefined) updateData.gemini_enabled = settings.geminiEnabled;
  if (settings.geminiModel !== undefined) updateData.gemini_model = settings.geminiModel;
  if (settings.geminiResolution !== undefined) updateData.gemini_resolution = settings.geminiResolution;
  if (settings.smugmugOauthToken !== undefined) updateData.smugmug_oauth_token = settings.smugmugOauthToken;
  if (settings.smugmugOauthTokenSecret !== undefined) updateData.smugmug_oauth_token_secret = settings.smugmugOauthTokenSecret;
  if (settings.smugmugUserNickname !== undefined) updateData.smugmug_user_nickname = settings.smugmugUserNickname;
  if (settings.smugmugConnectionStatus !== undefined) updateData.smugmug_connection_status = settings.smugmugConnectionStatus;
  if (settings.smugmugUsername !== undefined) updateData.smugmug_username = settings.smugmugUsername;
  if (settings.libraryWebhookUrl !== undefined) updateData.library_webhook_url = settings.libraryWebhookUrl;

  const { data: existingSettings } = await supabase
    .from('global_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingSettings) {
    const { error } = await supabase
      .from('global_settings')
      .update(updateData)
      .eq('id', existingSettings.id);

    if (error) {
      throw new Error(`Failed to update global settings: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from('global_settings')
      .insert(updateData);

    if (error) {
      throw new Error(`Failed to create global settings: ${error.message}`);
    }
  }

  clearGlobalSettingsCache();
};

export const getEvents = async (skipCache: boolean = false, includePrompts: boolean = false): Promise<Event[]> => {
  const userId = await getUserId();

  if (!userId) {
    return [];
  }

  if (!skipCache && cachedEvents && eventsCacheTimestamp &&
      Date.now() - eventsCacheTimestamp < EVENTS_CACHE_TTL) {
    return cachedEvents;
  }

  const { data: eventsData, error } = await supabase
    .from('events')
    .select('id, name, event_date, city, is_active, passcode, user_id, aspect_ratio, primary_color, secondary_color, accent_color, hide_logo, hide_event_name, start_datetime, end_datetime, sms_message, smugmug_gallery_key, smugmug_gallery_url, upload_originals_to_gallery, processing_text, test_mode')
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch events:', error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const events: Event[] = [];

  for (const event of eventsData || []) {
    let prompts: Prompt[] = [];

    if (includePrompts) {
      const { data: eventPromptsData } = await supabase
        .from('event_prompts')
        .select('prompt_id, display_order')
        .eq('event_id', event.id)
        .order('display_order', { ascending: true });

      if (eventPromptsData && eventPromptsData.length > 0) {
        const promptIds = eventPromptsData.map(ep => ep.prompt_id);

        const { data: promptsData } = await supabase
          .from('prompts')
          .select('*')
          .in('id', promptIds)
          .eq('is_active', true);

        if (promptsData) {
          const promptsMap = new Map(promptsData.map(p => [p.id, p]));
          prompts = eventPromptsData
            .map(ep => promptsMap.get(ep.prompt_id))
            .filter((p): p is any => p !== undefined)
            .map(p => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              previewImage: p.preview_image_url,
              referenceImage: p.reference_image_url,
              promptText: p.prompt_text,
              category: p.category,
            }));
        }
      }
    }

    const now = new Date();
    let isActive = event.is_active;

    if (event.end_datetime) {
      const endTime = new Date(event.end_datetime);
      if (now > endTime) {
        isActive = false;
      }
    }

    if (event.start_datetime) {
      const startTime = new Date(event.start_datetime);
      if (now < startTime) {
        isActive = false;
      }
    }

    events.push({
      id: event.id,
      name: event.name,
      date: event.event_date,
      city: event.city,
      isActive,
      passcode: event.passcode,
      prompts,
      userId: event.user_id,
      aspectRatio: event.aspect_ratio,
      primaryColor: event.primary_color,
      secondaryColor: event.secondary_color,
      accentColor: event.accent_color,
      hideLogo: event.hide_logo,
      hideEventName: event.hide_event_name,
      startDatetime: event.start_datetime,
      endDatetime: event.end_datetime,
      smsMessage: event.sms_message,
      smugmugGalleryKey: event.smugmug_gallery_key,
      smugmugGalleryUrl: event.smugmug_gallery_url,
      uploadOriginalsToGallery: event.upload_originals_to_gallery,
      processingText: event.processing_text,
      testMode: event.test_mode ?? false,
    });
  }

  cachedEvents = events;
  eventsCacheTimestamp = Date.now();

  return events;
};

export const getEventById = async (eventId: string): Promise<Event> => {
  const { data: eventData, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch event: ${error.message}`);
  }

  if (!eventData) {
    throw new Error('Event not found');
  }

  const { data: eventPromptsData } = await supabase
    .from('event_prompts')
    .select('prompt_id, display_order')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  let prompts: Prompt[] = [];

  if (eventPromptsData && eventPromptsData.length > 0) {
    const promptIds = eventPromptsData.map(ep => ep.prompt_id);

    const { data: promptsData } = await supabase
      .from('prompts')
      .select('*')
      .in('id', promptIds)
      .eq('is_active', true);

    if (promptsData) {
      const promptsMap = new Map(promptsData.map(p => [p.id, p]));
      prompts = eventPromptsData
        .map(ep => promptsMap.get(ep.prompt_id))
        .filter((p): p is any => p !== undefined)
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          previewImage: p.preview_image_url,
          referenceImage: p.reference_image_url,
          promptText: p.prompt_text,
          category: p.category,
        }));
    }
  }

  const now = new Date();
  let isActive = eventData.is_active;

  if (eventData.end_datetime) {
    const endTime = new Date(eventData.end_datetime);
    if (now > endTime) {
      isActive = false;
    }
  }

  if (eventData.start_datetime) {
    const startTime = new Date(eventData.start_datetime);
    if (now < startTime) {
      isActive = false;
    }
  }

  return {
    id: eventData.id,
    name: eventData.name,
    date: eventData.event_date,
    city: eventData.city,
    isActive,
    passcode: eventData.passcode,
    prompts,
    userId: eventData.user_id,
    aspectRatio: eventData.aspect_ratio,
    backgroundImageUrl: eventData.background_image_url,
    logoUrl: eventData.logo_url,
    overlayImageUrl: eventData.overlay_image_url,
    primaryColor: eventData.primary_color,
    secondaryColor: eventData.secondary_color,
    accentColor: eventData.accent_color,
    hideLogo: eventData.hide_logo,
    hideEventName: eventData.hide_event_name,
    startDatetime: eventData.start_datetime,
    endDatetime: eventData.end_datetime,
    smsMessage: eventData.sms_message,
    smugmugGalleryKey: eventData.smugmug_gallery_key,
    smugmugGalleryUrl: eventData.smugmug_gallery_url,
    uploadOriginalsToGallery: eventData.upload_originals_to_gallery,
    processingText: eventData.processing_text,
    testMode: eventData.test_mode ?? false,
  };
};

export const getPrompts = async (skipCache: boolean = false): Promise<Prompt[]> => {
  if (!skipCache && cachedPrompts && promptsCacheTimestamp &&
      Date.now() - promptsCacheTimestamp < PROMPTS_CACHE_TTL) {
    return cachedPrompts;
  }

  const userId = await getUserId();

  let query = supabase
    .from('prompts')
    .select('*')
    .eq('is_active', true);

  if (userId) {
    query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  } else {
    query = query.is('user_id', null);
  }

  const { data: promptsData, error } = await query.order('category').order('name');

  if (error) {
    console.error('Failed to fetch prompts:', error);
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  const prompts: Prompt[] = (promptsData || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    previewImage: p.preview_image_url,
    referenceImage: p.reference_image_url,
    promptText: p.prompt_text,
    category: p.category,
  }));

  cachedPrompts = prompts;
  promptsCacheTimestamp = Date.now();

  return prompts;
};

export const getPromptById = async (promptId: string): Promise<Prompt> => {
  const { data: promptData, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', promptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch prompt: ${error.message}`);
  }

  if (!promptData) {
    throw new Error('Prompt not found');
  }

  return {
    id: promptData.id,
    name: promptData.name,
    description: promptData.description || '',
    previewImage: promptData.preview_image_url,
    referenceImage: promptData.reference_image_url,
    promptText: promptData.prompt_text,
    category: promptData.category,
  };
};

export const saveEvent = async (event: Event): Promise<Event> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const isUpdate = Boolean(event.id);

  const userProfile = await getUserProfile();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  let eventSource: 'subscription' | 'event_pass' | 'admin' = 'subscription';
  if (isAdmin) {
    eventSource = 'admin';
  } else if (event.passId) {
    eventSource = 'event_pass';
  }

  const eventData = {
    name: event.name,
    city: event.city,
    event_date: event.date,
    passcode: event.passcode,
    is_active: event.isActive,
    user_id: userId,
    created_by: userId,
    aspect_ratio: event.aspectRatio || 'square',
    background_image_url: event.backgroundImageUrl,
    logo_url: event.logoUrl,
    overlay_image_url: event.overlayImageUrl,
    primary_color: event.primaryColor,
    secondary_color: event.secondaryColor,
    accent_color: event.accentColor,
    hide_logo: event.hideLogo || false,
    hide_event_name: event.hideEventName || false,
    start_datetime: event.startDatetime,
    end_datetime: event.endDatetime,
    sms_message: event.smsMessage,
    smugmug_gallery_key: event.smugmugGalleryKey,
    smugmug_gallery_url: event.smugmugGalleryUrl,
    upload_originals_to_gallery: event.uploadOriginalsToGallery || false,
    processing_text: event.processingText || null,
    test_mode: event.testMode ?? false,
    event_source: isUpdate ? undefined : eventSource,
  };

  let eventId = event.id;

  if (isUpdate) {
    const { error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', event.id);

    if (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }
  } else {
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    eventId = newEvent.id;

    if (!event.smugmugGalleryKey) {
      try {
        const globalSettings = await getGlobalSettings();
        if (globalSettings.smugmugConnectionStatus === 'connected') {
          const { createSmugMugGallery } = await import('./smugmugService');
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const galleryName = event.city ? `${event.name} - ${event.city}` : event.name;

          const { galleryId, galleryUrl } = await createSmugMugGallery(
            galleryName,
            'public',
            anonKey
          );

          const { error: updateError } = await supabase
            .from('events')
            .update({
              smugmug_gallery_key: galleryId,
              smugmug_gallery_url: galleryUrl,
            })
            .eq('id', eventId);

          if (updateError) {
            console.error('Failed to update event with SmugMug gallery info:', updateError);
          }
        }
      } catch (smugmugError) {
        console.error('Failed to create SmugMug gallery:', smugmugError);
      }
    }

    try {
      const userSettings = await getUserSettingsByUserId(userId);
      if (userSettings.dropboxEnabled && userSettings.dropboxAccessToken) {
        const { createDropboxFolder } = await import('./dropboxService');
        await createDropboxFolder({
          userId,
          eventId,
          eventName: event.name,
        });
        console.log('Dropbox folder created for event:', event.name);
      }
    } catch (dropboxError) {
      console.error('Failed to create Dropbox folder:', dropboxError);
    }
  }

  if (event.prompts && event.prompts.length > 0) {
    const { error: deleteError } = await supabase
      .from('event_prompts')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error removing old event prompts:', deleteError);
    }

    const eventPrompts = event.prompts.map((prompt, index) => ({
      event_id: eventId,
      prompt_id: prompt.id,
      display_order: index,
    }));

    const { error: insertError } = await supabase
      .from('event_prompts')
      .insert(eventPrompts);

    if (insertError) {
      throw new Error(`Failed to link prompts to event: ${insertError.message}`);
    }
  }

  clearEventsCache();
  return getEventById(eventId);
};

export const savePrompt = async (prompt: Prompt): Promise<Prompt> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  let previewImageUrl = prompt.previewImage;
  let referenceImageUrl = prompt.referenceImage;

  if (prompt.previewImage.startsWith('data:image')) {
    previewImageUrl = await uploadImageToStorage(prompt.previewImage, 'preview');
  }

  if (prompt.referenceImage && prompt.referenceImage.startsWith('data:image')) {
    referenceImageUrl = await uploadImageToStorage(prompt.referenceImage, 'reference');
  }

  const promptData = {
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    prompt_text: prompt.promptText,
    preview_image_url: previewImageUrl,
    reference_image_url: referenceImageUrl,
    is_active: true,
    user_id: userId,
  };

  const { data: newPrompt, error } = await supabase
    .from('prompts')
    .insert([promptData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create prompt: ${error.message}`);
  }

  clearPromptsCache();
  return getPromptById(newPrompt.id);
};

export const updatePrompt = async (promptId: string, prompt: Partial<Prompt>): Promise<Prompt> => {
  const updateData: any = {};

  if (prompt.name !== undefined) updateData.name = prompt.name;
  if (prompt.description !== undefined) updateData.description = prompt.description;
  if (prompt.category !== undefined) updateData.category = prompt.category;
  if (prompt.promptText !== undefined) updateData.prompt_text = prompt.promptText;

  if (prompt.previewImage) {
    if (prompt.previewImage.startsWith('data:image')) {
      const existingPrompt = await getPromptById(promptId);
      if (existingPrompt.previewImage) {
        await deleteImageFromStorage(existingPrompt.previewImage);
      }
      updateData.preview_image_url = await uploadImageToStorage(prompt.previewImage, 'preview', promptId);
    } else {
      updateData.preview_image_url = prompt.previewImage;
    }
  }

  if (prompt.referenceImage !== undefined) {
    if (prompt.referenceImage && prompt.referenceImage.startsWith('data:image')) {
      const existingPrompt = await getPromptById(promptId);
      if (existingPrompt.referenceImage) {
        await deleteImageFromStorage(existingPrompt.referenceImage);
      }
      updateData.reference_image_url = await uploadImageToStorage(prompt.referenceImage, 'reference', promptId);
    } else {
      updateData.reference_image_url = prompt.referenceImage;
    }
  }

  const { error } = await supabase
    .from('prompts')
    .update(updateData)
    .eq('id', promptId);

  if (error) {
    throw new Error(`Failed to update prompt: ${error.message}`);
  }

  clearPromptsCache();
  return getPromptById(promptId);
};

export const deletePrompt = async (promptId: string): Promise<void> => {
  const prompt = await getPromptById(promptId);

  if (prompt.previewImage) {
    await deleteImageFromStorage(prompt.previewImage);
  }
  if (prompt.referenceImage) {
    await deleteImageFromStorage(prompt.referenceImage);
  }

  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', promptId);

  if (error) {
    throw new Error(`Failed to delete prompt: ${error.message}`);
  }

  clearPromptsCache();
};

export const sendSms = async (phoneNumber: string, imageUrl: string, imageId: string, eventId?: string): Promise<boolean> => {
  if (!eventId) {
    throw new Error('Event ID is required to send SMS');
  }

  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) {
    throw new Error('Event not found');
  }

  const response = await supabase.functions.invoke('twilio-send-sms', {
    body: {
      userId: event.user_id,
      phoneNumber,
      imageUrl,
      imageId,
      eventId,
    },
  });

  if (response.error) {
    console.error('Failed to send SMS:', response.error);
    return false;
  }

  return true;
};

export const sendTestSms = async (phoneNumber: string, imageId: string, eventId: string): Promise<boolean> => {
  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) {
    throw new Error('Event not found');
  }

  const response = await supabase.functions.invoke('twilio-send-sms', {
    body: {
      userId: event.user_id,
      phoneNumber,
      imageUrl: '',
      imageId,
      eventId,
      isTest: true,
    },
  });

  if (response.error) {
    console.error('Failed to send test SMS:', response.error);
    return false;
  }

  return true;
};

export const getEventByPasscode = async (passcode: string): Promise<Event | null> => {
  const { data: eventData, error } = await supabase
    .from('events')
    .select('*')
    .eq('passcode', passcode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch event by passcode:', error);
    return null;
  }

  if (!eventData) {
    return null;
  }

  return getEventById(eventData.id);
};

export const saveGeneratedImage = async (
  eventId: string,
  promptId: string,
  originalImageUrl: string | null = null,
  generatedImageUrl: string | null = null,
  phoneNumber: string | null = null,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  errorMessage: string | null = null
): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();

  const imageData = {
    event_id: eventId,
    prompt_id: promptId,
    original_image_url: originalImageUrl,
    generated_image_url: generatedImageUrl,
    phone_number: phoneNumber,
    status,
    error_message: errorMessage,
    user_id: user?.id || null,
  };

  const { data, error } = await supabase
    .from('generated_images')
    .insert([imageData])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save generated image: ${error.message}`);
  }

  return data.id;
};

export interface EventAnalytics {
  totalPhotos: number;
  promptStats: Array<{
    promptId: string;
    promptName: string;
    count: number;
    percentage: number;
  }>;
}

export const getEventAnalytics = async (eventId: string): Promise<EventAnalytics> => {
  const { data: images, error } = await supabase
    .from('generated_images')
    .select('*, prompts(id, name)')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }

  const totalPhotos = images?.length || 0;

  const promptCounts = new Map<string, { promptId: string; promptName: string; count: number }>();
  images?.forEach(img => {
    const promptId = (img.prompts as any)?.id || 'unknown';
    const promptName = (img.prompts as any)?.name || 'Unknown';
    const key = promptId;
    const existing = promptCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      promptCounts.set(key, { promptId, promptName, count: 1 });
    }
  });

  const promptStats = Array.from(promptCounts.values())
    .map(({ promptId, promptName, count }) => ({
      promptId,
      promptName,
      count,
      percentage: totalPhotos > 0 ? Math.round((count / totalPhotos) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPhotos,
    promptStats,
  };
};

export const getEventChartData = async (eventId: string): Promise<ChartDataPoint[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: images, error } = await supabase
    .from('generated_images')
    .select('created_at')
    .eq('event_id', eventId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    throw new Error(`Failed to fetch chart data: ${error.message}`);
  }

  const dateCounts = new Map<string, number>();

  images?.forEach(img => {
    const date = new Date(img.created_at).toISOString().split('T')[0];
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  });

  return Array.from(dateCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, generations]) => ({ date, generations }));
};

export interface EventPhoneEntry {
  phoneNumber: string;
  sentAt: string;
  status: string;
  imageId: string;
}

export const getEventPhoneNumbers = async (eventId: string): Promise<EventPhoneEntry[]> => {
  const { data: images, error: imgError } = await supabase
    .from('generated_images')
    .select('id')
    .eq('event_id', eventId);

  if (imgError) throw new Error(`Failed to fetch images: ${imgError.message}`);
  if (!images || images.length === 0) return [];

  const imageIds = images.map(i => i.id);

  const { data, error } = await supabase
    .from('sms_logs')
    .select('phone_number, sent_at, status, image_id')
    .in('image_id', imageIds)
    .order('sent_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch phone numbers: ${error.message}`);

  return (data || []).map(row => ({
    phoneNumber: row.phone_number,
    sentAt: row.sent_at,
    status: row.status,
    imageId: row.image_id,
  }));
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    throw new Error(`Failed to delete event: ${error.message}`);
  }

  clearEventsCache();
};

export const duplicateEvent = async (eventId: string): Promise<Event> => {
  const originalEvent = await getEventById(eventId);

  const generatePasscode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const newPasscode = generatePasscode();
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];

  const duplicatedEvent: Event = {
    ...originalEvent,
    id: '',
    name: `${originalEvent.name} (Copy)`,
    passcode: newPasscode,
    date: formattedDate,
    isActive: true,
    smugmugGalleryKey: '',
    smugmugGalleryUrl: '',
    startDatetime: null,
    endDatetime: null,
  };

  const savedEvent = await saveEvent(duplicatedEvent);
  clearEventsCache();

  return savedEvent;
};

export const grantEventAccess = async (eventId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('event_access')
    .insert({
      event_id: eventId,
      user_id: userId,
      granted_by: (await getUserId())!
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('User already has access to this event');
    }
    throw new Error(`Failed to grant access: ${error.message}`);
  }

  clearEventsCache();
};

export const revokeEventAccess = async (eventId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('event_access')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to revoke access: ${error.message}`);
  }

  clearEventsCache();
};

export const getEventAccessList = async (eventId: string): Promise<Array<{ userId: string; email: string; fullName: string | null; grantedAt: string }>> => {
  const { data, error } = await supabase
    .from('event_access')
    .select(`
      user_id,
      created_at,
      user_profiles!event_access_user_id_fkey (
        email,
        full_name
      )
    `)
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to fetch event access list: ${error.message}`);
  }

  return (data || []).map(item => ({
    userId: item.user_id,
    email: item.user_profiles.email,
    fullName: item.user_profiles.full_name,
    grantedAt: item.created_at
  }));
};

export const transferEventOwnership = async (eventId: string, newOwnerId: string): Promise<void> => {
  const { error: updateError } = await supabase
    .from('events')
    .update({ user_id: newOwnerId })
    .eq('id', eventId);

  if (updateError) {
    throw new Error(`Failed to transfer ownership: ${updateError.message}`);
  }

  const { error: deleteError } = await supabase
    .from('event_access')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', newOwnerId);

  if (deleteError) {
    console.warn('Could not remove shared access record (may not exist):', deleteError.message);
  }

  clearEventsCache();
};

export interface DashboardStats {
  totalImages: number;
  totalSms: number;
  totalEvents: number;
  activeEvents: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const userId = await getUserId();

  if (!userId) {
    return {
      totalImages: 0,
      totalSms: 0,
      totalEvents: 0,
      activeEvents: 0,
    };
  }

  const userProfile = await getUserProfile();
  const isAdmin = userProfile.role?.toLowerCase() === 'admin';

  let allEvents: any[] = [];
  let eventIds: string[] = [];

  if (isAdmin) {
    const { data: allEventsData } = await supabase
      .from('events')
      .select('id, is_active, start_datetime, end_datetime');
    allEvents = allEventsData || [];
    eventIds = allEvents.map(e => e.id);
  } else {
    const { data: ownedEvents } = await supabase
      .from('events')
      .select('id, is_active, start_datetime, end_datetime')
      .eq('user_id', userId);

    const { data: sharedEventAccess } = await supabase
      .from('event_access')
      .select('event_id, events(id, is_active, start_datetime, end_datetime)')
      .eq('user_id', userId);

    const sharedEvents = sharedEventAccess?.map(access => access.events).filter(Boolean) || [];

    allEvents = [...(ownedEvents || []), ...sharedEvents];
    eventIds = allEvents.map(e => e.id);
  }

  let imagesCount = 0;
  let smsCount = 0;

  if (eventIds.length > 0) {
    const { count: imgCount } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })
      .in('event_id', eventIds);
    imagesCount = imgCount || 0;

    const { data: imageIds } = await supabase
      .from('generated_images')
      .select('id')
      .in('event_id', eventIds);

    if (imageIds && imageIds.length > 0) {
      const { count: smsCountResult } = await supabase
        .from('sms_logs')
        .select('*', { count: 'exact', head: true })
        .in('image_id', imageIds.map(i => i.id));
      smsCount = smsCountResult || 0;
    }
  }

  const totalEvents = allEvents.length;

  const now = new Date();
  const activeEvents = allEvents.filter(e => {
    if (!e.is_active) return false;

    if (e.end_datetime) {
      const endTime = new Date(e.end_datetime);
      if (now > endTime) return false;
    }

    if (e.start_datetime) {
      const startTime = new Date(e.start_datetime);
      if (now < startTime) return false;
    }

    return true;
  }).length;

  return {
    totalImages: imagesCount,
    totalSms: smsCount,
    totalEvents,
    activeEvents,
  };
};

export interface ChartDataPoint {
  date: string;
  generations: number;
}

export const getDashboardChartData = async (): Promise<ChartDataPoint[]> => {
  const userId = await getUserId();

  if (!userId) {
    return [];
  }

  const userProfile = await getUserProfile();
  const isAdmin = userProfile.role?.toLowerCase() === 'admin';

  let eventIds: string[] = [];

  if (isAdmin) {
    const { data: events } = await supabase
      .from('events')
      .select('id');
    eventIds = events?.map(e => e.id) || [];
  } else {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId);
    eventIds = events?.map(e => e.id) || [];
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const { data: images } = await supabase
    .from('generated_images')
    .select('created_at')
    .in('event_id', eventIds.length > 0 ? eventIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('created_at', sevenDaysAgo.toISOString())
    .lte('created_at', today.toISOString());

  const dateCounts = new Map<string, number>();

  images?.forEach(img => {
    const date = new Date(img.created_at).toLocaleDateString('en-CA');
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  });

  const result: ChartDataPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-CA');
    const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({
      date: shortDate,
      generations: dateCounts.get(dateStr) || 0
    });
  }

  return result;
};

export interface EventGenerationBreakdown {
  eventId: string;
  eventName: string;
  count: number;
}

export const getGenerationsByDateAndEvent = async (date: string): Promise<EventGenerationBreakdown[]> => {
  const userId = await getUserId();

  if (!userId) {
    return [];
  }

  const userProfile = await getUserProfile();
  const isAdmin = userProfile.role?.toLowerCase() === 'admin';

  let eventsData;

  if (isAdmin) {
    const { data } = await supabase
      .from('events')
      .select('id, name');
    eventsData = data;
  } else {
    const { data } = await supabase
      .from('events')
      .select('id, name')
      .eq('user_id', userId);
    eventsData = data;
  }

  const eventIds = eventsData?.map(e => e.id) || [];

  if (eventIds.length === 0) {
    return [];
  }

  const targetDate = new Date(date + ' ' + new Date().getFullYear());
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: images } = await supabase
    .from('generated_images')
    .select('event_id')
    .in('event_id', eventIds)
    .gte('created_at', targetDate.toISOString())
    .lte('created_at', endOfDay.toISOString());

  const eventCounts = new Map<string, number>();

  images?.forEach(img => {
    if (img.event_id) {
      eventCounts.set(img.event_id, (eventCounts.get(img.event_id) || 0) + 1);
    }
  });

  const eventsMap = new Map(eventsData?.map(e => [e.id, e.name]) || []);

  return Array.from(eventCounts.entries())
    .map(([eventId, count]) => ({
      eventId,
      eventName: eventsMap.get(eventId) || 'Unknown Event',
      count
    }))
    .sort((a, b) => b.count - a.count);
};

export const getAllUsers = async (): Promise<any[]> => {
  const { data: usersData, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      email,
      full_name,
      role,
      subscription_status,
      subscription_tier_id,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_start_date,
      subscription_end_date,
      created_at,
      updated_at,
      user_credits (
        images_limit,
        images_used,
        sms_limit,
        sms_used,
        events_limit,
        reset_date
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch all users: ${error.message}`);
  }

  if (!usersData || usersData.length === 0) {
    return [];
  }

  const userIds = usersData.map(u => u.id);

  const { data: eventCounts } = await supabase
    .from('events')
    .select('user_id')
    .in('user_id', userIds);

  const { data: imageCounts } = await supabase
    .from('generated_images')
    .select('user_id')
    .in('user_id', userIds);

  const eventCountMap = new Map<string, number>();
  eventCounts?.forEach(e => {
    if (e.user_id) {
      eventCountMap.set(e.user_id, (eventCountMap.get(e.user_id) || 0) + 1);
    }
  });

  const imageCountMap = new Map<string, number>();
  imageCounts?.forEach(i => {
    if (i.user_id) {
      imageCountMap.set(i.user_id, (imageCountMap.get(i.user_id) || 0) + 1);
    }
  });

  return usersData.map(user => {
    const credits = Array.isArray(user.user_credits) ? user.user_credits[0] : user.user_credits;

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      subscription_status: user.subscription_status,
      subscription_tier_id: user.subscription_tier_id,
      stripe_customer_id: user.stripe_customer_id,
      stripe_subscription_id: user.stripe_subscription_id,
      subscription_start_date: user.subscription_start_date,
      subscription_end_date: user.subscription_end_date,
      created_at: user.created_at,
      updated_at: user.updated_at,
      images_limit: credits?.images_limit || 0,
      images_used: credits?.images_used || 0,
      sms_limit: credits?.sms_limit || 0,
      sms_used: credits?.sms_used || 0,
      events_limit: credits?.events_limit || 0,
      reset_date: credits?.reset_date,
      total_events: eventCountMap.get(user.id) || 0,
      total_images: imageCountMap.get(user.id) || 0,
    };
  });
};

export const getAllEvents = async (): Promise<Event[]> => {
  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id, name, event_date, city, is_active, passcode, user_id, aspect_ratio, primary_color, secondary_color, accent_color, hide_logo, hide_event_name, start_datetime, end_datetime, sms_message, smugmug_gallery_key, smugmug_gallery_url, upload_originals_to_gallery, processing_text, test_mode')
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to fetch all events: ${eventsError.message}`);
  }

  if (!eventsData || eventsData.length === 0) {
    return [];
  }

  const userIds = [...new Set(eventsData.map(e => e.user_id).filter(Boolean))];

  const { data: usersData, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .in('id', userIds);

  if (usersError) {
    console.error('Failed to fetch user profiles:', usersError);
  }

  const usersMap = new Map((usersData || []).map(u => [u.id, u]));

  return eventsData.map(e => {
    const userProfile = usersMap.get(e.user_id);

    const now = new Date();
    let isActive = e.is_active;

    if (e.end_datetime) {
      const endTime = new Date(e.end_datetime);
      if (now > endTime) {
        isActive = false;
      }
    }

    if (e.start_datetime) {
      const startTime = new Date(e.start_datetime);
      if (now < startTime) {
        isActive = false;
      }
    }

    return {
      id: e.id,
      name: e.name,
      date: e.event_date,
      city: e.city,
      isActive,
      passcode: e.passcode,
      prompts: [],
      userId: e.user_id,
      userName: userProfile?.full_name || 'Unknown',
      userEmail: userProfile?.email || '',
      createdByEmail: userProfile?.email || '',
      aspectRatio: e.aspect_ratio,
      primaryColor: e.primary_color,
      secondaryColor: e.secondary_color,
      accentColor: e.accent_color,
      hideLogo: e.hide_logo,
      hideEventName: e.hide_event_name,
      startDatetime: e.start_datetime,
      endDatetime: e.end_datetime,
      smsMessage: e.sms_message,
      smugmugGalleryKey: e.smugmug_gallery_key,
      smugmugGalleryUrl: e.smugmug_gallery_url,
      uploadOriginalsToGallery: e.upload_originals_to_gallery,
      processingText: e.processing_text,
      testMode: e.test_mode ?? false,
    };
  });
};

export const getAllPrompts = async (): Promise<Prompt[]> => {
  const { data, error } = await supabase
    .from('prompts')
    .select(`
      id,
      name,
      description,
      category,
      prompt_text,
      preview_image_url,
      reference_image_url,
      is_active,
      usage_count,
      created_at,
      updated_at,
      tags,
      is_public,
      user_id,
      user_profiles (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch all prompts: ${error.message}`);
  }

  return (data || []).map(p => {
    const userProfile = Array.isArray(p.user_profiles) ? p.user_profiles[0] : p.user_profiles;

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      previewImage: p.preview_image_url,
      referenceImage: p.reference_image_url,
      promptText: p.prompt_text,
      category: p.category,
      isPublic: p.is_public || false,
      userId: p.user_id,
      tags: p.tags || [],
      userEmail: userProfile?.email,
      userName: userProfile?.full_name,
    };
  });
};

export const getAdminStats = async (): Promise<any> => {
  const [usersData, eventsData, imagesData] = await Promise.all([
    supabase.from('user_profiles').select('id, created_at, subscription_status'),
    supabase.from('events').select('id'),
    supabase.from('generated_images').select('id, created_at')
  ]);

  const totalUsers = usersData.data?.length || 0;
  const activeUsers = usersData.data?.filter(u => u.subscription_status === 'active').length || 0;
  const totalEvents = eventsData.data?.length || 0;
  const totalImages = imagesData.data?.length || 0;

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const recentImages = imagesData.data?.filter(
    img => new Date(img.created_at) > last30Days
  ).length || 0;

  return {
    totalUsers,
    activeUsers,
    totalEvents,
    totalImages,
    recentImages
  };
};

export const getRevenueStats = async (): Promise<any> => {
  const { data, error } = await supabase
    .from('stripe_orders')
    .select('*')
    .eq('status', 'completed');

  if (error) {
    console.error('Failed to fetch revenue stats:', error);
    return {
      totalRevenue: 0,
      monthlyRevenue: 0,
      orderCount: 0
    };
  }

  const totalRevenue = data?.reduce((sum, order) => sum + (order.amount_total || 0), 0) || 0;

  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const monthlyRevenue = data?.filter(order =>
    new Date(order.created_at) >= currentMonth
  ).reduce((sum, order) => sum + (order.amount_total || 0), 0) || 0;

  return {
    totalRevenue: totalRevenue / 100,
    monthlyRevenue: monthlyRevenue / 100,
    orderCount: data?.length || 0
  };
};

export const getAvailableEventPasses = async (): Promise<UserEventPass[]> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('get_available_passes', {
    p_user_id: userId
  });

  if (error) {
    throw new Error(`Failed to fetch available passes: ${error.message}`);
  }

  return (data || []).map((pass: any) => ({
    id: pass.id,
    userId,
    tierId: pass.tier_id,
    tierName: pass.tier_name,
    durationHours: pass.duration_hours,
    purchasedAt: pass.purchased_at,
    activatedAt: null,
    eventId: null,
    expiresAt: null,
    isActive: false,
  }));
};

export const activateEventPass = async (
  passId: string,
  eventId: string
): Promise<{ success: boolean; expiresAt?: string; message: string }> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('activate_pass', {
    p_pass_id: passId,
    p_event_id: eventId,
    p_user_id: userId
  });

  if (error) {
    throw new Error(`Failed to activate pass: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Failed to activate pass: No response from server');
  }

  const result = data[0];
  return {
    success: result.success,
    expiresAt: result.expires_at,
    message: result.message,
  };
};

export const getUserEventPass = async (passId: string): Promise<UserEventPass | null> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_event_passes')
    .select(`
      *,
      subscription_tiers(name, event_pass_duration_hours)
    `)
    .eq('id', passId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch pass: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const tierData = data.subscription_tiers as any;
  let expiresAt: string | undefined;

  if (data.activated_at && tierData?.event_pass_duration_hours) {
    const activatedDate = new Date(data.activated_at);
    const expirationDate = addHours(activatedDate, tierData.event_pass_duration_hours);
    expiresAt = expirationDate.toISOString();
  }

  return {
    id: data.id,
    userId: data.user_id,
    tierId: data.tier_id,
    tierName: tierData?.name || '',
    durationHours: tierData?.event_pass_duration_hours || 0,
    purchasedAt: data.purchased_at,
    activatedAt: data.activated_at || undefined,
    eventId: data.event_id || undefined,
    expiresAt,
    isActive: expiresAt ? new Date() < new Date(expiresAt) : false,
  };
};

export const updateUserTimezone = async (timezone: string): Promise<void> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ timezone })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update timezone: ${error.message}`);
  }
};

export const syncSmugMugGallery = async (
  eventId: string,
  galleryKey: string,
  galleryUrl: string
): Promise<void> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('events')
    .update({
      smugmug_gallery_key: galleryKey,
      smugmug_gallery_url: galleryUrl,
    })
    .eq('id', eventId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to sync SmugMug gallery: ${error.message}`);
  }
};

export const createSmugMugGalleryForEvent = async (
  eventId: string,
  eventName: string,
  city?: string
): Promise<{ galleryKey: string; galleryUrl: string }> => {
  const globalSettings = await getGlobalSettings();

  if (globalSettings.smugmugConnectionStatus !== 'connected') {
    throw new Error('SmugMug is not connected. Please connect SmugMug in settings first.');
  }

  const { createSmugMugGallery } = await import('./smugmugService');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const galleryName = city ? `${eventName} - ${city}` : eventName;

  const { galleryId, galleryUrl } = await createSmugMugGallery(
    galleryName,
    'public',
    anonKey
  );

  const { error: updateError } = await supabase
    .from('events')
    .update({
      smugmug_gallery_key: galleryId,
      smugmug_gallery_url: galleryUrl,
    })
    .eq('id', eventId);

  if (updateError) {
    throw new Error(`Gallery created but failed to link to event: ${updateError.message}`);
  }

  return {
    galleryKey: galleryId,
    galleryUrl: galleryUrl,
  };
};

export const getUserSubscriptionType = async (): Promise<UserSubscriptionType> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('get_user_subscription_type', {
    p_user_id: userId
  });

  if (error) {
    throw new Error(`Failed to get subscription type: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      subscriptionType: 'free',
      tierName: 'Free',
      hasActiveSub: false,
      hasAvailablePasses: false,
    };
  }

  const result = data[0];
  return {
    subscriptionType: result.subscription_type,
    tierName: result.tier_name,
    hasActiveSub: result.has_active_sub,
    hasAvailablePasses: result.has_available_passes,
  };
};

export const getConcurrentEventLimit = async (eventId?: string): Promise<ConcurrentEventLimit> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('can_create_concurrent_event', {
    p_user_id: userId,
    p_event_id: eventId || null,
    p_event_source: 'subscription'
  });

  if (error) {
    throw new Error(`Failed to check concurrent event limit: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No result returned from concurrent event check');
  }

  const result = data[0];
  return {
    canCreate: result.can_create,
    currentCount: result.current_count,
    limitCount: result.limit_count,
    errorMessage: result.error_message,
  };
};

export const hasActivatedEventPass = async (eventId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('has_activated_event_pass', {
    p_event_id: eventId
  });

  if (error) {
    console.error('Error checking if event has activated pass:', error);
    return false;
  }

  return data === true;
};

export const validateEventTimeRestrictions = async (
  startDatetime?: string,
  endDatetime?: string,
  passId?: string,
  eventId?: string
): Promise<EventTimeValidation> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('validate_event_time_restrictions', {
    p_user_id: userId,
    p_start_datetime: startDatetime || null,
    p_end_datetime: endDatetime || null,
    p_pass_id: passId || null,
    p_event_id: eventId || null,
  });

  if (error) {
    throw new Error(`Failed to validate event restrictions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No validation result returned');
  }

  const result = data[0];
  return {
    isValid: result.is_valid,
    errorMessage: result.error_message,
    restrictionType: result.restriction_type,
  };
};

export const hasActiveSubscription = async (): Promise<boolean> => {
  const userId = await getUserId();

  if (!userId) {
    return false;
  }

  const { data, error } = await supabase.rpc('has_active_subscription', {
    p_user_id: userId
  });

  if (error) {
    console.error('Failed to check subscription status:', error);
    return false;
  }

  return data === true;
};
