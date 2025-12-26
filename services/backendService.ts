import { Tenant, Event, Prompt, SubscriptionTier } from '../types';
import { supabase } from '../lib/supabase';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

let cachedTenantId: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 60000;

let cachedPrompts: Prompt[] | null = null;
let promptsCacheTimestamp: number | null = null;
const PROMPTS_CACHE_TTL = 300000;

const getUserTenantId = async (): Promise<string> => {
  if (cachedTenantId && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    console.log('🔍 getUserTenantId - using cached tenant:', cachedTenantId);
    return cachedTenantId;
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log('🔍 getUserTenantId - current user:', user?.id || 'none');

  if (user) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('🔍 getUserTenantId - tenant lookup result:', tenantData?.id || 'none found');

    if (tenantData) {
      cachedTenantId = tenantData.id;
      cacheTimestamp = Date.now();
      return tenantData.id;
    }
  }

  console.log('🔍 getUserTenantId - falling back to demo tenant:', DEMO_TENANT_ID);
  return DEMO_TENANT_ID;
};

export const clearTenantCache = () => {
  cachedTenantId = null;
  cacheTimestamp = null;
};

export const clearPromptsCache = () => {
  cachedPrompts = null;
  promptsCacheTimestamp = null;
};

const mapTenantFromDb = (tenantData: any, limitsData: any): Tenant => {
  return {
    id: tenantData.id,
    name: tenantData.name,
    tier: tenantData.tier as SubscriptionTier,
    whiteLabel: tenantData.white_label_enabled,
    brandingLogo: tenantData.branding_logo_url || undefined,
    primaryColor: tenantData.primary_color || undefined,
    dropboxAppKey: tenantData.dropbox_app_key || undefined,
    dropboxAppSecret: tenantData.dropbox_app_secret || undefined,
    dropboxAccessToken: tenantData.dropbox_access_token || undefined,
    dropboxEnabled: tenantData.dropbox_enabled || false,
    twilioAccountSid: tenantData.twilio_account_sid || undefined,
    twilioAuthToken: tenantData.twilio_auth_token || undefined,
    twilioPhoneNumber: tenantData.twilio_phone_number || undefined,
    twilioEnabled: tenantData.twilio_enabled || false,
    geminiApiKey: tenantData.gemini_api_key || undefined,
    geminiEnabled: tenantData.gemini_enabled || false,
    geminiModel: tenantData.gemini_model || 'gemini-3-pro-image-preview',
    geminiResolution: tenantData.gemini_resolution || '1K',
    usage: {
      imagesUsed: limitsData.images_used,
      imagesLimit: limitsData.images_limit,
      smsUsed: limitsData.sms_used,
      smsLimit: limitsData.sms_limit,
    }
  };
};

export const getTenant = async (): Promise<Tenant> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantData) {
        return getTenantById(tenantData.id);
      }

      if (retries < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      } else {
        break;
      }
    }

    throw new Error('Your account is still being set up. Please refresh the page in a few seconds.');
  }

  return getTenantById(DEMO_TENANT_ID);
};

export const getTenantById = async (tenantId: string): Promise<Tenant> => {
  console.log('🔍 getTenantById called with:', tenantId);

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  console.log('🔍 Tenant query result:', {
    found: !!tenantData,
    error: tenantError?.message,
    tenantId: tenantData?.id
  });

  if (tenantError) {
    throw new Error(`Failed to fetch tenant: ${tenantError.message}`);
  }

  if (!tenantData) {
    throw new Error(`Tenant not found for ID: ${tenantId}`);
  }

  console.log('📊 Raw tenant data from DB:', {
    hasGeminiKey: !!tenantData.gemini_api_key,
    geminiKeyLength: tenantData.gemini_api_key?.length,
    geminiEnabled: tenantData.gemini_enabled,
  });

  const { data: limitsData, error: limitsError } = await supabase
    .from('subscription_limits')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  console.log('🔍 Subscription limits query result:', {
    found: !!limitsData,
    error: limitsError?.message,
    limitsId: limitsData?.id
  });

  if (limitsError) {
    throw new Error(`Failed to fetch subscription limits: ${limitsError.message}`);
  }

  if (!limitsData) {
    throw new Error(`Subscription limits not found for tenant: ${tenantId}`);
  }

  const tenant = mapTenantFromDb(tenantData, limitsData);
  console.log('✅ Successfully mapped tenant:', tenant.id);
  return tenant;
};

