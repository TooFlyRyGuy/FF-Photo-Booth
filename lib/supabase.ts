import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          tier: 'STARTER' | 'PRO' | 'ENTERPRISE';
          white_label_enabled: boolean;
          branding_logo_url: string | null;
          primary_color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          city: string;
          event_date: string;
          passcode: string;
          is_active: boolean;
          total_generations: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_generations'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      prompts: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string;
          description: string;
          category: string;
          prompt_text: string;
          preview_image_url: string;
          reference_image_url: string | null;
          is_active: boolean;
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
          tenant_id: string;
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
      subscription_limits: {
        Row: {
          id: string;
          tenant_id: string;
          images_limit: number;
          images_used: number;
          sms_limit: number;
          sms_used: number;
          events_limit: number;
          reset_date: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
