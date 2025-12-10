import { Tenant, Event, Prompt, SubscriptionTier } from '../types';
import { supabase } from '../lib/supabase';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export const getTenant = async (): Promise<Tenant> => {
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', DEMO_TENANT_ID)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Failed to fetch tenant: ${tenantError.message}`);
  }

  if (!tenantData) {
    throw new Error('Demo tenant not found');
  }

  const { data: limitsData, error: limitsError } = await supabase
    .from('subscription_limits')
    .select('*')
    .eq('tenant_id', DEMO_TENANT_ID)
    .maybeSingle();

  if (limitsError) {
    throw new Error(`Failed to fetch subscription limits: ${limitsError.message}`);
  }

  if (!limitsData) {
    throw new Error('Subscription limits not found');
  }

  return {
    id: tenantData.id,
    name: tenantData.name,
    tier: tenantData.tier as SubscriptionTier,
    whiteLabel: tenantData.white_label_enabled,
    brandingLogo: tenantData.branding_logo_url || undefined,
    primaryColor: tenantData.primary_color || undefined,
    dropboxAccessToken: tenantData.dropbox_access_token || undefined,
    dropboxEnabled: tenantData.dropbox_enabled || false,
    twilioAccountSid: tenantData.twilio_account_sid || undefined,
    twilioAuthToken: tenantData.twilio_auth_token || undefined,
    twilioPhoneNumber: tenantData.twilio_phone_number || undefined,
    twilioEnabled: tenantData.twilio_enabled || false,
    usage: {
      imagesUsed: limitsData.images_used,
      imagesLimit: limitsData.images_limit,
      smsUsed: limitsData.sms_used,
      smsLimit: limitsData.sms_limit,
    }
  };
};

export const updateTenantSettings = async (updates: Partial<Tenant>): Promise<void> => {
  const dbUpdates: any = {};

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

  if (Object.keys(dbUpdates).length === 0) {
    return;
  }

  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('tenants')
    .update(dbUpdates)
    .eq('id', DEMO_TENANT_ID);

  if (error) {
    throw new Error(`Failed to update tenant settings: ${error.message}`);
  }
};

export const getEvents = async (): Promise<Event[]> => {
  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select(`
      *,
      event_prompts (
        prompt_id,
        prompts (*)
      )
    `)
    .eq('tenant_id', DEMO_TENANT_ID)
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

export const sendSms = async (phoneNumber: string, imageUrl: string): Promise<boolean> => {
  console.log(`[SMS] Sending to ${phoneNumber}: ${imageUrl}`);
  return true;
};

export const uploadToDropbox = async (imageBase64: string): Promise<string> => {
  console.log(`[STORAGE] Uploading image to cloud storage...`);
  return 'https://storage.example.com/mock-link-123';
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