export const updateTenantSettings = async (updates: Partial<Tenant>): Promise<void> => {
  const dbUpdates: any = {};

  if (updates.dropboxAppKey !== undefined) {
    dbUpdates.dropbox_app_key = updates.dropboxAppKey || null;
  }
  if (updates.dropboxAppSecret !== undefined) {
    dbUpdates.dropbox_app_secret = updates.dropboxAppSecret || null;
  }
  if (updates.dropboxAccessToken !== undefined) {
    dbUpdates.dropbox_access_token = updates.dropboxAccessToken || null;
  }
  if (updates.dropboxEnabled !== undefined) {
    dbUpdates.dropbox_enabled = updates.dropboxEnabled;
  }
  if (updates.twilioAccountSid !== undefined) {
    dbUpdates.twilio_account_sid = updates.twilioAccountSid || null;
  }
  if (updates.twilioAuthToken !== undefined) {
    dbUpdates.twilio_auth_token = updates.twilioAuthToken || null;
  }
  if (updates.twilioPhoneNumber !== undefined) {
    dbUpdates.twilio_phone_number = updates.twilioPhoneNumber || null;
  }
  if (updates.twilioEnabled !== undefined) {
    dbUpdates.twilio_enabled = updates.twilioEnabled;
  }
  if (updates.geminiApiKey !== undefined) {
    dbUpdates.gemini_api_key = updates.geminiApiKey || null;
  }
  if (updates.geminiEnabled !== undefined) {
    dbUpdates.gemini_enabled = updates.geminiEnabled;
  }
  if (updates.geminiModel !== undefined) {
    dbUpdates.gemini_model = updates.geminiModel || 'gemini-3-pro-image-preview';
  }
  if (updates.geminiResolution !== undefined) {
    dbUpdates.gemini_resolution = updates.geminiResolution || '1K';
  }

  if (Object.keys(dbUpdates).length === 0) {
    console.log('No settings to update');
    return;
  }

  console.log('Updating tenant settings:', {
    ...dbUpdates,
    dropbox_app_secret: dbUpdates.dropbox_app_secret ? '[REDACTED]' : dbUpdates.dropbox_app_secret,
    dropbox_access_token: dbUpdates.dropbox_access_token ? '[REDACTED]' : dbUpdates.dropbox_access_token,
    twilio_auth_token: dbUpdates.twilio_auth_token ? '[REDACTED]' : dbUpdates.twilio_auth_token,
    gemini_api_key: dbUpdates.gemini_api_key ? '[REDACTED]' : dbUpdates.gemini_api_key,
  });

  dbUpdates.updated_at = new Date().toISOString();

  const tenantId = await getUserTenantId();

  const { error } = await supabase
    .from('tenants')
    .update(dbUpdates)
    .eq('id', tenantId);

  if (error) {
    console.error('Failed to update tenant settings:', error);
    throw new Error(`Failed to update tenant settings: ${error.message}`);
  }

  console.log('Tenant settings updated successfully');
};

export const getGlobalSettings = async (): Promise<Record<string, string>> => {
  const { data: keyValueData, error: kvError } = await supabase
    .from('global_settings')
    .select('setting_key, setting_value');

  if (kvError) {
    console.error('Failed to fetch global settings:', kvError);
    throw new Error(`Failed to fetch global settings: ${kvError.message}`);
  }

  const settings: Record<string, string> = {};

  if (keyValueData) {
    for (const row of keyValueData) {
      if (row.setting_key && row.setting_value !== null) {
        settings[row.setting_key] = row.setting_value;
      }
    }
  }

  const { data: specialData, error: specialError } = await supabase
    .from('global_settings')
    .select('smugmug_oauth_token, smugmug_user_nickname, smugmug_connection_status, smugmug_default_visibility, use_smugmug_for_sms')
    .limit(1)
    .maybeSingle();

  if (specialError) {
    console.error('Failed to fetch special global settings:', specialError);
  } else if (specialData) {
    if (specialData.smugmug_oauth_token) settings.smugmug_oauth_token = specialData.smugmug_oauth_token;
    if (specialData.smugmug_user_nickname) settings.smugmug_user_nickname = specialData.smugmug_user_nickname;
    if (specialData.smugmug_connection_status) settings.smugmug_connection_status = specialData.smugmug_connection_status;
    if (specialData.smugmug_default_visibility) settings.smugmug_default_visibility = specialData.smugmug_default_visibility;
    if (specialData.use_smugmug_for_sms !== undefined) settings.use_smugmug_for_sms = String(specialData.use_smugmug_for_sms);
  }

  return settings;
};

