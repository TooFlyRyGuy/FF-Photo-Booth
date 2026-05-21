import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          subscription_status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_ends_at: string | null;
          trial_ends_at: string | null;
          subscription_tier_id: string | null;
          subscription_start_date: string | null;
          subscription_end_date: string | null;
          role: 'user' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      user_credits: {
        Row: {
          id: string;
          user_id: string;
          images_limit: number;
          images_used: number;
          sms_limit: number;
          sms_used: number;
          events_limit: number;
          reset_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_credits']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_credits']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          city: string;
          event_date: string;
          passcode: string;
          is_active: boolean;
          total_generations: number;
          created_by: string | null;
          aspect_ratio: 'square' | '3:4' | '4:3' | '9:16' | '16:9';
          background_image_url: string | null;
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          hide_logo: boolean;
          hide_event_name: boolean;
          start_datetime: string | null;
          end_datetime: string | null;
          sms_message: string | null;
          overlay_image_url: string | null;
          smugmug_gallery_id: string | null;
          smugmug_gallery_url: string | null;
          smugmug_gallery_visibility: string | null;
          smugmug_gallery_name: string | null;
          smugmug_gallery_key: string | null;
          upload_originals_to_gallery: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_generations'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      prompts: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string;
          category: string;
          prompt_text: string;
          preview_image_url: string;
          reference_image_url: string | null;
          is_active: boolean;
          is_public: boolean;
          tags: string[];
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['prompts']['Row'], 'id' | 'created_at' | 'updated_at' | 'usage_count'>;
        Update: Partial<Database['public']['Tables']['prompts']['Insert']>;
      };
      generated_images: {
        Row: {
          id: string;
          event_id: string;
          prompt_id: string;
          user_id: string | null;
          original_image_url: string;
          generated_image_url: string | null;
          status: 'processing' | 'completed' | 'failed';
          error_message: string | null;
          phone_number: string | null;
          generation_time_ms: number | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['generated_images']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['generated_images']['Insert']>;
      };
      event_prompts: {
        Row: {
          id: string;
          event_id: string;
          prompt_id: string;
          display_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_prompts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['event_prompts']['Insert']>;
      };
      sms_logs: {
        Row: {
          id: string;
          image_id: string;
          user_id: string | null;
          phone_number: string;
          message_sid: string | null;
          status: 'queued' | 'sent' | 'delivered' | 'failed';
          error_message: string | null;
          sent_at: string;
          delivered_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sms_logs']['Row'], 'id' | 'sent_at'>;
        Update: Partial<Database['public']['Tables']['sms_logs']['Insert']>;
      };
      global_settings: {
        Row: {
          id: string;
          setting_key: string;
          setting_value: string | null;
          description: string | null;
          is_sensitive: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
