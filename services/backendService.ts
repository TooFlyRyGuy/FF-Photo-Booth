import { Event, Prompt, UserProfile, UserCredits, GlobalSettings } from '../types';
import { supabase } from '../lib/supabase';

let cachedUserId: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 60000;

let cachedPrompts: Prompt[] | null = null;
let promptsCacheTimestamp: number | null = null;
const PROMPTS_CACHE_TTL = 300000;

let cachedEvents: Event[] | null = null;
let eventsCacheTimestamp: number | null = null;
const EVENTS_CACHE_TTL = 30000;

let cachedGlobalSettings: GlobalSettings | null = null;
let globalSettingsCacheTimestamp: number | null = null;
const GLOBAL_SETTINGS_CACHE_TTL = 60000;

const getUserId = async (): Promise<string | null> => {
  if (cachedUserId && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedUserId;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    cachedUserId = user.id;
    cacheTimestamp = Date.now();
    return user.id;
  }

  return null;
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

  let imageToUpload = base64Image;

  if (!base64Image.startsWith('data:image/jpeg') && !base64Image.startsWith('data:image/jpg')) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = base64Image;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      imageToUpload = canvas.toDataURL('image/jpeg', 0.92);
    }
  }

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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: profileData, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }

  if (!profileData) {
    throw new Error('User profile not found');
  }

  return {
    id: profileData.id,
    email: profileData.email,
    fullName: profileData.full_name,
    subscriptionStatus: profileData.subscription_status,
    subscriptionTierId: profileData.subscription_tier_id,
    stripeCustomerId: profileData.stripe_customer_id,
    stripeSubscriptionId: profileData.stripe_subscription_id,
    subscriptionStartDate: profileData.subscription_start_date,
    subscriptionEndDate: profileData.subscription_end_date,
    createdAt: profileData.created_at,
    updatedAt: profileData.updated_at,
  };
};