export const getGlobalSetting = async (key: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('global_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();

  if (error) {
    console.error(`Failed to fetch global setting ${key}:`, error);
    return null;
  }

  return data?.setting_value || null;
};

export const updateGlobalSettings = async (settings: Record<string, any>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be authenticated to update global settings');
  }

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tenantData) {
    throw new Error('Must be an admin to update global settings');
  }

  const specialColumns = ['smugmug_oauth_token', 'smugmug_oauth_token_secret', 'smugmug_user_nickname', 'smugmug_connection_status', 'smugmug_default_visibility', 'use_smugmug_for_sms'];
  const specialUpdates: Record<string, any> = {};
  const keyValueUpdates: Record<string, string> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (specialColumns.includes(key)) {
      specialUpdates[key] = value;
    } else {
      keyValueUpdates[key] = value;
    }
  }

  if (Object.keys(specialUpdates).length > 0) {
    const { data: existingRow } = await supabase
      .from('global_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingRow) {
      const { error } = await supabase
        .from('global_settings')
        .update({
          ...specialUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRow.id);

      if (error) {
        console.error('Failed to update special global settings:', error);
        throw new Error(`Failed to update special global settings: ${error.message}`);
      }
    }
  }

  for (const [key, value] of Object.entries(keyValueUpdates)) {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (error) {
      console.error(`Failed to update global setting ${key}:`, error);
      throw new Error(`Failed to update global setting ${key}: ${error.message}`);
    }
  }

  console.log('Global settings updated successfully');
};

export const getEvents = async (): Promise<Event[]> => {
  const tenantId = await getUserTenantId();
  console.log('🔍 getEvents - fetching events for tenant:', tenantId);

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      name,
      event_date,
      city,
      is_active,
      passcode,
      tenant_id,
      aspect_ratio,
      background_image_url,
      logo_url,
      overlay_image_url,
      primary_color,
      secondary_color,
      accent_color,
      hide_logo,
      hide_event_name,
      start_datetime,
      end_datetime,
      sms_message,
      smugmug_gallery_key,
      smugmug_gallery_url,
      created_at,
      event_prompts (
        prompt_id,
        display_order,
        prompts (
          id,
          name,
          description,
          category,
          prompt_text,
          preview_image_url,
          reference_image_url,
          tags
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    console.error('❌ getEvents error:', eventsError);
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }

  console.log('✅ getEvents - found', eventsData?.length || 0, 'events');

  return eventsData.map((event: any) => ({
    id: event.id,
    name: event.name,
    date: event.event_date,
    city: event.city,
    isActive: event.is_active,
    passcode: event.passcode,
    tenantId: event.tenant_id,
    aspectRatio: event.aspect_ratio || 'square',
    backgroundImageUrl: event.background_image_url,
    logoUrl: event.logo_url,
    overlayImageUrl: event.overlay_image_url,
    primaryColor: event.primary_color,
    secondaryColor: event.secondary_color,
    accentColor: event.accent_color,
    hideLogo: event.hide_logo || false,
    hideEventName: event.hide_event_name || false,
    startDatetime: event.start_datetime,
    endDatetime: event.end_datetime,
    smsMessage: event.sms_message,
    smugmugGalleryKey: event.smugmug_gallery_key,
    smugmugGalleryUrl: event.smugmug_gallery_url,
    prompts: event.event_prompts
      .filter((ep: any) => ep.prompts !== null)
      .map((ep: any) => ({
        id: ep.prompts.id,
        name: ep.prompts.name,
        description: ep.prompts.description,
        category: ep.prompts.category,
        promptText: ep.prompts.prompt_text,
        previewImage: ep.prompts.preview_image_url || '',
        referenceImage: ep.prompts.reference_image_url || '',
      }))
  }));
};

export const getPrompts = async (skipCache: boolean = false): Promise<Prompt[]> => {
  if (!skipCache && cachedPrompts && promptsCacheTimestamp && Date.now() - promptsCacheTimestamp < PROMPTS_CACHE_TTL) {
    return cachedPrompts;
  }

  const tenantId = await getUserTenantId();

  const { data, error } = await supabase
    .from('prompts')
    .select('id, name, description, category, prompt_text, preview_image_url, reference_image_url, tags')
    .or(`tenant_id.is.null,tenant_id.eq.${DEMO_TENANT_ID},tenant_id.eq.${tenantId}`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  const prompts = data.map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    promptText: prompt.prompt_text,
    previewImage: prompt.preview_image_url || '',
    referenceImage: prompt.reference_image_url || '',
  }));

  cachedPrompts = prompts;
  promptsCacheTimestamp = Date.now();

  return prompts;
};

