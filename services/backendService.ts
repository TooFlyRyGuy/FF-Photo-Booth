import { Tenant, Event, Prompt, SubscriptionTier } from '../types';
import { supabase } from '../lib/supabase';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

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
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantData) {
      return getTenantById(tenantData.id);
    }
  }

  return getTenantById(DEMO_TENANT_ID);
};

export const getTenantById = async (tenantId: string): Promise<Tenant> => {
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Failed to fetch tenant: ${tenantError.message}`);
  }

  if (!tenantData) {
    throw new Error('Tenant not found');
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

  if (limitsError) {
    throw new Error(`Failed to fetch subscription limits: ${limitsError.message}`);
  }

  if (!limitsData) {
    throw new Error('Subscription limits not found');
  }

  return mapTenantFromDb(tenantData, limitsData);
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

  const { data: { user } } = await supabase.auth.getUser();
  let tenantId = DEMO_TENANT_ID;

  if (user) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantData) {
      tenantId = tenantData.id;
    }
  }

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

export const getEvents = async (): Promise<Event[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  let tenantId = DEMO_TENANT_ID;

  if (user) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantData) {
      tenantId = tenantData.id;
    }
  }

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select(`
      *,
      event_prompts (
        prompt_id,
        prompts (*)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }

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
    primaryColor: event.primary_color,
    secondaryColor: event.secondary_color,
    accentColor: event.accent_color,
    hideLogo: event.hide_logo || false,
    hideEventName: event.hide_event_name || false,
    startDatetime: event.start_datetime,
    endDatetime: event.end_datetime,
    prompts: event.event_prompts.map((ep: any) => ({
      id: ep.prompts.id,
      name: ep.prompts.name,
      description: ep.prompts.description,
      category: ep.prompts.category,
      promptText: ep.prompts.prompt_text,
      previewImage: ep.prompts.preview_image_url,
      referenceImage: ep.prompts.reference_image_url,
    }))
  }));
};

export const getPrompts = async (): Promise<Prompt[]> => {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .or(`tenant_id.is.null,tenant_id.eq.${DEMO_TENANT_ID}`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  return data.map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    promptText: prompt.prompt_text,
    previewImage: prompt.preview_image_url,
    referenceImage: prompt.reference_image_url,
  }));
};

export const saveEvent = async (event: Event): Promise<Event> => {
  const isNewEvent = !event.id || event.id.startsWith('evt_');

  if (isNewEvent) {
    const { data, error } = await supabase
      .from('events')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        name: event.name,
        city: event.city,
        event_date: event.date,
        passcode: event.passcode,
        is_active: event.isActive,
        aspect_ratio: event.aspectRatio || 'square',
        background_image_url: event.backgroundImageUrl || null,
        logo_url: event.logoUrl || null,
        primary_color: event.primaryColor || null,
        secondary_color: event.secondaryColor || null,
        accent_color: event.accentColor || null,
        hide_logo: event.hideLogo || false,
        hide_event_name: event.hideEventName || false,
        start_datetime: event.startDatetime || null,
        end_datetime: event.endDatetime || null,
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

    return { ...event, id: data.id };
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
        primary_color: event.primaryColor || null,
        secondary_color: event.secondaryColor || null,
        accent_color: event.accentColor || null,
        hide_logo: event.hideLogo || false,
        hide_event_name: event.hideEventName || false,
        start_datetime: event.startDatetime || null,
        end_datetime: event.endDatetime || null,
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
  const { data, error } = await supabase
    .from('prompts')
    .insert({
      tenant_id: DEMO_TENANT_ID,
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
};

export const sendSms = async (tenantId: string, phoneNumber: string, imageUrl: string): Promise<boolean> => {
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
        prompts (*)
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
    prompts: eventsData.event_prompts
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((ep: any) => ({
        id: ep.prompts.id,
        name: ep.prompts.name,
        description: ep.prompts.description,
        category: ep.prompts.category,
        promptText: ep.prompts.prompt_text,
        previewImage: ep.prompts.preview_image_url,
        referenceImage: ep.prompts.reference_image_url,
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