export const getUserCredits = async (): Promise<UserCredits> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: creditsData, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user credits: ${error.message}`);
  }

  if (!creditsData) {
    throw new Error('User credits not found');
  }

  return {
    id: creditsData.id,
    userId: creditsData.user_id,
    availableCredits: creditsData.available_credits,
    rolloverCredits: creditsData.rollover_credits,
    lastResetDate: creditsData.last_reset_date,
    createdAt: creditsData.created_at,
    updatedAt: creditsData.updated_at,
  };
};

export const getGlobalSettings = async (skipCache: boolean = false): Promise<GlobalSettings> => {
  if (!skipCache && cachedGlobalSettings && globalSettingsCacheTimestamp &&
      Date.now() - globalSettingsCacheTimestamp < GLOBAL_SETTINGS_CACHE_TTL) {
    return cachedGlobalSettings;
  }

  const { data, error } = await supabase
    .from('global_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch global settings:', error);
    return {};
  }

  if (!data) {
    return {};
  }

  const settings: GlobalSettings = {
    dropboxAccessToken: data.dropbox_access_token,
    dropboxRefreshToken: data.dropbox_refresh_token,
    dropboxTokenExpiresAt: data.dropbox_token_expires_at,
    dropboxEnabled: data.dropbox_enabled || false,
    twilioAccountSid: data.twilio_account_sid,
    twilioAuthToken: data.twilio_auth_token,
    twilioPhoneNumber: data.twilio_phone_number,
    twilioEnabled: data.twilio_enabled || false,
    geminiApiKey: data.gemini_api_key,
    geminiEnabled: data.gemini_enabled || false,
    geminiModel: data.gemini_model || 'gemini-3-pro-image-preview',
    geminiResolution: data.gemini_resolution || '1K',
    smugmugOauthToken: data.smugmug_oauth_token,
    smugmugOauthTokenSecret: data.smugmug_oauth_token_secret,
    smugmugUserNickname: data.smugmug_user_nickname,
    smugmugConnectionStatus: data.smugmug_connection_status,
    smugmugUsername: data.smugmug_username,
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
  if (settings.dropboxAccessToken !== undefined) updateData.dropbox_access_token = settings.dropboxAccessToken;
  if (settings.dropboxRefreshToken !== undefined) updateData.dropbox_refresh_token = settings.dropboxRefreshToken;
  if (settings.dropboxTokenExpiresAt !== undefined) updateData.dropbox_token_expires_at = settings.dropboxTokenExpiresAt;
  if (settings.dropboxEnabled !== undefined) updateData.dropbox_enabled = settings.dropboxEnabled;
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
    .select('*')
    .eq('user_id', userId)
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

    events.push({
      id: event.id,
      name: event.name,
      date: event.event_date,
      city: event.city,
      isActive: event.is_active,
      passcode: event.passcode,
      prompts,
      userId: event.user_id,
      aspectRatio: event.aspect_ratio,
      backgroundImageUrl: event.background_image_url,
      logoUrl: event.logo_url,
      overlayImageUrl: event.overlay_image_url,
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

  return {
    id: eventData.id,
    name: eventData.name,
    date: eventData.event_date,
    city: eventData.city,
    isActive: eventData.is_active,
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

  const eventData = {
    name: event.name,
    city: event.city,
    event_date: event.date,
    passcode: event.passcode,
    is_active: event.isActive,
    user_id: userId,
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

export const sendSms = async (phoneNumber: string, imageUrl: string, eventId?: string): Promise<boolean> => {
  const settings = await getGlobalSettings();

  if (!settings.twilioEnabled) {
    throw new Error('SMS functionality is not enabled');
  }

  let message = 'Here\'s your AI-generated photo!';

  if (eventId) {
    const event = await getEventById(eventId);
    message = event.smsMessage || `Here's your AI-generated photo from ${event.name}!`;
    message = message.replace('{event_name}', event.name).replace('{image_url}', imageUrl);
  }

  const response = await supabase.functions.invoke('twilio-send-sms', {
    body: {
      to: phoneNumber,
      message,
      imageUrl,
    },
  });

  if (response.error) {
    console.error('Failed to send SMS:', response.error);
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
  originalImageUrl: string,
  generatedImageUrl: string | null,
  phoneNumber: string | null = null,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  errorMessage: string | null = null
): Promise<string> => {
  const { data: eventData } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .maybeSingle();

  const userId = eventData?.user_id;

  if (!userId) {
    throw new Error('Event not found or user ID missing');
  }

  const imageData = {
    event_id: eventId,
    prompt_id: promptId,
    original_image_url: originalImageUrl,
    generated_image_url: generatedImageUrl,
    phone_number: phoneNumber,
    status,
    error_message: errorMessage,
    user_id: userId,
  };

  const { data: newImage, error } = await supabase
    .from('generated_images')
    .insert([imageData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save generated image: ${error.message}`);
  }

  return newImage.id;
};

interface EventAnalytics {
  totalGenerations: number;
  uniqueUsers: number;
  successRate: number;
  averageGenerationTime: number;
  promptBreakdown: Array<{
    promptName: string;
    count: number;
    percentage: number;
  }>;
  hourlyBreakdown: Array<{
    hour: string;
    count: number;
  }>;
}

export const getEventAnalytics = async (eventId: string): Promise<EventAnalytics> => {
  const { data: images, error } = await supabase
    .from('generated_images')
    .select('*, prompts(name)')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }

  const totalGenerations = images?.length || 0;
  const uniqueUsers = new Set(images?.map(img => img.phone_number).filter(Boolean)).size;
  const completedImages = images?.filter(img => img.status === 'completed').length || 0;
  const successRate = totalGenerations > 0 ? (completedImages / totalGenerations) * 100 : 0;

  const generationTimes = images
    ?.filter(img => img.generation_time_ms)
    .map(img => img.generation_time_ms) || [];
  const averageGenerationTime = generationTimes.length > 0
    ? generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length
    : 0;

  const promptCounts = new Map<string, number>();
  images?.forEach(img => {
    const promptName = (img.prompts as any)?.name || 'Unknown';
    promptCounts.set(promptName, (promptCounts.get(promptName) || 0) + 1);
  });

  const promptBreakdown = Array.from(promptCounts.entries()).map(([promptName, count]) => ({
    promptName,
    count,
    percentage: (count / totalGenerations) * 100,
  }));

  const hourlyCounts = new Map<string, number>();
  images?.forEach(img => {
    const hour = new Date(img.created_at).getHours().toString().padStart(2, '0') + ':00';
    hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
  });

  const hourlyBreakdown = Array.from(hourlyCounts.entries())
    .sort()
    .map(([hour, count]) => ({ hour, count }));

  return {
    totalGenerations,
    uniqueUsers,
    successRate,
    averageGenerationTime,
    promptBreakdown,
    hourlyBreakdown,
  };
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

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalGenerations: number;
  totalPrompts: number;
  availableCredits: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const userId = await getUserId();

  if (!userId) {
    return {
      totalEvents: 0,
      activeEvents: 0,
      totalGenerations: 0,
      totalPrompts: 0,
      availableCredits: 0,
    };
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, is_active, total_generations')
    .eq('user_id', userId);

  const { data: prompts } = await supabase
    .from('prompts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  const { data: credits } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .maybeSingle();

  const totalEvents = events?.length || 0;
  const activeEvents = events?.filter(e => e.is_active).length || 0;
  const totalGenerations = events?.reduce((sum, e) => sum + (e.total_generations || 0), 0) || 0;
  const totalPrompts = prompts?.length || 0;
  const availableCredits = credits?.available_credits || 0;

  return {
    totalEvents,
    activeEvents,
    totalGenerations,
    totalPrompts,
    availableCredits,
  };
};

interface ChartDataPoint {
  date: string;
  generations: number;
}

export const getDashboardChartData = async (): Promise<ChartDataPoint[]> => {
  const userId = await getUserId();

  if (!userId) {
    return [];
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: images } = await supabase
    .from('generated_images')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const dateCounts = new Map<string, number>();

  images?.forEach(img => {
    const date = new Date(img.created_at).toISOString().split('T')[0];
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  });

  return Array.from(dateCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, generations]) => ({ date, generations }));
};