const createSmugMugGalleryForEvent = async (eventName: string, eventDate: string): Promise<{ galleryKey: string; galleryUrl: string } | null> => {
  try {
    const settings = await getGlobalSettings();
    if (settings.smugmug_connection_status !== 'connected') {
      console.log('SmugMug not connected, skipping gallery creation');
      return null;
    }

    const defaultVisibility = settings.smugmug_default_visibility || 'private';
    const galleryName = `${eventName} - ${eventDate}`;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smugmug-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'create_gallery',
        galleryName,
        visibility: defaultVisibility,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create SmugMug gallery:', error);
      return null;
    }

    const result = await response.json();
    return {
      galleryKey: result.galleryId,
      galleryUrl: result.galleryUrl,
    };
  } catch (error) {
    console.error('Error creating SmugMug gallery:', error);
    return null;
  }
};

export const saveEvent = async (event: Event): Promise<Event> => {
  const isNewEvent = !event.id || event.id.startsWith('evt_');
  const tenantId = await getUserTenantId();

  if (isNewEvent) {
    let smugmugGalleryKey = null;
    let smugmugGalleryUrl = null;

    const smugmugGallery = await createSmugMugGalleryForEvent(event.name, event.date);
    if (smugmugGallery) {
      smugmugGalleryKey = smugmugGallery.galleryKey;
      smugmugGalleryUrl = smugmugGallery.galleryUrl;
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        name: event.name,
        city: event.city,
        event_date: event.date,
        passcode: event.passcode,
        is_active: event.isActive,
        aspect_ratio: event.aspectRatio || 'square',
        background_image_url: event.backgroundImageUrl || null,
        logo_url: event.logoUrl || null,
        overlay_image_url: event.overlayImageUrl || null,
        primary_color: event.primaryColor || null,
        secondary_color: event.secondaryColor || null,
        accent_color: event.accentColor || null,
        hide_logo: event.hideLogo || false,
        hide_event_name: event.hideEventName || false,
        start_datetime: event.startDatetime || null,
        end_datetime: event.endDatetime || null,
        sms_message: event.smsMessage || null,
        smugmug_gallery_key: smugmugGalleryKey,
        smugmug_gallery_url: smugmugGalleryUrl,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create event: No data returned');
    }

    if (event.prompts && event.prompts.length > 0) {
      const validPrompts = event.prompts.filter(p =>
        p.id && !p.id.startsWith('p_') && p.id.length > 20
      );

      if (validPrompts.length > 0) {
        const eventPrompts = validPrompts.map((prompt, index) => ({
          event_id: data.id,
          prompt_id: prompt.id,
          display_order: index,
        }));

        const { error: promptsError } = await supabase
          .from('event_prompts')
          .insert(eventPrompts);

        if (promptsError) {
          throw new Error(`Failed to link prompts: ${promptsError.message}`);
        }
      }
    }

    return { ...event, id: data.id, smugmugGalleryKey, smugmugGalleryUrl };
  } else {
    const { data, error } = await supabase
      .from('events')
      .update({
        name: event.name,
        city: event.city,
        event_date: event.date,
        passcode: event.passcode,
        is_active: event.isActive,
        aspect_ratio: event.aspectRatio || 'square',
        background_image_url: event.backgroundImageUrl || null,
        logo_url: event.logoUrl || null,
        overlay_image_url: event.overlayImageUrl || null,
        primary_color: event.primaryColor || null,
        secondary_color: event.secondaryColor || null,
        accent_color: event.accentColor || null,
        hide_logo: event.hideLogo || false,
        hide_event_name: event.hideEventName || false,
        start_datetime: event.startDatetime || null,
        end_datetime: event.endDatetime || null,
        sms_message: event.smsMessage || null,
      })
      .eq('id', event.id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update event: No data returned');
    }

    const { error: deleteError } = await supabase
      .from('event_prompts')
      .delete()
      .eq('event_id', event.id);

    if (deleteError) {
      throw new Error(`Failed to clear prompts: ${deleteError.message}`);
    }

    if (event.prompts && event.prompts.length > 0) {
      const validPrompts = event.prompts.filter(p =>
        p.id && !p.id.startsWith('p_') && p.id.length > 20
      );

      if (validPrompts.length > 0) {
        const eventPrompts = validPrompts.map((prompt, index) => ({
          event_id: event.id,
          prompt_id: prompt.id,
          display_order: index,
        }));

        const { error: promptsError } = await supabase
          .from('event_prompts')
          .insert(eventPrompts);

        if (promptsError) {
          throw new Error(`Failed to link prompts: ${promptsError.message}`);
        }
      }
    }

    return event;
  }
};

export const savePrompt = async (prompt: Prompt): Promise<Prompt> => {
  const tenantId = await getUserTenantId();

  const { data, error } = await supabase
    .from('prompts')
    .insert({
      tenant_id: tenantId,
      name: prompt.name,
      description: prompt.description,
      category: prompt.category,
      prompt_text: prompt.promptText,
      preview_image_url: prompt.previewImage,
      reference_image_url: prompt.referenceImage,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to save prompt: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to save prompt: No data returned');
  }

  clearPromptsCache();

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    promptText: data.prompt_text,
    previewImage: data.preview_image_url,
    referenceImage: data.reference_image_url,
  };
};

export const updatePrompt = async (promptId: string, prompt: Partial<Prompt>): Promise<Prompt> => {
  const updates: any = {};

  if (prompt.name !== undefined) updates.name = prompt.name;
  if (prompt.description !== undefined) updates.description = prompt.description;
  if (prompt.category !== undefined) updates.category = prompt.category;
  if (prompt.promptText !== undefined) updates.prompt_text = prompt.promptText;
  if (prompt.previewImage !== undefined) updates.preview_image_url = prompt.previewImage;
  if (prompt.referenceImage !== undefined) updates.reference_image_url = prompt.referenceImage;

  const { data, error } = await supabase
    .from('prompts')
    .update(updates)
    .eq('id', promptId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update prompt: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to update prompt: No data returned');
  }

  clearPromptsCache();

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    promptText: data.prompt_text,
    previewImage: data.preview_image_url,
    referenceImage: data.reference_image_url,
  };
};

export const deletePrompt = async (promptId: string): Promise<void> => {
  const { error } = await supabase
    .from('prompts')
    .update({ is_active: false })
    .eq('id', promptId);

  if (error) {
    throw new Error(`Failed to delete prompt: ${error.message}`);
  }

  clearPromptsCache();
};

export const sendSms = async (tenantId: string, phoneNumber: string, imageUrl: string, eventId?: string): Promise<boolean> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-send-sms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        phoneNumber,
        imageUrl,
        eventId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send SMS');
    }

    const result = await response.json();
    console.log(`[SMS] Sent to ${phoneNumber}: ${result.messageSid}`);
    return result.success;
  } catch (error) {
    console.error('[SMS] Error:', error);
    throw error;
  }
};

export const getEventByPasscode = async (passcode: string): Promise<Event | null> => {
  const { data: eventsData, error } = await supabase
    .from('events')
    .select(`
      *,
      event_prompts (
        prompt_id,
        display_order,
        prompts (
          id,
          name,
          description,
          category,
          prompt_text,
          preview_image_url,
          reference_image_url
        )
      )
    `)
    .eq('passcode', passcode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch event: ${error.message}`);
  }

  if (!eventsData) {
    return null;
  }

  return {
    id: eventsData.id,
    name: eventsData.name,
    date: eventsData.event_date,
    city: eventsData.city,
    isActive: eventsData.is_active,
    passcode: eventsData.passcode,
    tenantId: eventsData.tenant_id,
    aspectRatio: eventsData.aspect_ratio || 'square',
    backgroundImageUrl: eventsData.background_image_url,
    logoUrl: eventsData.logo_url,
    primaryColor: eventsData.primary_color,
    secondaryColor: eventsData.secondary_color,
    accentColor: eventsData.accent_color,
    hideLogo: eventsData.hide_logo || false,
    hideEventName: eventsData.hide_event_name || false,
    startDatetime: eventsData.start_datetime,
    endDatetime: eventsData.end_datetime,
    smugmugGalleryKey: eventsData.smugmug_gallery_key,
    smugmugGalleryUrl: eventsData.smugmug_gallery_url,
    prompts: eventsData.event_prompts
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((ep: any) => ({
        id: ep.prompts.id,
        name: ep.prompts.name,
        description: ep.prompts.description,
        category: ep.prompts.category,
        promptText: ep.prompts.prompt_text,
        previewImage: ep.prompts.preview_image_url || '',
        referenceImage: ep.prompts.reference_image_url || '',
      }))
  };
};

export const saveGeneratedImage = async (
  eventId: string,
  promptId: string,
  tenantId: string,
  originalUrl: string,
  generatedUrl: string | null,
  status: 'processing' | 'completed' | 'failed'
): Promise<string> => {
  const { data, error } = await supabase
    .from('generated_images')
    .insert({
      event_id: eventId,
      prompt_id: promptId,
      tenant_id: tenantId,
      original_image_url: originalUrl,
      generated_image_url: generatedUrl,
      status,
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to save generated image: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to save generated image: No data returned');
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
    .select(`
      id,
      prompt_id,
      prompts (
        id,
        name
      )
    `)
    .eq('event_id', eventId)
    .eq('status', 'completed');

  if (error) {
    throw new Error(`Failed to fetch event analytics: ${error.message}`);
  }

  const totalPhotos = images?.length || 0;

  const promptCounts = new Map<string, { name: string; count: number }>();

  images?.forEach((img: any) => {
    const promptId = img.prompt_id;
    const promptName = img.prompts?.name || 'Unknown';

    if (promptCounts.has(promptId)) {
      promptCounts.get(promptId)!.count++;
    } else {
      promptCounts.set(promptId, { name: promptName, count: 1 });
    }
  });

  const promptStats = Array.from(promptCounts.entries())
    .map(([promptId, { name, count }]) => ({
      promptId,
      promptName: name,
      count,
      percentage: totalPhotos > 0 ? Math.round((count / totalPhotos) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPhotos,
    promptStats,
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
};

export interface DashboardStats {
  totalImages: number;
  totalSms: number;
  totalEvents: number;
  activeEvents: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const tenantId = await getUserTenantId();

  const [eventsResult, imagesResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, is_active', { count: 'exact', head: false })
      .eq('tenant_id', tenantId),
    supabase
      .from('generated_images')
      .select('id', { count: 'exact', head: false })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
  ]);

  const totalImages = imagesResult.data?.length || 0;
  const totalEvents = eventsResult.data?.length || 0;
  const activeEvents = eventsResult.data?.filter(e => e.is_active).length || 0;

  return {
    totalImages,
    totalSms: Math.floor(totalImages * 0.7),
    totalEvents,
    activeEvents,
  };
};

export interface ChartDataPoint {
  name: string;
  images: number;
}

export const getDashboardChartData = async (): Promise<ChartDataPoint[]> => {
  const tenantId = await getUserTenantId();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: imagesData } = await supabase
    .from('generated_images')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('created_at', sevenDaysAgo.toISOString());

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData: ChartDataPoint[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = imagesData?.filter(img => {
      const imgDate = new Date(img.created_at);
      return imgDate >= date && imgDate < nextDate;
    }).length || 0;

    chartData.push({
      name: dayNames[date.getDay()],
      images: count,
    });
  }

  return chartData;
};
