-- Baseline migration: faithful snapshot of the live public schema of Supabase project
-- ufbjphmsblgwzkofpgai, generated 2026-11-18 from catalog queries (pg_get_*def) against production.
-- Replaces the archived history in supabase/migrations_archive/ (118 live versions + repo-only files).
-- Production is marked as having applied this version via `supabase migration repair` (history only);
-- this file is meant for fresh databases (branches / local) only.
--
-- Counts: 45 tables, 4 views, 2 enums, 57 functions, 12 triggers (11 public + 1 on auth.users),
-- 161 policies (134 public + 27 storage), 8 storage buckets.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET check_function_bodies = false;
SET client_min_messages = warning;


-- ======================================================================
-- Extensions
-- ======================================================================

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ======================================================================
-- Enum types
-- ======================================================================

CREATE TYPE public.stripe_order_status AS ENUM ('pending', 'completed', 'canceled');
CREATE TYPE public.stripe_subscription_status AS ENUM ('not_started', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');

-- ======================================================================
-- Tables (columns, defaults, PK/unique/check constraints)
-- ======================================================================

CREATE TABLE public.add_ons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  stripe_price_id text,
  stripe_product_id text,
  price_cents integer NOT NULL,
  delivery_method text DEFAULT 'zoom'::text,
  duration_minutes integer,
  calendly_link text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT add_ons_pkey PRIMARY KEY (id),
  CONSTRAINT add_ons_stripe_product_id_key UNIQUE (stripe_product_id)
);

CREATE TABLE public.batch_job_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  batch_job_id uuid,
  file_name text NOT NULL,
  status text DEFAULT 'succeeded'::text NOT NULL,
  reason text,
  output_file_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT batch_job_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.batch_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  status text DEFAULT 'pending'::text,
  total_files integer,
  processed_files integer DEFAULT 0,
  drive_folder_id text,
  created_at timestamp with time zone DEFAULT now(),
  batch_job_name text,
  result_zip_path text,
  failed_files integer DEFAULT 0,
  prompt_text text,
  model text,
  aspect_ratio text,
  image_size text,
  error_message text,
  gemini_batch_name text,
  batch_api_state text,
  CONSTRAINT batch_jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.credit_ledger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  source text NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  stripe_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  sms_amount integer DEFAULT 0,
  sms_balance_after integer DEFAULT 0,
  CONSTRAINT credit_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT credit_ledger_source_check CHECK ((source = ANY (ARRAY['subscription'::text, 'credit_pack'::text, 'event'::text, 'admin_grant'::text, 'consumption'::text])))
);

CREATE TABLE public.credit_topup_products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_price_id text,
  stripe_product_id text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  sms_credits integer DEFAULT 0,
  CONSTRAINT credit_topup_products_pkey PRIMARY KEY (id),
  CONSTRAINT credit_topup_products_name_key UNIQUE (name),
  CONSTRAINT credit_topup_products_stripe_product_id_key UNIQUE (stripe_product_id)
);

CREATE TABLE public.credit_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  transaction_type text NOT NULL,
  description text,
  reference_id uuid,
  balance_after integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['purchase'::text, 'subscription'::text, 'event_pass'::text, 'usage'::text, 'refund'::text, 'reset'::text, 'rollover'::text])))
);

CREATE TABLE public.disclaimer_acknowledgments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  device_token text,
  ip_address text,
  disclaimer_text_snapshot text NOT NULL,
  acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT disclaimer_acknowledgments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_access (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_access_pkey PRIMARY KEY (id),
  CONSTRAINT event_access_event_id_user_id_key UNIQUE (event_id, user_id)
);

CREATE TABLE public.event_access_codes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  token text NOT NULL,
  is_used boolean DEFAULT false NOT NULL,
  redeemed_at timestamp with time zone,
  redeemed_ip text,
  redeemed_device_token text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  batch_id uuid DEFAULT gen_random_uuid(),
  CONSTRAINT event_access_codes_pkey PRIMARY KEY (id),
  CONSTRAINT event_access_codes_token_key UNIQUE (token)
);

CREATE TABLE public.event_device_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  device_token text NOT NULL,
  ip_address text,
  photo_count integer DEFAULT 0 NOT NULL,
  last_interaction_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT event_device_usage_pkey PRIMARY KEY (id),
  CONSTRAINT event_device_usage_event_id_device_token_key UNIQUE (event_id, device_token)
);

CREATE TABLE public.event_error_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid,
  error_type text NOT NULL,
  error_message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_error_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_pass_addons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchased_event_pass_id uuid NOT NULL,
  addon_id uuid NOT NULL,
  stripe_payment_intent_id text,
  purchased_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_pass_addons_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  stripe_price_id text,
  stripe_product_id text,
  price_cents integer NOT NULL,
  credits integer NOT NULL,
  duration_hours integer NOT NULL,
  setup_included boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  prompts_limit integer,
  features jsonb,
  sms_credits integer DEFAULT 0,
  events_allowed integer DEFAULT 1,
  deterministic_seeds boolean DEFAULT false,
  priority_queue boolean DEFAULT false,
  prompt_locking boolean DEFAULT false,
  admin_controls boolean DEFAULT false,
  brand_locking boolean DEFAULT false,
  max_guests integer,
  CONSTRAINT event_passes_pkey PRIMARY KEY (id),
  CONSTRAINT event_passes_name_key UNIQUE (name),
  CONSTRAINT event_passes_stripe_product_id_key UNIQUE (stripe_product_id)
);

CREATE TABLE public.event_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  prompt_id uuid,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  smugmug_url text,
  created_at timestamp with time zone DEFAULT now(),
  overlay_storage_path text,
  overlay_public_url text,
  retention_expires_at timestamp with time zone,
  CONSTRAINT event_photos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_prompts (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT event_prompts_event_id_prompt_id_key UNIQUE (event_id, prompt_id)
);

CREATE TABLE public.events (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  city text DEFAULT ''::text NOT NULL,
  event_date date NOT NULL,
  passcode text NOT NULL,
  is_active boolean DEFAULT true,
  total_generations integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  aspect_ratio text DEFAULT 'square'::text,
  background_image_url text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  hide_logo boolean DEFAULT false,
  hide_event_name boolean DEFAULT false,
  start_datetime timestamp with time zone,
  end_datetime timestamp with time zone,
  sms_message text DEFAULT 'Here''s your AI-generated photo from {event_name}! {image_url}'::text,
  overlay_image_url text,
  smugmug_gallery_id text,
  smugmug_gallery_url text,
  smugmug_gallery_visibility text DEFAULT 'private'::text,
  smugmug_gallery_name text,
  smugmug_gallery_key text,
  upload_originals_to_gallery boolean DEFAULT false,
  user_id uuid,
  event_source text DEFAULT 'subscription'::text,
  processing_text text,
  test_mode boolean DEFAULT false NOT NULL,
  limit_photos_per_device boolean DEFAULT false NOT NULL,
  max_photos_per_device integer DEFAULT 0 NOT NULL,
  qr_access_enabled boolean DEFAULT false NOT NULL,
  gallery_enabled boolean DEFAULT false NOT NULL,
  show_account_promo boolean DEFAULT true NOT NULL,
  sms_enabled boolean DEFAULT true NOT NULL,
  whatsapp_enabled boolean DEFAULT false NOT NULL,
  email_enabled boolean DEFAULT false NOT NULL,
  email_subject text,
  email_body text,
  download_enabled boolean DEFAULT true NOT NULL,
  kiosk_language text DEFAULT 'en-US'::text NOT NULL,
  logo_position text DEFAULT 'top-left'::text NOT NULL,
  logo_size text DEFAULT 'medium'::text NOT NULL,
  kiosk_languages text[],
  qr_sharing_enabled boolean DEFAULT true NOT NULL,
  hide_language_selector boolean DEFAULT false NOT NULL,
  default_kiosk_language text,
  fullscreen_enabled boolean DEFAULT false NOT NULL,
  kiosk_passcode text,
  timezone text DEFAULT 'UTC'::text NOT NULL,
  display_background_url text,
  display_background_type text,
  display_logo_url text,
  display_subtitle text,
  display_idle_mode text,
  display_photo_interval integer,
  display_grid_cols integer,
  display_grid_rows integer,
  display_grid_refresh integer,
  display_spotlight_enabled boolean DEFAULT true NOT NULL,
  display_spotlight_duration integer,
  display_advert_url text,
  display_advert_type text,
  display_advert_interval integer,
  display_advert_duration integer,
  display_grid_transition text,
  idle_video_url text,
  idle_image_url text,
  idle_mode text DEFAULT 'black'::text,
  display_title text,
  display_photo_order text DEFAULT 'sequential'::text,
  image_resolution text,
  display_rotation integer DEFAULT 0 NOT NULL,
  display_show_overlay boolean DEFAULT true NOT NULL,
  disclaimer_enabled boolean DEFAULT false NOT NULL,
  disclaimer_text text,
  private_sharing_mode boolean DEFAULT false NOT NULL,
  skip_clean_version boolean DEFAULT false NOT NULL,
  photo_retention_days integer DEFAULT 30,
  gemini_model text,
  display_stretch_single boolean DEFAULT false NOT NULL,
  display_grid_background_url text,
  display_grid_background_type text,
  hold_seconds integer DEFAULT 15,
  sharing_screen_timeout integer DEFAULT 30,
  enabled_modes text[] DEFAULT '{photo}'::text[] NOT NULL,
  analytics_reset_at timestamp with time zone,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_passcode_unique UNIQUE (passcode),
  CONSTRAINT events_aspect_ratio_check CHECK ((aspect_ratio = ANY (ARRAY['square'::text, '3:4'::text, '4:3'::text, '9:16'::text, '16:9'::text, '2:3'::text, '3:2'::text]))),
  CONSTRAINT events_event_source_check CHECK ((event_source = ANY (ARRAY['subscription'::text, 'event_pass'::text, 'admin'::text])))
);

CREATE TABLE public.generated_images (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  original_image_url text,
  generated_image_url text,
  status text DEFAULT 'processing'::text NOT NULL,
  error_message text,
  phone_number text,
  generation_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  user_id uuid,
  CONSTRAINT generated_images_pkey PRIMARY KEY (id),
  CONSTRAINT generated_images_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);

CREATE TABLE public.global_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  setting_key text NOT NULL,
  setting_value text,
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  smugmug_oauth_token text,
  smugmug_oauth_token_secret text,
  smugmug_user_nickname text,
  smugmug_connection_status text DEFAULT 'disconnected'::text,
  smugmug_last_auth_date timestamp with time zone,
  smugmug_default_visibility text DEFAULT 'private'::text,
  use_smugmug_for_sms boolean DEFAULT true,
  smugmug_request_token_secret text,
  smugmug_username text,
  gemini_api_key text,
  gemini_enabled boolean DEFAULT false,
  gemini_model text DEFAULT 'gemini-3-pro-image-preview'::text,
  gemini_resolution text DEFAULT '1K'::text,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_phone_number text,
  twilio_enabled boolean DEFAULT false,
  dropbox_app_key text,
  dropbox_app_secret text,
  singleton_id integer DEFAULT 1 NOT NULL,
  library_webhook_url text,
  library_page_enabled boolean DEFAULT true,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_from_email text,
  smtp_from_name text,
  smtp_enabled boolean DEFAULT false NOT NULL,
  CONSTRAINT global_settings_pkey PRIMARY KEY (id),
  CONSTRAINT global_settings_setting_key_key UNIQUE (setting_key),
  CONSTRAINT global_settings_singleton UNIQUE (singleton_id)
);

CREATE TABLE public.kiosk_text_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  language_code text NOT NULL,
  text_key text NOT NULL,
  text_value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kiosk_text_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT kiosk_text_overrides_event_id_language_code_text_key_key UNIQUE (event_id, language_code, text_key)
);

CREATE TABLE public.library_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_name text NOT NULL,
  event_date date NOT NULL,
  booking_id text NOT NULL,
  selected_prompts jsonb DEFAULT '[]'::jsonb NOT NULL,
  submitted_at timestamp with time zone,
  webhook_status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT library_submissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.prompt_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category text NOT NULL,
  is_private boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  subcategories text[],
  CONSTRAINT prompt_categories_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_categories_category_key UNIQUE (category)
);

CREATE TABLE public.prompt_translations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  prompt_id uuid NOT NULL,
  language_code text NOT NULL,
  name text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_translations_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_translations_prompt_id_language_code_key UNIQUE (prompt_id, language_code)
);

CREATE TABLE public.prompts (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  description text DEFAULT ''::text,
  category text DEFAULT 'Custom'::text NOT NULL,
  prompt_text text NOT NULL,
  preview_image_url text NOT NULL,
  reference_image_url text,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tags text[] DEFAULT '{}'::text[],
  is_public boolean DEFAULT false,
  user_id uuid,
  source_prompt_id uuid,
  gemini_file_uri text,
  gemini_file_uploaded_at timestamp with time zone,
  gemini_file_expires_at timestamp with time zone,
  custom_fields jsonb,
  reference_images jsonb,
  reference_strength integer DEFAULT 50,
  gemini_model text,
  mode text DEFAULT 'photo'::text NOT NULL,
  subcategory text,
  CONSTRAINT prompts_pkey PRIMARY KEY (id),
  CONSTRAINT prompts_source_not_self CHECK ((id <> source_prompt_id))
);

CREATE TABLE public.purchased_event_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  event_id uuid,
  event_pass_tier_id uuid NOT NULL,
  stripe_payment_intent_id text,
  credits_allocated integer NOT NULL,
  credits_used integer DEFAULT 0,
  prompt_limit integer NOT NULL,
  prompts_used integer DEFAULT 0,
  purchased_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sms_credits_allocated integer DEFAULT 0,
  sms_credits_used integer DEFAULT 0,
  CONSTRAINT purchased_event_passes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sms_logs (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  image_id uuid NOT NULL,
  phone_number text NOT NULL,
  message_sid text,
  status text DEFAULT 'queued'::text NOT NULL,
  error_message text,
  sent_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  user_id uuid,
  CONSTRAINT sms_logs_pkey PRIMARY KEY (id),
  CONSTRAINT sms_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text])))
);

CREATE TABLE public.smugmug_upload_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  generated_image_id uuid,
  event_id uuid,
  image_url text NOT NULL,
  upload_status text DEFAULT 'pending'::text,
  retry_count integer DEFAULT 0,
  last_attempt_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT smugmug_upload_queue_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sticker_batch_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'submitting'::text NOT NULL,
  total integer DEFAULT 0 NOT NULL,
  processed integer DEFAULT 0 NOT NULL,
  failed integer DEFAULT 0 NOT NULL,
  gemini_batch_name text,
  batch_state text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  job_id uuid,
  CONSTRAINT sticker_batch_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sticker_designs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  variant_id uuid,
  image_path text,
  status text DEFAULT 'pending'::text NOT NULL,
  error text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  batch_run_id uuid,
  CONSTRAINT sticker_designs_pkey PRIMARY KEY (id),
  CONSTRAINT sticker_designs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'generating'::text, 'generated'::text, 'approved'::text, 'rejected'::text, 'failed'::text])))
);

CREATE TABLE public.sticker_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  name text NOT NULL,
  header_text text DEFAULT ''::text NOT NULL,
  default_designs_per_person integer DEFAULT 4 NOT NULL,
  paper text DEFAULT '4x7'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  badge_bg_color text DEFAULT '#ffffff'::text NOT NULL,
  badge_text_color text DEFAULT '#141414'::text NOT NULL,
  badge_font_family text DEFAULT 'Inter'::text NOT NULL,
  name_font_weight integer DEFAULT 700 NOT NULL,
  name_font_size_scale numeric DEFAULT 1.0 NOT NULL,
  border_color text DEFAULT '#ffffff'::text NOT NULL,
  border_thickness integer DEFAULT 2 NOT NULL,
  border_style text DEFAULT 'solid'::text NOT NULL,
  sticker_bg_color text DEFAULT 'transparent'::text NOT NULL,
  show_text_overlay boolean DEFAULT true NOT NULL,
  header_text_color text DEFAULT '#141414'::text NOT NULL,
  header_font_family text DEFAULT 'Anton'::text NOT NULL,
  generation_mode text DEFAULT 'delay'::text NOT NULL,
  delay_seconds numeric DEFAULT 3 NOT NULL,
  badge_shape text DEFAULT 'rounded'::text NOT NULL,
  badge_line_spacing numeric DEFAULT 1.0 NOT NULL,
  badge_width_mode text DEFAULT 'auto'::text NOT NULL,
  badge_width_scale real DEFAULT 0.92 NOT NULL,
  show_name_on_sheet boolean DEFAULT false NOT NULL,
  show_header boolean DEFAULT true NOT NULL,
  badge_border_color text DEFAULT '#141414'::text NOT NULL,
  badge_border_thickness integer DEFAULT 2 NOT NULL,
  badge_position_y real DEFAULT 0.82 NOT NULL,
  badge_behind boolean DEFAULT false NOT NULL,
  gemini_model text DEFAULT 'gemini-nano-banana-2.1'::text NOT NULL,
  badge_render_mode text DEFAULT 'overlay'::text NOT NULL,
  CONSTRAINT sticker_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT sticker_jobs_badge_shape_check CHECK ((badge_shape = ANY (ARRAY['rectangle'::text, 'rounded'::text, 'oval'::text, 'cloud'::text]))),
  CONSTRAINT sticker_jobs_border_style_check CHECK ((border_style = ANY (ARRAY['solid'::text, 'rounded'::text]))),
  CONSTRAINT sticker_jobs_border_thickness_check CHECK (((border_thickness >= 0) AND (border_thickness <= 12))),
  CONSTRAINT sticker_jobs_delay_seconds_check CHECK (((delay_seconds >= (0)::numeric) AND (delay_seconds <= (60)::numeric))),
  CONSTRAINT sticker_jobs_designs_per_person_check CHECK (((default_designs_per_person >= 1) AND (default_designs_per_person <= 48))),
  CONSTRAINT sticker_jobs_generation_mode_check CHECK ((generation_mode = ANY (ARRAY['delay'::text, 'batch'::text]))),
  CONSTRAINT sticker_jobs_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT sticker_jobs_name_font_size_scale_check CHECK (((name_font_size_scale >= 0.5) AND (name_font_size_scale <= 2.0))),
  CONSTRAINT sticker_jobs_name_font_weight_check CHECK (((name_font_weight >= 100) AND (name_font_weight <= 900))),
  CONSTRAINT sticker_jobs_paper_check CHECK ((paper = ANY (ARRAY['4x7'::text, '4x6'::text])))
);

CREATE TABLE public.sticker_people (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid NOT NULL,
  first_name text NOT NULL,
  display_name text DEFAULT ''::text NOT NULL,
  hashtag text DEFAULT ''::text NOT NULL,
  template text,
  source_photo_path text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sticker_people_pkey PRIMARY KEY (id),
  CONSTRAINT sticker_people_first_name_check CHECK ((char_length(TRIM(BOTH FROM first_name)) > 0))
);

CREATE TABLE public.sticker_prompt_variants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid NOT NULL,
  template text,
  label text DEFAULT ''::text NOT NULL,
  prompt_text text DEFAULT ''::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  library_prompt_id uuid,
  CONSTRAINT sticker_prompt_variants_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sticker_sheets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  sheet_number integer NOT NULL,
  layout_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  png_path text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sticker_sheets_pkey PRIMARY KEY (id),
  CONSTRAINT sticker_sheets_sheet_number_check CHECK ((sheet_number > 0))
);

CREATE TABLE public.stripe_customers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  customer_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT stripe_customers_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_customers_customer_id_key UNIQUE (customer_id),
  CONSTRAINT stripe_customers_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.stripe_orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  checkout_session_id text NOT NULL,
  payment_intent_id text NOT NULL,
  customer_id text NOT NULL,
  amount_subtotal bigint NOT NULL,
  amount_total bigint NOT NULL,
  currency text NOT NULL,
  payment_status text NOT NULL,
  status public.stripe_order_status DEFAULT 'pending'::public.stripe_order_status NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT stripe_orders_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  customer_id text NOT NULL,
  subscription_id text,
  price_id text,
  current_period_start bigint,
  current_period_end bigint,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_brand text,
  payment_method_last4 text,
  status public.stripe_subscription_status NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT stripe_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_subscriptions_customer_id_key UNIQUE (customer_id)
);

CREATE TABLE public.subscription_tiers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  plan_type text NOT NULL,
  tier text NOT NULL,
  price_cents integer NOT NULL,
  credits_per_period integer NOT NULL,
  stripe_product_id text,
  stripe_price_id text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sms_credits_per_period integer DEFAULT 0,
  CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_tiers_plan_type_tier_key UNIQUE (plan_type, tier),
  CONSTRAINT subscription_tiers_stripe_price_id_key UNIQUE (stripe_price_id),
  CONSTRAINT subscription_tiers_stripe_product_id_key UNIQUE (stripe_product_id),
  CONSTRAINT subscription_tiers_plan_type_check CHECK ((plan_type = ANY (ARRAY['monthly'::text, 'annual'::text]))),
  CONSTRAINT subscription_tiers_tier_check CHECK ((tier = ANY (ARRAY['starter'::text, 'pro'::text, 'premium'::text, 'agency'::text])))
);

CREATE TABLE public.subscription_tiers_new (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  stripe_price_id text,
  stripe_product_id text,
  billing_period text NOT NULL,
  price_cents integer NOT NULL,
  credits_per_period integer NOT NULL,
  rollover_enabled boolean DEFAULT false,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  prompts_limit integer,
  sms_credits_per_period integer DEFAULT 0,
  concurrent_events integer DEFAULT 1,
  deterministic_seeds boolean DEFAULT false,
  priority_queue boolean DEFAULT false,
  brand_controls boolean DEFAULT false,
  team_accounts boolean DEFAULT false,
  tier_category text DEFAULT 'standard'::text,
  CONSTRAINT subscription_tiers_new_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_tiers_new_name_billing_period_key UNIQUE (name, billing_period),
  CONSTRAINT subscription_tiers_new_billing_period_check CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'annual'::text]))),
  CONSTRAINT subscription_tiers_new_tier_category_check CHECK ((tier_category = ANY (ARRAY['standard'::text, 'activation'::text, 'enterprise'::text])))
);

CREATE TABLE public.usage_logs (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  event_id uuid,
  action_type text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT usage_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_add_on_purchases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  add_on_id uuid NOT NULL,
  stripe_payment_id text,
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  calendly_event_id text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_add_on_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT user_add_on_purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public.user_credits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  images_limit integer DEFAULT 10 NOT NULL,
  images_used integer DEFAULT 0,
  sms_limit integer DEFAULT 5 NOT NULL,
  sms_used integer DEFAULT 0,
  events_limit integer DEFAULT 1 NOT NULL,
  reset_date timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  plan_type text DEFAULT 'free'::text,
  subscription_tier_id uuid,
  purchased_event_pass_id uuid,
  expires_at timestamp with time zone,
  annual_credits_total integer,
  annual_credits_used integer DEFAULT 0,
  billing_period_start timestamp with time zone,
  billing_period_end timestamp with time zone,
  subscription_credits integer DEFAULT 0,
  purchased_credits integer DEFAULT 0,
  event_credits integer DEFAULT 0,
  subscription_sms_credits integer DEFAULT 0,
  purchased_sms_credits integer DEFAULT 0,
  event_sms_credits integer DEFAULT 0,
  CONSTRAINT user_credits_pkey PRIMARY KEY (id),
  CONSTRAINT user_credits_user_id_key UNIQUE (user_id),
  CONSTRAINT user_credits_plan_type_check CHECK ((plan_type = ANY (ARRAY['free'::text, 'monthly'::text, 'annual'::text, 'event'::text, 'topup'::text])))
);

CREATE TABLE public.user_event_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  event_pass_id uuid NOT NULL,
  stripe_payment_id text,
  credits_allocated integer NOT NULL,
  credits_used integer DEFAULT 0,
  activated_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  event_id uuid,
  CONSTRAINT user_event_passes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  subscription_status text DEFAULT 'inactive'::text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_ends_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  subscription_tier_id uuid,
  subscription_start_date timestamp with time zone,
  subscription_end_date timestamp with time zone,
  role text DEFAULT 'user'::text,
  dropbox_app_key text,
  dropbox_app_secret text,
  dropbox_access_token text,
  dropbox_refresh_token text,
  display_name text,
  profile_picture_url text,
  bio text,
  timezone text DEFAULT 'UTC'::text NOT NULL,
  onboarding_completed boolean DEFAULT false,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);

CREATE TABLE public.user_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  dropbox_enabled boolean DEFAULT false,
  dropbox_app_key text,
  dropbox_app_secret text,
  dropbox_access_token text,
  dropbox_refresh_token text,
  dropbox_token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  account_language text DEFAULT 'en-US'::text NOT NULL,
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.user_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  stripe_subscription_id text,
  status text DEFAULT 'active'::text NOT NULL,
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id),
  CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id),
  CONSTRAINT user_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'past_due'::text])))
);

CREATE TABLE public.webhook_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processing_status text DEFAULT 'pending'::text NOT NULL,
  error_message text,
  user_id uuid,
  customer_id text,
  received_at timestamp with time zone DEFAULT now() NOT NULL,
  processing_started_at timestamp with time zone,
  processing_completed_at timestamp with time zone,
  retry_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_event_id_key UNIQUE (event_id),
  CONSTRAINT webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);


-- ======================================================================
-- Foreign keys
-- ======================================================================

ALTER TABLE ONLY public.batch_job_logs ADD CONSTRAINT batch_job_logs_batch_job_id_fkey FOREIGN KEY (batch_job_id) REFERENCES public.batch_jobs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.batch_jobs ADD CONSTRAINT batch_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.credit_ledger ADD CONSTRAINT credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.disclaimer_acknowledgments ADD CONSTRAINT disclaimer_acknowledgments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_access ADD CONSTRAINT event_access_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_access ADD CONSTRAINT event_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_access ADD CONSTRAINT event_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_access_codes ADD CONSTRAINT event_access_codes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_device_usage ADD CONSTRAINT event_device_usage_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_error_logs ADD CONSTRAINT event_error_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_pass_addons ADD CONSTRAINT event_pass_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.add_ons(id);
ALTER TABLE ONLY public.event_pass_addons ADD CONSTRAINT event_pass_addons_purchased_event_pass_id_fkey FOREIGN KEY (purchased_event_pass_id) REFERENCES public.purchased_event_passes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_photos ADD CONSTRAINT event_photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_photos ADD CONSTRAINT event_photos_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_prompts ADD CONSTRAINT event_prompts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_prompts ADD CONSTRAINT event_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.generated_images ADD CONSTRAINT generated_images_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.generated_images ADD CONSTRAINT generated_images_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.generated_images ADD CONSTRAINT generated_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.kiosk_text_overrides ADD CONSTRAINT kiosk_text_overrides_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prompt_translations ADD CONSTRAINT prompt_translations_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prompts ADD CONSTRAINT prompts_source_prompt_id_fkey FOREIGN KEY (source_prompt_id) REFERENCES public.prompts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prompts ADD CONSTRAINT prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.purchased_event_passes ADD CONSTRAINT purchased_event_passes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.purchased_event_passes ADD CONSTRAINT purchased_event_passes_event_pass_tier_id_fkey FOREIGN KEY (event_pass_tier_id) REFERENCES public.event_passes(id);
ALTER TABLE ONLY public.purchased_event_passes ADD CONSTRAINT purchased_event_passes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sms_logs ADD CONSTRAINT sms_logs_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.generated_images(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sms_logs ADD CONSTRAINT sms_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.smugmug_upload_queue ADD CONSTRAINT smugmug_upload_queue_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.smugmug_upload_queue ADD CONSTRAINT smugmug_upload_queue_generated_image_id_fkey FOREIGN KEY (generated_image_id) REFERENCES public.generated_images(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sticker_designs ADD CONSTRAINT sticker_designs_batch_run_id_fkey FOREIGN KEY (batch_run_id) REFERENCES public.sticker_batch_runs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sticker_designs ADD CONSTRAINT sticker_designs_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.sticker_people(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sticker_designs ADD CONSTRAINT sticker_designs_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.sticker_prompt_variants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sticker_jobs ADD CONSTRAINT sticker_jobs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sticker_people ADD CONSTRAINT sticker_people_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.sticker_jobs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sticker_prompt_variants ADD CONSTRAINT sticker_prompt_variants_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.sticker_jobs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sticker_prompt_variants ADD CONSTRAINT sticker_prompt_variants_library_prompt_id_fkey FOREIGN KEY (library_prompt_id) REFERENCES public.prompts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sticker_sheets ADD CONSTRAINT sticker_sheets_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.sticker_people(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.stripe_customers ADD CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.usage_logs ADD CONSTRAINT usage_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.usage_logs ADD CONSTRAINT usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_add_on_purchases ADD CONSTRAINT user_add_on_purchases_add_on_id_fkey FOREIGN KEY (add_on_id) REFERENCES public.add_ons(id);
ALTER TABLE ONLY public.user_add_on_purchases ADD CONSTRAINT user_add_on_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_credits ADD CONSTRAINT user_credits_purchased_event_pass_id_fkey FOREIGN KEY (purchased_event_pass_id) REFERENCES public.purchased_event_passes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_credits ADD CONSTRAINT user_credits_subscription_tier_id_fkey FOREIGN KEY (subscription_tier_id) REFERENCES public.subscription_tiers_new(id);
ALTER TABLE ONLY public.user_credits ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_event_passes ADD CONSTRAINT user_event_passes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_event_passes ADD CONSTRAINT user_event_passes_event_pass_id_fkey FOREIGN KEY (event_pass_id) REFERENCES public.event_passes(id);
ALTER TABLE ONLY public.user_event_passes ADD CONSTRAINT user_event_passes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_subscription_tier_id_fkey FOREIGN KEY (subscription_tier_id) REFERENCES public.subscription_tiers_new(id);
ALTER TABLE ONLY public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_subscriptions ADD CONSTRAINT user_subscriptions_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers_new(id);
ALTER TABLE ONLY public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.webhook_events ADD CONSTRAINT webhook_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ======================================================================
-- Indexes
-- ======================================================================

CREATE INDEX event_error_logs_event_id_idx ON public.event_error_logs USING btree (event_id, created_at DESC);
CREATE INDEX idx_batch_job_logs_batch_job_id ON public.batch_job_logs USING btree (batch_job_id);
CREATE INDEX idx_credit_ledger_user_id_fkey ON public.credit_ledger USING btree (user_id);
CREATE INDEX idx_credit_transactions_user_id_fkey ON public.credit_transactions USING btree (user_id);
CREATE INDEX idx_disclaimer_acknowledgments_acknowledged_at ON public.disclaimer_acknowledgments USING btree (acknowledged_at);
CREATE INDEX idx_disclaimer_acknowledgments_event_id ON public.disclaimer_acknowledgments USING btree (event_id);
CREATE INDEX idx_event_access_codes_event_id ON public.event_access_codes USING btree (event_id);
CREATE INDEX idx_event_access_codes_event_used ON public.event_access_codes USING btree (event_id, is_used);
CREATE INDEX idx_event_access_codes_token ON public.event_access_codes USING btree (token);
CREATE INDEX idx_event_access_granted_by_fkey ON public.event_access USING btree (granted_by);
CREATE INDEX idx_event_access_user_id_fkey ON public.event_access USING btree (user_id);
CREATE INDEX idx_event_device_usage_event_token ON public.event_device_usage USING btree (event_id, device_token);
CREATE INDEX idx_event_device_usage_last_interaction ON public.event_device_usage USING btree (last_interaction_at);
CREATE INDEX idx_event_pass_addons_addon_id_fkey ON public.event_pass_addons USING btree (addon_id);
CREATE INDEX idx_event_pass_addons_purchased_event_pass_id_fkey ON public.event_pass_addons USING btree (purchased_event_pass_id);
CREATE INDEX idx_event_photos_created_at ON public.event_photos USING btree (created_at DESC);
CREATE INDEX idx_event_photos_event_id ON public.event_photos USING btree (event_id);
CREATE INDEX idx_event_prompts_display_order ON public.event_prompts USING btree (event_id, display_order);
CREATE INDEX idx_event_prompts_prompt_id ON public.event_prompts USING btree (prompt_id);
CREATE INDEX idx_events_user_active_source ON public.events USING btree (user_id, is_active, event_source) WHERE (is_active = true);
CREATE INDEX idx_events_user_id ON public.events USING btree (user_id);
CREATE INDEX idx_generated_images_event_id ON public.generated_images USING btree (event_id);
CREATE INDEX idx_generated_images_prompt_id_fkey ON public.generated_images USING btree (prompt_id);
CREATE INDEX idx_generated_images_user_id ON public.generated_images USING btree (user_id);
CREATE INDEX idx_kiosk_text_overrides_event_lang ON public.kiosk_text_overrides USING btree (event_id, language_code);
CREATE INDEX idx_library_submissions_booking_id ON public.library_submissions USING btree (booking_id);
CREATE INDEX idx_library_submissions_created_at ON public.library_submissions USING btree (created_at DESC);
CREATE INDEX idx_prompt_translations_language_code ON public.prompt_translations USING btree (language_code);
CREATE INDEX idx_prompt_translations_prompt_id ON public.prompt_translations USING btree (prompt_id);
CREATE INDEX idx_prompts_active_category_name ON public.prompts USING btree (category, name) WHERE (is_active = true);
CREATE INDEX idx_prompts_gemini_file_expires_at ON public.prompts USING btree (gemini_file_expires_at) WHERE (gemini_file_uri IS NOT NULL);
CREATE INDEX idx_prompts_mode ON public.prompts USING btree (mode);
CREATE INDEX idx_prompts_source_prompt_id_fkey ON public.prompts USING btree (source_prompt_id);
CREATE INDEX idx_prompts_user_id_fkey ON public.prompts USING btree (user_id);
CREATE INDEX idx_purchased_event_passes_event_id_fkey ON public.purchased_event_passes USING btree (event_id);
CREATE INDEX idx_purchased_event_passes_event_pass_tier_id_fkey ON public.purchased_event_passes USING btree (event_pass_tier_id);
CREATE INDEX idx_purchased_event_passes_user_id_fkey ON public.purchased_event_passes USING btree (user_id);
CREATE INDEX idx_sms_logs_image_id_fkey ON public.sms_logs USING btree (image_id);
CREATE INDEX idx_sms_logs_user_id_fkey ON public.sms_logs USING btree (user_id);
CREATE INDEX idx_smugmug_upload_queue_event_id_fkey ON public.smugmug_upload_queue USING btree (event_id);
CREATE INDEX idx_smugmug_upload_queue_generated_image_id_fkey ON public.smugmug_upload_queue USING btree (generated_image_id);
CREATE INDEX idx_sticker_batch_runs_job_id ON public.sticker_batch_runs USING btree (job_id);
CREATE INDEX idx_subscription_tiers_new_billing_period ON public.subscription_tiers_new USING btree (billing_period);
CREATE INDEX idx_usage_logs_event_id_fkey ON public.usage_logs USING btree (event_id);
CREATE INDEX idx_usage_logs_user_id_fkey ON public.usage_logs USING btree (user_id);
CREATE INDEX idx_user_add_on_purchases_add_on_id_fkey ON public.user_add_on_purchases USING btree (add_on_id);
CREATE INDEX idx_user_add_on_purchases_user_id_fkey ON public.user_add_on_purchases USING btree (user_id);
CREATE INDEX idx_user_credits_purchased_event_pass_id_fkey ON public.user_credits USING btree (purchased_event_pass_id);
CREATE INDEX idx_user_credits_subscription_tier_id_fkey ON public.user_credits USING btree (subscription_tier_id);
CREATE INDEX idx_user_event_passes_event_id_fkey ON public.user_event_passes USING btree (event_id);
CREATE INDEX idx_user_event_passes_event_pass_id_fkey ON public.user_event_passes USING btree (event_pass_id);
CREATE INDEX idx_user_event_passes_user_id_fkey ON public.user_event_passes USING btree (user_id);
CREATE INDEX idx_user_profiles_subscription_tier_id ON public.user_profiles USING btree (subscription_tier_id);
CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);
CREATE INDEX idx_user_subscriptions_tier_id ON public.user_subscriptions USING btree (tier_id);
CREATE INDEX idx_webhook_events_event_id ON public.webhook_events USING btree (event_id);
CREATE INDEX idx_webhook_events_user_id_fkey ON public.webhook_events USING btree (user_id);
CREATE INDEX sticker_designs_batch_run_id_idx ON public.sticker_designs USING btree (batch_run_id);
CREATE INDEX sticker_designs_person_id_idx ON public.sticker_designs USING btree (person_id, sort_order);
CREATE INDEX sticker_jobs_owner_id_idx ON public.sticker_jobs USING btree (owner_id);
CREATE INDEX sticker_people_job_id_idx ON public.sticker_people USING btree (job_id);
CREATE INDEX sticker_prompt_variants_job_id_idx ON public.sticker_prompt_variants USING btree (job_id, sort_order);
CREATE INDEX sticker_prompt_variants_library_prompt_id_idx ON public.sticker_prompt_variants USING btree (library_prompt_id);
CREATE INDEX sticker_sheets_person_id_idx ON public.sticker_sheets USING btree (person_id, sheet_number);

-- ======================================================================
-- Functions
-- ======================================================================

CREATE OR REPLACE FUNCTION public.activate_pass(p_pass_id uuid, p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(success boolean, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_duration_hours integer;
v_pass_user_id uuid;
v_expiration timestamptz;
BEGIN
-- Verify pass belongs to user and is not already activated
SELECT 
uep.user_id,
ep.duration_hours
INTO v_pass_user_id, v_duration_hours
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

-- Check if pass exists
IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

-- Check if pass belongs to user
IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

-- Check if pass has duration
IF v_duration_hours IS NULL THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not have duration';
RETURN;
END IF;

-- Calculate expiration
v_expiration := NOW() + (v_duration_hours || ' hours')::interval;

-- Activate the pass
UPDATE user_event_passes
SET 
activated_at = NOW(),
event_id = p_event_id,
expires_at = v_expiration,
is_active = true
WHERE id = p_pass_id
AND activated_at IS NULL;

-- Check if update was successful
IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass already activated';
RETURN;
END IF;

RETURN QUERY SELECT true, v_expiration, 'Pass activated successfully';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_event_pass_credits(p_user_id uuid, p_credits integer, p_pass_id uuid, p_stripe_payment_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Insert into credit ledger
INSERT INTO credit_ledger (
user_id,
credit_type,
amount,
source_type,
source_id,
description
) VALUES (
p_user_id,
'event_pass',
p_credits,
'stripe_payment',
p_stripe_payment_id,
'Event pass image credits - Pass ID: ' || p_pass_id
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_event_pass_sms_credits(p_user_id uuid, p_sms_credits integer, p_pass_id uuid, p_stripe_payment_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Insert into SMS credit ledger
INSERT INTO sms_credit_ledger (
user_id,
credit_type,
amount,
source_type,
source_id,
description
) VALUES (
p_user_id,
'event_pass',
p_sms_credits,
'stripe_payment',
p_stripe_payment_id,
'Event pass SMS credits - Pass ID: ' || p_pass_id
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_credits(p_user_id uuid, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO user_credits (user_id, purchased_credits)
VALUES (p_user_id, p_amount)
ON CONFLICT (user_id)
DO UPDATE SET
purchased_credits = user_credits.purchased_credits + p_amount;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_credits(p_user_id uuid, p_credits integer, p_stripe_session_id text, p_stripe_payment_intent_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
v_total_credits integer;
BEGIN
UPDATE user_credits
SET purchased_credits = COALESCE(purchased_credits, 0) + p_credits,
updated_at = now()
WHERE user_id = p_user_id;

SELECT get_total_credits(p_user_id) INTO v_total_credits;

INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
stripe_session_id,
stripe_payment_intent_id,
metadata
)
VALUES (
p_user_id,
'credit_pack',
p_credits,
v_total_credits,
p_stripe_session_id,
p_stripe_payment_intent_id,
jsonb_build_object('expires', 'never')
);

RETURN jsonb_build_object(
'success', true,
'credits_added', p_credits,
'new_balance', v_total_credits
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_sms_credits(p_user_id uuid, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO user_credits (user_id, purchased_sms_credits)
VALUES (p_user_id, p_amount)
ON CONFLICT (user_id)
DO UPDATE SET
purchased_sms_credits = user_credits.purchased_sms_credits + p_amount;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_sms_credits(p_user_id uuid, p_sms_credits integer, p_stripe_session_id text, p_stripe_payment_intent_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
v_total_sms_credits integer;
BEGIN
UPDATE user_credits
SET purchased_sms_credits = COALESCE(purchased_sms_credits, 0) + p_sms_credits,
updated_at = now()
WHERE user_id = p_user_id;

SELECT get_total_sms_credits(p_user_id) INTO v_total_sms_credits;

INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
sms_amount,
sms_balance_after,
stripe_session_id,
stripe_payment_intent_id,
metadata
)
VALUES (
p_user_id,
'credit_pack',
0,
(SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0) + COALESCE(event_credits, 0)
FROM user_credits WHERE user_id = p_user_id),
p_sms_credits,
v_total_sms_credits,
p_stripe_session_id,
p_stripe_payment_intent_id,
jsonb_build_object('expires', 'never', 'type', 'sms')
);

RETURN jsonb_build_object(
'success', true,
'sms_credits_added', p_sms_credits,
'new_sms_balance', v_total_sms_credits
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_create_concurrent_event(p_user_id uuid, p_event_id uuid DEFAULT NULL::uuid, p_event_source text DEFAULT 'subscription'::text)
 RETURNS TABLE(can_create boolean, current_count integer, limit_count integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_current_count integer;
v_limit integer;
v_role text;
BEGIN
-- Check if user is admin
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

-- Event pass events don't count toward subscription limits
IF p_event_source = 'event_pass' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

-- Get current count and limit
v_current_count := count_user_active_events(p_user_id, p_event_id);
v_limit := get_user_concurrent_event_limit(p_user_id);

-- If no limit found (no active subscription), return error
IF v_limit IS NULL THEN
RETURN QUERY SELECT 
false,
v_current_count,
0,
'You need an active subscription to create events, or you can purchase an event pass for time-limited events.'::text;
RETURN;
END IF;

-- Check if under limit
IF v_current_count < v_limit THEN
RETURN QUERY SELECT 
true,
v_current_count,
v_limit,
NULL::text;
RETURN;
END IF;

-- At or over limit
RETURN QUERY SELECT 
false,
v_current_count,
v_limit,
format('You have reached your limit of %s concurrent active event%s. Please deactivate an existing event, upgrade your plan, or purchase an event pass for additional events.',
v_limit,
CASE WHEN v_limit = 1 THEN '' ELSE 's' END
)::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_create_event(p_user_id uuid)
 RETURNS TABLE(can_create boolean, reason text, subscription_type text, has_subscription boolean, has_event_pass boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
v_events_allowed integer;
v_current_event_count integer;
BEGIN
-- Get user's subscription info
SELECT up.subscription_status, st.name, COALESCE(st.events_allowed, 0)
INTO v_subscription_status, v_tier_name, v_events_allowed
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Count current active events
SELECT COUNT(*)
INTO v_current_event_count
FROM events e
WHERE e.created_by = p_user_id
AND (e.end_datetime IS NULL OR e.end_datetime > NOW());

-- Check if user has active subscription
IF v_has_active_sub THEN
-- Check event limit for subscription
IF v_events_allowed = -1 OR v_current_event_count < v_events_allowed THEN
RETURN QUERY SELECT true, 'Active subscription allows event creation', 'subscription'::text, true, v_available_passes_count > 0;
ELSE
RETURN QUERY SELECT false, 'Event limit reached for subscription tier', 'subscription'::text, true, v_available_passes_count > 0;
END IF;
RETURN;
END IF;

-- Check if user has available event passes
IF v_available_passes_count > 0 THEN
RETURN QUERY SELECT true, 'Event pass available', 'event_pass'::text, false, true;
RETURN;
END IF;

-- User has neither subscription nor event pass
RETURN QUERY SELECT false, 'No active subscription or event pass', 'none'::text, false, false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_modify_event_start_time(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(can_modify boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_is_admin boolean;
v_has_activated_pass boolean;
v_is_owner boolean;
BEGIN
-- Check if user is admin
v_is_admin := is_admin(p_user_id);

-- Admin can always modify
IF v_is_admin THEN
RETURN QUERY SELECT true, 'Admin override'::text;
RETURN;
END IF;

-- Check if user owns the event
SELECT EXISTS (
SELECT 1 FROM events
WHERE id = p_event_id
AND created_by = p_user_id
) INTO v_is_owner;

IF NOT v_is_owner THEN
RETURN QUERY SELECT false, 'Not event owner'::text;
RETURN;
END IF;

-- Check if event has an activated pass
v_has_activated_pass := has_activated_event_pass(p_event_id);

IF v_has_activated_pass THEN
RETURN QUERY SELECT 
false, 
'Cannot modify start time: Event pass has been activated and the duration countdown has begun. The start time is now locked.'::text;
RETURN;
END IF;

-- No activated pass, can modify
RETURN QUERY SELECT true, 'Can modify'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pass_validity(p_pass_id uuid, p_user_id uuid)
 RETURNS TABLE(is_valid boolean, is_expired boolean, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_pass_user_id uuid;
v_activated_at timestamptz;
v_expires_at timestamptz;
v_is_active boolean;
BEGIN
-- Get pass details
SELECT 
uep.user_id,
uep.activated_at,
uep.expires_at,
uep.is_active
INTO v_pass_user_id, v_activated_at, v_expires_at, v_is_active
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

-- Check if pass exists
IF NOT FOUND THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

-- Check if pass belongs to user
IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

-- Check if pass is activated
IF v_activated_at IS NULL THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass is not activated';
RETURN;
END IF;

-- Check if pass is expired
IF v_expires_at < NOW() THEN
RETURN QUERY SELECT false, true, v_expires_at, 'Pass has expired';
RETURN;
END IF;

-- Pass is valid
RETURN QUERY SELECT true, false, v_expires_at, 'Pass is valid';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_device_usage()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
DELETE FROM event_device_usage
WHERE last_interaction_at < now() - interval '6 months';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_event_documentation_stats(p_event_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_is_admin() THEN
    RAISE EXCEPTION 'Only an admin can clear event documentation statistics';
  END IF;

  UPDATE public.events
  SET analytics_reset_at = now()
  WHERE id = p_event_id
  RETURNING analytics_reset_at INTO v_reset_at;

  IF v_reset_at IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  RETURN v_reset_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id uuid, p_amount integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
current_subscription_credits integer;
current_purchased_credits integer;
current_event_credits integer;
remaining integer;
BEGIN
SELECT 
COALESCE(subscription_credits, 0),
COALESCE(purchased_credits, 0),
COALESCE(event_credits, 0)
INTO 
current_subscription_credits,
current_purchased_credits,
current_event_credits
FROM user_credits
WHERE user_id = p_user_id;

remaining := p_amount;

IF current_event_credits > 0 THEN
IF current_event_credits >= remaining THEN
UPDATE user_credits
SET event_credits = event_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
remaining := remaining - current_event_credits;
UPDATE user_credits
SET event_credits = 0
WHERE user_id = p_user_id;
END IF;
END IF;

IF remaining > 0 AND current_subscription_credits > 0 THEN
IF current_subscription_credits >= remaining THEN
UPDATE user_credits
SET subscription_credits = subscription_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
remaining := remaining - current_subscription_credits;
UPDATE user_credits
SET subscription_credits = 0
WHERE user_id = p_user_id;
END IF;
END IF;

IF remaining > 0 AND current_purchased_credits > 0 THEN
IF current_purchased_credits >= remaining THEN
UPDATE user_credits
SET purchased_credits = purchased_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
RETURN false;
END IF;
END IF;

IF remaining > 0 THEN
RETURN false;
END IF;

RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_sms_credit(p_user_id uuid, p_amount integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
current_subscription_sms integer;
current_purchased_sms integer;
current_event_sms integer;
remaining integer;
BEGIN
SELECT 
COALESCE(subscription_sms_credits, 0),
COALESCE(purchased_sms_credits, 0),
COALESCE(event_sms_credits, 0)
INTO 
current_subscription_sms,
current_purchased_sms,
current_event_sms
FROM user_credits
WHERE user_id = p_user_id;

remaining := p_amount;

IF current_event_sms > 0 THEN
IF current_event_sms >= remaining THEN
UPDATE user_credits
SET event_sms_credits = event_sms_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
remaining := remaining - current_event_sms;
UPDATE user_credits
SET event_sms_credits = 0
WHERE user_id = p_user_id;
END IF;
END IF;

IF remaining > 0 AND current_subscription_sms > 0 THEN
IF current_subscription_sms >= remaining THEN
UPDATE user_credits
SET subscription_sms_credits = subscription_sms_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
remaining := remaining - current_subscription_sms;
UPDATE user_credits
SET subscription_sms_credits = 0
WHERE user_id = p_user_id;
END IF;
END IF;

IF remaining > 0 AND current_purchased_sms > 0 THEN
IF current_purchased_sms >= remaining THEN
UPDATE user_credits
SET purchased_sms_credits = purchased_sms_credits - remaining
WHERE user_id = p_user_id;
RETURN true;
ELSE
RETURN false;
END IF;
END IF;

IF remaining > 0 THEN
RETURN false;
END IF;

RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.count_user_active_events(p_user_id uuid, p_exclude_event_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer;
BEGIN
-- Count events that are:
-- 1. Created by this user
-- 2. Is active
-- 3. From subscription (not event pass)
-- 4. Either has no time limits OR is currently within time window
SELECT COUNT(*)
INTO v_count
FROM events e
WHERE e.user_id = p_user_id
AND e.is_active = true
AND e.event_source = 'subscription'
AND (e.id != p_exclude_event_id OR p_exclude_event_id IS NULL)
AND (
-- No time limits (always active)
(e.start_datetime IS NULL AND e.end_datetime IS NULL)
OR
-- Within time window
(e.start_datetime IS NOT NULL AND e.end_datetime IS NOT NULL 
AND NOW() >= e.start_datetime AND NOW() <= e.end_datetime)
OR
-- Started but no end time
(e.start_datetime IS NOT NULL AND e.end_datetime IS NULL 
AND NOW() >= e.start_datetime)
);

RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_expired_pass_events()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer;
BEGIN
-- Deactivate events whose pass has expired
WITH expired_passes AS (
SELECT 
uep.event_id,
uep.activated_at + (ep.duration_hours || ' hours')::interval as expires_at
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.activated_at IS NOT NULL
AND uep.event_id IS NOT NULL
AND NOW() > (uep.activated_at + (ep.duration_hours || ' hours')::interval)
)
UPDATE events
SET is_active = false
FROM expired_passes
WHERE events.id = expired_passes.event_id
AND events.is_active = true;

GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicate_prompt(source_prompt_id uuid, new_owner_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
new_prompt_id uuid;
source_prompt record;
BEGIN
-- Validate the source prompt exists and is public
SELECT * INTO source_prompt
FROM prompts
WHERE id = source_prompt_id
AND is_active = true;

IF NOT FOUND THEN
RAISE EXCEPTION 'Source prompt not found or is inactive';
END IF;

-- Only public prompts can be duplicated by others
IF source_prompt.is_public = false AND source_prompt.user_id != new_owner_id THEN
RAISE EXCEPTION 'Cannot duplicate private prompts that you do not own';
END IF;

-- Create the duplicate prompt
INSERT INTO prompts (
user_id,
name,
description,
category,
prompt_text,
preview_image_url,
reference_image_url,
tags,
is_active,
is_public,
source_prompt_id,
usage_count
)
VALUES (
new_owner_id,
source_prompt.name || ' (Copy)',
source_prompt.description,
source_prompt.category,
source_prompt.prompt_text,
source_prompt.preview_image_url,
source_prompt.reference_image_url,
source_prompt.tags,
true,
false, -- Duplicates default to private
source_prompt_id, -- Track the source
0 -- Reset usage count
)
RETURNING id INTO new_prompt_id;

RETURN new_prompt_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_passes(p_user_id uuid)
 RETURNS TABLE(id uuid, tier_name text, duration_hours integer, purchased_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT 
uep.id,
ep.name as tier_name,
ep.duration_hours,
uep.created_at as purchased_at
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL
ORDER BY uep.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_gemini_settings()
 RETURNS TABLE(gemini_api_key text, gemini_enabled boolean, gemini_model text, gemini_resolution text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
RETURN QUERY
SELECT 
gs.gemini_api_key,
gs.gemini_enabled,
gs.gemini_model,
gs.gemini_resolution
FROM global_settings gs
LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pass_expiration(p_pass_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_activated_at timestamptz;
v_duration_hours integer;
BEGIN
SELECT 
uep.activated_at,
ep.duration_hours
INTO v_activated_at, v_duration_hours
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

IF NOT FOUND OR v_activated_at IS NULL THEN
RETURN NULL;
END IF;

RETURN v_activated_at + (v_duration_hours || ' hours')::interval;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_total_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
total integer;
BEGIN
SELECT COALESCE(
subscription_credits +
purchased_credits +
event_credits,
0
) INTO total
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(total, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_total_sms_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
total_sms integer;
BEGIN
SELECT COALESCE(
subscription_sms_credits +
purchased_sms_credits +
event_sms_credits,
0
) INTO total_sms
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(total_sms, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_concurrent_event_limit(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_limit integer;
v_role text;
BEGIN
-- Check if user is admin - admins have no limits
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN 999999; -- Effectively unlimited
END IF;

-- First check new user_subscriptions table
SELECT st.concurrent_events
INTO v_limit
FROM user_subscriptions us
JOIN subscription_tiers_new st ON us.tier_id = st.id
WHERE us.user_id = p_user_id
AND us.status = 'active'
AND us.current_period_end > NOW()
ORDER BY us.created_at DESC
LIMIT 1;

-- If found in new table, return it
IF v_limit IS NOT NULL THEN
RETURN v_limit;
END IF;

-- Fallback to old user_profiles table
SELECT st.concurrent_events
INTO v_limit
FROM user_profiles up
JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id
AND up.subscription_status = 'active';

-- Return limit or NULL if no active subscription
RETURN v_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id uuid)
 RETURNS TABLE(subscription_credits integer, purchased_credits integer, event_credits integer, image_credits integer, total_credits integer, subscription_sms_credits integer, purchased_sms_credits integer, event_sms_credits integer, total_sms_credits integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
RETURN QUERY
SELECT 
COALESCE(uc.subscription_credits, 0)::integer,
COALESCE(uc.purchased_credits, 0)::integer,
COALESCE(uc.event_credits, 0)::integer,
COALESCE(
uc.subscription_credits + 
uc.purchased_credits + 
uc.event_credits,
0
)::integer as image_credits,
COALESCE(
uc.subscription_credits + 
uc.purchased_credits + 
uc.event_credits,
0
)::integer as total_credits,
COALESCE(uc.subscription_sms_credits, 0)::integer,
COALESCE(uc.purchased_sms_credits, 0)::integer,
COALESCE(uc.event_sms_credits, 0)::integer,
COALESCE(
uc.subscription_sms_credits + 
uc.purchased_sms_credits + 
uc.event_sms_credits,
0
)::integer as total_sms_credits
FROM user_credits uc
WHERE uc.user_id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_event_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
event_credits_balance integer;
BEGIN
SELECT COALESCE(event_credits, 0) INTO event_credits_balance
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(event_credits_balance, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_image_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
total_credits integer;
BEGIN
SELECT COALESCE(
subscription_credits +
purchased_credits +
event_credits,
0
) INTO total_credits
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(total_credits, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_subscription_info(p_user_id uuid)
 RETURNS TABLE(subscription_type text, tier_name text, has_active_subscription boolean, has_available_passes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
BEGIN
-- Get user's subscription info
SELECT up.subscription_status, st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Determine subscription type
IF v_has_active_sub THEN
RETURN QUERY SELECT 
'subscription'::text,
v_tier_name,
true,
v_available_passes_count > 0;
ELSIF v_available_passes_count > 0 THEN
RETURN QUERY SELECT 
'event_pass'::text,
v_tier_name,
false,
true;
ELSE
RETURN QUERY SELECT 
'none'::text,
v_tier_name,
false,
false;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_subscription_type(p_user_id uuid)
 RETURNS TABLE(subscription_type text, tier_name text, has_active_sub boolean, has_available_passes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_tier_name text;
v_subscription_status text;
v_available_passes_count integer;
BEGIN
-- Get subscription info
SELECT 
up.subscription_status,
st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes - FIXED: Join with event_passes instead of subscription_tiers
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Determine subscription type
IF v_has_active_sub THEN
RETURN QUERY SELECT 
'subscription'::text,
v_tier_name,
true,
v_available_passes_count > 0;
ELSIF v_available_passes_count > 0 THEN
RETURN QUERY SELECT 
'event_pass'::text,
v_tier_name,
false,
true;
ELSE
RETURN QUERY SELECT 
'free'::text,
COALESCE(v_tier_name, 'Free'),
false,
false;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_tenant_id uuid;
BEGIN
SELECT subscription_tier_id INTO v_tenant_id
FROM user_profiles
WHERE id = auth.uid();

RETURN v_tenant_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_free_tier_id uuid;
v_credit_balance integer;
v_full_name text;
BEGIN
-- Get Free tier ID
SELECT id INTO v_free_tier_id
FROM subscription_tiers_new
WHERE name = 'Free' AND is_active = true
LIMIT 1;

-- If no Free tier found, raise error
IF v_free_tier_id IS NULL THEN
RAISE EXCEPTION 'No active Free tier found';
END IF;

-- Extract full_name from metadata or use email username as fallback
v_full_name := COALESCE(
NEW.raw_user_meta_data->>'full_name',
split_part(NEW.email, '@', 1)
);

-- Insert user profile with full_name
INSERT INTO user_profiles (
id,
email,
full_name,
subscription_tier_id,
subscription_status,
role
)
VALUES (
NEW.id,
NEW.email,
v_full_name,
v_free_tier_id,
'active',
'user'
)
ON CONFLICT (id) DO NOTHING;

-- Insert user credits with both OLD and NEW system columns
INSERT INTO user_credits (
user_id,
images_limit,
sms_limit,
events_limit,
images_used,
sms_used,
subscription_credits,
subscription_sms_credits,
purchased_credits,
purchased_sms_credits,
event_credits,
event_sms_credits,
reset_date
)
VALUES (
NEW.id,
10,  -- images_limit (old system)
10,  -- sms_limit
1,   -- events_limit
0,   -- images_used
0,   -- sms_used
10,  -- subscription_credits (new system)
10,  -- subscription_sms_credits (new system)
0,   -- purchased_credits
0,   -- purchased_sms_credits
0,   -- event_credits
0,   -- event_sms_credits
date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
)
ON CONFLICT (user_id) DO NOTHING;

-- Calculate initial balance
v_credit_balance := 10; -- subscription_credits

-- Create ledger entry for initial subscription credits
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
metadata,
created_at
)
VALUES (
NEW.id,
'subscription',
10,
v_credit_balance,
jsonb_build_object(
'type', 'initial_signup',
'tier', 'Free',
'description', 'Initial FREE tier image credits'
),
now()
);

-- Create ledger entry for initial SMS credits (tracked separately)
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
metadata,
created_at
)
VALUES (
NEW.id,
'subscription',
10,
10,
jsonb_build_object(
'type', 'initial_signup',
'tier', 'Free',
'credit_type', 'sms',
'description', 'Initial FREE tier SMS credits'
),
now()
);

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_activated_event_pass(p_event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_pass boolean;
BEGIN
SELECT EXISTS (
SELECT 1 
FROM user_event_passes
WHERE event_id = p_event_id
AND activated_at IS NOT NULL
) INTO v_has_pass;

RETURN COALESCE(v_has_pass, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_new_subscription_count integer;
v_old_subscription_active boolean;
BEGIN
-- Check new user_subscriptions table first
SELECT COUNT(*)
INTO v_new_subscription_count
FROM user_subscriptions us
JOIN subscription_tiers_new st ON us.tier_id = st.id
WHERE us.user_id = p_user_id
AND us.status IN ('active', 'past_due')
AND st.is_active = true;

IF v_new_subscription_count > 0 THEN
RETURN true;
END IF;

-- Check old user_profiles subscription fields for backward compatibility
SELECT 
CASE 
WHEN subscription_tier_id IS NOT NULL 
AND LOWER(subscription_status) IN ('active', 'past_due')
THEN true
ELSE false
END
INTO v_old_subscription_active
FROM user_profiles
WHERE id = p_user_id;

RETURN COALESCE(v_old_subscription_active, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_image_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
-- Only increment if user_id is set
IF NEW.user_id IS NOT NULL THEN
-- Increment user image usage (ignore if user_credits doesn't exist yet)
UPDATE user_credits 
SET images_used = images_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

-- Increment event total
UPDATE events 
SET total_generations = total_generations + 1,
updated_at = now()
WHERE id = NEW.event_id;

-- Increment prompt usage
UPDATE prompts 
SET usage_count = usage_count + 1,
updated_at = now()
WHERE id = NEW.prompt_id;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_image_usage(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO usage_logs (tenant_id, resource_type, quantity)
VALUES (p_tenant_id, 'images', 1)
ON CONFLICT (tenant_id, resource_type, date)
DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sms_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
-- Only increment if user_id is set
IF NEW.user_id IS NOT NULL THEN
-- Increment user SMS usage (ignore if user_credits doesn't exist yet)
UPDATE user_credits 
SET sms_used = sms_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sms_usage(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO usage_logs (tenant_id, resource_type, quantity)
VALUES (p_tenant_id, 'sms', 1)
ON CONFLICT (tenant_id, resource_type, date)
DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_user_image_usage(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
UPDATE user_credits 
SET images_used = images_used + 1
WHERE user_id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_user_sms_usage(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
UPDATE user_credits 
SET sms_used = sms_used + 1
WHERE user_id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
RETURN EXISTS (
SELECT 1 FROM user_profiles
WHERE id = auth.uid()
AND role = 'admin'
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id AND lower(role) = 'admin');
END; $function$
;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
SELECT EXISTS (
SELECT 1
FROM user_profiles
WHERE id = auth.uid()
AND lower(role) = 'admin'
);
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_active_and_valid(event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
event_record RECORD;
BEGIN
SELECT
is_active,
start_datetime,
end_datetime,
test_mode
INTO event_record
FROM events
WHERE id = event_id;

IF NOT FOUND THEN
RETURN false;
END IF;

IF event_record.is_active = false THEN
RETURN false;
END IF;

-- In test mode, skip time-window checks
IF event_record.test_mode = true THEN
RETURN true;
END IF;

IF event_record.start_datetime IS NOT NULL
AND NOW() < event_record.start_datetime THEN
RETURN false;
END IF;

IF event_record.end_datetime IS NOT NULL
AND NOW() > event_record.end_datetime THEN
RETURN false;
END IF;

RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_pass_active(p_pass_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_expiration timestamptz;
BEGIN
v_expiration := get_pass_expiration(p_pass_id);

IF v_expiration IS NULL THEN
RETURN false;
END IF;

RETURN NOW() < v_expiration;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_prompt_owner(p_prompt_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
prompt_user_id uuid;
BEGIN
SELECT user_id INTO prompt_user_id
FROM prompts
WHERE id = p_prompt_id;

RETURN prompt_user_id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_start_time_change_with_activated_pass()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_activated_pass boolean;
v_is_admin boolean;
v_start_time_changed boolean;
BEGIN
-- Only check on UPDATE operations
IF TG_OP = 'UPDATE' THEN
-- Check if start_datetime is being changed
v_start_time_changed := (OLD.start_datetime IS DISTINCT FROM NEW.start_datetime);

-- If start time hasn't changed, allow the update
IF NOT v_start_time_changed THEN
RETURN NEW;
END IF;

-- Check if user is admin (using auth.uid())
v_is_admin := is_admin(auth.uid());

-- Admin can bypass
IF v_is_admin THEN
RETURN NEW;
END IF;

-- Check if event has activated pass
v_has_activated_pass := has_activated_event_pass(OLD.id);

IF v_has_activated_pass THEN
RAISE EXCEPTION 'Cannot modify start time: Event pass has been activated. The start time is now locked.';
END IF;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_event_analytics_reset_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.analytics_reset_at IS DISTINCT FROM OLD.analytics_reset_at THEN
    IF auth.uid() IS NULL OR NOT public.user_is_admin() THEN
      RAISE EXCEPTION 'Only an admin can clear event documentation statistics';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_generated_image(p_event_id uuid, p_prompt_id uuid, p_original_image_url text DEFAULT NULL::text, p_generated_image_url text DEFAULT NULL::text, p_phone_number text DEFAULT NULL::text, p_status text DEFAULT 'processing'::text, p_error_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_image_id uuid;
v_user_id uuid := auth.uid();
BEGIN
IF p_status NOT IN ('processing', 'completed', 'failed') THEN
RAISE EXCEPTION 'Invalid image status';
END IF;

IF NOT EXISTS (
SELECT 1
FROM events e
WHERE e.id = p_event_id
AND (
e.is_active = true
OR e.test_mode = true
OR e.user_id = v_user_id
OR e.created_by = v_user_id
OR EXISTS (
SELECT 1
FROM event_access ea
WHERE ea.event_id = e.id
AND ea.user_id = v_user_id
)
OR EXISTS (
SELECT 1
FROM user_profiles up
WHERE up.id = v_user_id
AND up.role = 'admin'
)
)
) THEN
RAISE EXCEPTION 'Event is not available for image saving';
END IF;

IF NOT EXISTS (
SELECT 1
FROM event_prompts ep
WHERE ep.event_id = p_event_id
AND ep.prompt_id = p_prompt_id
) THEN
RAISE EXCEPTION 'Prompt is not assigned to this event';
END IF;

INSERT INTO generated_images (
event_id,
prompt_id,
original_image_url,
generated_image_url,
phone_number,
status,
error_message,
user_id
)
VALUES (
p_event_id,
p_prompt_id,
p_original_image_url,
p_generated_image_url,
p_phone_number,
p_status,
p_error_message,
v_user_id
)
RETURNING id INTO v_image_id;

RETURN v_image_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_event_ownership(p_event_id uuid, p_new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_current_owner uuid;
v_is_admin boolean;
BEGIN
-- Get current owner
SELECT user_id INTO v_current_owner
FROM events
WHERE id = p_event_id;

IF v_current_owner IS NULL THEN
RAISE EXCEPTION 'Event not found';
END IF;

-- Check if caller is admin
SELECT EXISTS (
SELECT 1 FROM user_profiles
WHERE id = auth.uid()
AND role = 'admin'
) INTO v_is_admin;

-- Verify caller is the current owner or an admin
IF v_current_owner != auth.uid() AND NOT v_is_admin THEN
RAISE EXCEPTION 'Only the event owner or an admin can transfer ownership';
END IF;

-- Prevent transferring to the current owner (no-op)
IF v_current_owner = p_new_owner_id THEN
RETURN;
END IF;

-- Update the event owner
UPDATE events
SET user_id = p_new_owner_id,
updated_at = now()
WHERE id = p_event_id;

-- Remove any event_access row for the new owner (they own it now)
DELETE FROM event_access
WHERE event_id = p_event_id
AND user_id = p_new_owner_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_global_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_webhook_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_user_role text;
BEGIN
SELECT role INTO v_user_role
FROM user_profiles
WHERE id = auth.uid();

RETURN v_user_role = required_role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_user_role text;
BEGIN
SELECT role INTO v_user_role
FROM user_profiles
WHERE id = auth.uid();

RETURN lower(v_user_role) = 'admin';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_event_time_restrictions(p_user_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_pass_id uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(is_valid boolean, error_message text, restriction_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_user_role text;
v_has_active_sub boolean;
v_has_available_passes boolean;
v_subscription_type text;
v_can_create boolean;
v_current_count integer;
v_limit_count integer;
v_limit_error text;
v_event_source text;
BEGIN
-- Case 0: Check if user is ADMIN - bypass all restrictions
SELECT LOWER(role)
INTO v_user_role
FROM user_profiles
WHERE id = p_user_id;

IF v_user_role = 'admin' THEN
RETURN QUERY SELECT
true,
NULL::text,
'admin_unlimited'::text;
RETURN;
END IF;

-- Determine event source
IF p_pass_id IS NOT NULL THEN
v_event_source := 'event_pass';
ELSE
v_event_source := 'subscription';
END IF;

-- Check concurrent event limits for subscription events
IF v_event_source = 'subscription' THEN
-- FIX: Use explicit aliases to avoid ambiguous column references
SELECT 
c.can_create, 
c.current_count, 
c.limit_count, 
c.error_message
INTO v_can_create, v_current_count, v_limit_count, v_limit_error
FROM can_create_concurrent_event(p_user_id, p_event_id, v_event_source) c;

IF NOT v_can_create THEN
RETURN QUERY SELECT 
false,
v_limit_error,
'concurrent_limit_reached'::text;
RETURN;
END IF;
END IF;

-- Get user subscription type
SELECT 
subscription_type,
has_active_sub,
has_available_passes
INTO v_subscription_type, v_has_active_sub, v_has_available_passes
FROM get_user_subscription_type(p_user_id);

-- Case 1: User has active subscription
IF v_has_active_sub THEN
-- Subscription users should NOT use event passes
IF p_pass_id IS NOT NULL THEN
RETURN QUERY SELECT 
false,
'You have an active subscription. Event passes are not needed for subscription accounts.'::text,
'subscription_no_pass'::text;
RETURN;
END IF;

-- Subscription users can have unlimited events (no time restrictions required)
RETURN QUERY SELECT 
true,
NULL::text,
'subscription_unlimited'::text;
RETURN;
END IF;

-- Case 2: User wants to use event pass
IF p_pass_id IS NOT NULL THEN
-- Verify pass exists and belongs to user
IF NOT EXISTS (
SELECT 1 FROM user_event_passes
WHERE id = p_pass_id
AND user_id = p_user_id
AND activated_at IS NULL
) THEN
RETURN QUERY SELECT 
false,
'Selected event pass is invalid or already activated.'::text,
'invalid_pass'::text;
RETURN;
END IF;

-- Event pass events MUST have time restrictions
IF p_start_datetime IS NULL OR p_end_datetime IS NULL THEN
RETURN QUERY SELECT 
false,
'Event pass events must have start and end times specified.'::text,
'pass_requires_times'::text;
RETURN;
END IF;

-- Validate end time is after start time
IF p_end_datetime <= p_start_datetime THEN
RETURN QUERY SELECT 
false,
'Event end time must be after start time.'::text,
'invalid_time_range'::text;
RETURN;
END IF;

-- Event pass events are valid
RETURN QUERY SELECT 
true,
NULL::text,
'event_pass_valid'::text;
RETURN;
END IF;

-- Case 3: Free tier user without passes trying to create event
RETURN QUERY SELECT 
false,
'You need an active subscription or event pass to create events.'::text,
'no_subscription_or_pass'::text;
END;
$function$
;


-- ======================================================================
-- Views
-- ======================================================================

CREATE VIEW public.stripe_user_subscriptions WITH (security_invoker=true) AS
 SELECT c.customer_id,
    s.subscription_id,
    s.status AS subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
   FROM (public.stripe_customers c
     LEFT JOIN public.stripe_subscriptions s ON ((c.customer_id = s.customer_id)))
  WHERE ((c.user_id = auth.uid()) AND (c.deleted_at IS NULL) AND (s.deleted_at IS NULL));

CREATE VIEW public.stripe_user_orders WITH (security_invoker=true) AS
 SELECT c.customer_id,
    o.id AS order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status AS order_status,
    o.created_at AS order_date
   FROM (public.stripe_customers c
     LEFT JOIN public.stripe_orders o ON ((c.customer_id = o.customer_id)))
  WHERE ((c.user_id = auth.uid()) AND (c.deleted_at IS NULL) AND (o.deleted_at IS NULL));

CREATE VIEW public.admin_all_users WITH (security_invoker=true) AS
 SELECT up.id,
    up.email,
    up.full_name,
    up.display_name,
    up.role,
    up.created_at,
    up.updated_at,
    us.id AS subscription_id,
    us.status AS subscription_status,
    us.tier_id AS subscription_tier_id,
    st.name AS subscription_tier_name,
    st.plan_type,
    us.stripe_subscription_id,
    us.current_period_start AS subscription_start_date,
    us.current_period_end AS subscription_end_date,
    us.cancel_at_period_end,
    uc.images_limit,
    uc.images_used,
    uc.sms_limit,
    uc.sms_used,
    uc.events_limit,
    uc.reset_date,
    uc.subscription_credits,
    uc.purchased_credits,
    uc.event_credits,
    uc.subscription_sms_credits,
    uc.purchased_sms_credits,
    uc.event_sms_credits,
    ( SELECT count(*) AS count
           FROM public.events
          WHERE (events.user_id = up.id)) AS total_events,
    ( SELECT count(*) AS count
           FROM public.prompts
          WHERE (prompts.user_id = up.id)) AS total_prompts
   FROM (((public.user_profiles up
     LEFT JOIN public.user_subscriptions us ON (((up.id = us.user_id) AND (us.status = 'active'::text))))
     LEFT JOIN public.subscription_tiers st ON ((us.tier_id = st.id)))
     LEFT JOIN public.user_credits uc ON ((up.id = uc.user_id)));

CREATE VIEW public.public_global_settings AS
 SELECT id,
    singleton_id,
    gemini_enabled,
    gemini_model,
    gemini_resolution,
    twilio_enabled,
    twilio_phone_number,
    smugmug_user_nickname,
    smugmug_connection_status,
    smugmug_default_visibility,
    use_smugmug_for_sms,
    smugmug_username,
    smugmug_last_auth_date,
    library_page_enabled,
    created_at,
    updated_at
   FROM public.global_settings;


-- ======================================================================
-- Triggers (incl. auth.users -> public.handle_new_user)
-- ======================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER prevent_start_time_change_on_events BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.prevent_start_time_change_with_activated_pass();
CREATE TRIGGER protect_event_analytics_reset_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.protect_event_analytics_reset_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER track_image_generation AFTER INSERT ON public.generated_images FOR EACH ROW EXECUTE FUNCTION public.increment_image_usage();
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_global_settings_updated_at();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER track_sms_sent AFTER INSERT ON public.sms_logs FOR EACH ROW EXECUTE FUNCTION public.increment_sms_usage();
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_user_settings_updated_at();
CREATE TRIGGER set_webhook_events_updated_at BEFORE UPDATE ON public.webhook_events FOR EACH ROW EXECUTE FUNCTION public.update_webhook_events_updated_at();

-- ======================================================================
-- Row level security
-- ======================================================================

ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topup_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_device_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pass_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_text_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchased_event_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smugmug_upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_prompt_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_add_on_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- Policies (public + storage)
-- ======================================================================

CREATE POLICY "Admins can delete add-ons" ON public.add_ons AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_current_user_admin());
CREATE POLICY "Admins can insert add-ons" ON public.add_ons AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update add-ons" ON public.add_ons AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Anyone can view active add-ons" ON public.add_ons AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY batch_job_logs_insert ON public.batch_job_logs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY batch_job_logs_select ON public.batch_job_logs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Users can insert their own batch jobs" ON public.batch_jobs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own batch jobs" ON public.batch_jobs AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY batch_jobs_delete ON public.batch_jobs AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (true);
CREATE POLICY batch_jobs_insert ON public.batch_jobs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY batch_jobs_select ON public.batch_jobs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY batch_jobs_update ON public.batch_jobs AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can view credit ledger" ON public.credit_ledger AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can view active topup products, admins can view all" ON public.credit_topup_products AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Users can read own transactions" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY anon_insert_disclaimer_acknowledgments ON public.disclaimer_acknowledgments AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY delete_own_disclaimer_acknowledgments ON public.disclaimer_acknowledgments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = disclaimer_acknowledgments.event_id) AND (events.user_id = auth.uid())))));
CREATE POLICY select_own_disclaimer_acknowledgments ON public.disclaimer_acknowledgments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = disclaimer_acknowledgments.event_id) AND (events.user_id = auth.uid())))));
CREATE POLICY update_own_disclaimer_acknowledgments ON public.disclaimer_acknowledgments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = disclaimer_acknowledgments.event_id) AND (events.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = disclaimer_acknowledgments.event_id) AND (events.user_id = auth.uid())))));
CREATE POLICY "Owners can grant event access" ON public.event_access AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_access.event_id) AND ((events.user_id = auth.uid()) OR public.user_is_admin())))));
CREATE POLICY "Owners can revoke event access" ON public.event_access AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_access.event_id) AND ((events.user_id = auth.uid()) OR public.user_is_admin())))));
CREATE POLICY "Users can view their granted access, admins can view all" ON public.event_access AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY delete_event_access_codes ON public.event_access_codes AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_access_codes.event_id) AND (events.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (lower(user_profiles.role) = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = event_access_codes.event_id) AND (event_access.user_id = auth.uid()))))));
CREATE POLICY insert_event_access_codes ON public.event_access_codes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_access_codes.event_id) AND (events.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (lower(user_profiles.role) = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = event_access_codes.event_id) AND (event_access.user_id = auth.uid()))))));
CREATE POLICY select_event_access_codes ON public.event_access_codes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_access_codes.event_id) AND (events.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (lower(user_profiles.role) = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = event_access_codes.event_id) AND (event_access.user_id = auth.uid()))))));
CREATE POLICY delete_event_device_usage ON public.event_device_usage AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_device_usage.event_id) AND (events.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (lower(user_profiles.role) = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = event_device_usage.event_id) AND (event_access.user_id = auth.uid()))))));
CREATE POLICY select_event_device_usage ON public.event_device_usage AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_device_usage.event_id) AND (events.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (lower(user_profiles.role) = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = event_device_usage.event_id) AND (event_access.user_id = auth.uid()))))));
CREATE POLICY admin_select_all_errors ON public.event_error_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY anon_insert_errors ON public.event_error_logs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY select_own_event_errors ON public.event_error_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.user_id = auth.uid()))));
CREATE POLICY "Users can view event pass addons" ON public.event_pass_addons AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.purchased_event_passes pep
  WHERE ((pep.id = event_pass_addons.purchased_event_pass_id) AND ((pep.user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin))))));
CREATE POLICY "Admins can delete event passes" ON public.event_passes AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_current_user_admin());
CREATE POLICY "Admins can insert event passes" ON public.event_passes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update event passes" ON public.event_passes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Anyone can view active passes" ON public.event_passes AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Public can insert event photos" ON public.event_photos AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Public can read event photos" ON public.event_photos AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY anon_delete_event_photos ON public.event_photos AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (true);
CREATE POLICY "Select event prompts" ON public.event_prompts AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_prompts.event_id) AND ((e.is_active = true) OR (e.user_id = auth.uid()) OR (e.created_by = auth.uid()) OR public.user_is_admin() OR (EXISTS ( SELECT 1
           FROM public.event_access ea
          WHERE ((ea.event_id = e.id) AND (ea.user_id = auth.uid())))))))));
CREATE POLICY "Users can delete event prompts for own events or admin" ON public.event_prompts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_prompts.event_id) AND ((events.user_id = ( SELECT auth.uid() AS uid)) OR public.user_is_admin())))));
CREATE POLICY "Users can insert event prompts for own events or admin" ON public.event_prompts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_prompts.event_id) AND ((events.user_id = ( SELECT auth.uid() AS uid)) OR public.user_is_admin())))));
CREATE POLICY "Users can update event prompts for own events or admin" ON public.event_prompts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_prompts.event_id) AND ((events.user_id = ( SELECT auth.uid() AS uid)) OR public.user_is_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_prompts.event_id) AND ((events.user_id = ( SELECT auth.uid() AS uid)) OR public.user_is_admin())))));
CREATE POLICY "Public can view active events" ON public.events AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
CREATE POLICY "Users can delete own events or admin can delete all" ON public.events AS PERMISSIVE FOR DELETE TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()));
CREATE POLICY "Users can insert own events" ON public.events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can update own events or admin can update all" ON public.events AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Users can view own, shared, or all if admin" ON public.events AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.event_access
  WHERE ((event_access.event_id = events.id) AND (event_access.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY anon_update_events ON public.events AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Anonymous users can view generated images" ON public.generated_images AS PERMISSIVE FOR SELECT TO anon
  USING (true);
CREATE POLICY "Users can view accessible images" ON public.generated_images AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = generated_images.event_id) AND ((e.created_by = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin) OR (EXISTS ( SELECT 1
           FROM public.event_access ea
          WHERE ((ea.event_id = e.id) AND (ea.user_id = ( SELECT auth.uid() AS uid))))))))));
CREATE POLICY "Admins can insert global settings" ON public.global_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can read all global settings" ON public.global_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can update global settings" ON public.global_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Service role can read all global settings" ON public.global_settings AS PERMISSIVE FOR SELECT TO service_role
  USING (true);
CREATE POLICY delete_kiosk_text_overrides ON public.kiosk_text_overrides AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = kiosk_text_overrides.event_id) AND ((events.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
           FROM public.event_access
          WHERE ((event_access.event_id = events.id) AND (event_access.user_id = auth.uid())))))))));
CREATE POLICY insert_kiosk_text_overrides ON public.kiosk_text_overrides AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = kiosk_text_overrides.event_id) AND ((events.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
           FROM public.event_access
          WHERE ((event_access.event_id = events.id) AND (event_access.user_id = auth.uid())))))))));
CREATE POLICY select_kiosk_text_overrides ON public.kiosk_text_overrides AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = kiosk_text_overrides.event_id) AND ((events.user_id = auth.uid()) OR true)))));
CREATE POLICY update_kiosk_text_overrides ON public.kiosk_text_overrides AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = kiosk_text_overrides.event_id) AND ((events.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
           FROM public.event_access
          WHERE ((event_access.event_id = events.id) AND (event_access.user_id = auth.uid())))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = kiosk_text_overrides.event_id) AND ((events.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
           FROM public.event_access
          WHERE ((event_access.event_id = events.id) AND (event_access.user_id = auth.uid())))))))));
CREATE POLICY "Admins can read library submissions" ON public.library_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY "Service role can insert library submissions" ON public.library_submissions AS PERMISSIVE FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY anon_select_prompt_categories ON public.prompt_categories AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY auth_delete_prompt_categories ON public.prompt_categories AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY auth_insert_prompt_categories ON public.prompt_categories AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY auth_update_prompt_categories ON public.prompt_categories AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY delete_prompt_translations ON public.prompt_translations AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.prompts
  WHERE ((prompts.id = prompt_translations.prompt_id) AND ((prompts.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (public.event_prompts ep
             JOIN public.events e ON ((e.id = ep.event_id)))
          WHERE ((ep.prompt_id = prompts.id) AND ((e.user_id = auth.uid()) OR (EXISTS ( SELECT 1
                   FROM public.user_profiles
                  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
                   FROM public.event_access
                  WHERE ((event_access.event_id = e.id) AND (event_access.user_id = auth.uid())))))))))))));
CREATE POLICY insert_prompt_translations ON public.prompt_translations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.prompts
  WHERE ((prompts.id = prompt_translations.prompt_id) AND ((prompts.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (public.event_prompts ep
             JOIN public.events e ON ((e.id = ep.event_id)))
          WHERE ((ep.prompt_id = prompts.id) AND ((e.user_id = auth.uid()) OR (EXISTS ( SELECT 1
                   FROM public.user_profiles
                  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
                   FROM public.event_access
                  WHERE ((event_access.event_id = e.id) AND (event_access.user_id = auth.uid())))))))))))));
CREATE POLICY select_prompt_translations ON public.prompt_translations AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.prompts
  WHERE ((prompts.id = prompt_translations.prompt_id) AND ((prompts.user_id = auth.uid()) OR (prompts.user_id IS NULL))))));
CREATE POLICY update_prompt_translations ON public.prompt_translations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.prompts
  WHERE ((prompts.id = prompt_translations.prompt_id) AND ((prompts.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (public.event_prompts ep
             JOIN public.events e ON ((e.id = ep.event_id)))
          WHERE ((ep.prompt_id = prompts.id) AND ((e.user_id = auth.uid()) OR (EXISTS ( SELECT 1
                   FROM public.user_profiles
                  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
                   FROM public.event_access
                  WHERE ((event_access.event_id = e.id) AND (event_access.user_id = auth.uid())))))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.prompts
  WHERE ((prompts.id = prompt_translations.prompt_id) AND ((prompts.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (public.event_prompts ep
             JOIN public.events e ON ((e.id = ep.event_id)))
          WHERE ((ep.prompt_id = prompts.id) AND ((e.user_id = auth.uid()) OR (EXISTS ( SELECT 1
                   FROM public.user_profiles
                  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
                   FROM public.event_access
                  WHERE ((event_access.event_id = e.id) AND (event_access.user_id = auth.uid())))))))))))));
CREATE POLICY "Allow all for authenticated users" ON public.prompts AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Anon can update public prompts" ON public.prompts AS PERMISSIVE FOR UPDATE TO anon
  USING ((user_id IS NULL))
  WITH CHECK ((user_id IS NULL));
CREATE POLICY "Anon can view public or event-linked active prompts" ON public.prompts AS PERMISSIVE FOR SELECT TO anon
  USING ((((is_public = true) AND (is_active = true)) OR (EXISTS ( SELECT 1
   FROM (public.event_prompts ep
     JOIN public.events e ON ((e.id = ep.event_id)))
  WHERE ((ep.prompt_id = prompts.id) AND (e.is_active = true))))));
CREATE POLICY "Anonymous can view public prompts or prompts in active events" ON public.prompts AS PERMISSIVE FOR SELECT TO anon
  USING (((is_active = true) AND ((is_public = true) OR (EXISTS ( SELECT 1
   FROM (public.event_prompts ep
     JOIN public.events e ON ((e.id = ep.event_id)))
  WHERE ((ep.prompt_id = prompts.id) AND (e.is_active = true)))))));
CREATE POLICY "Only owners can delete their prompts" ON public.prompts AS PERMISSIVE FOR DELETE TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()));
CREATE POLICY "Only owners can edit their prompts" ON public.prompts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id = auth.uid()) OR (user_id IS NULL) OR public.is_current_user_admin()))
  WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL) OR public.is_current_user_admin()));
CREATE POLICY "Users can create their own prompts" ON public.prompts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can insert their own or public prompts" ON public.prompts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() IS NOT NULL) AND (((is_public = false) AND (auth.uid() = user_id)) OR (is_public = true))));
CREATE POLICY "Users can update their own prompts" ON public.prompts AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own, public, event-linked, or all if admin" ON public.prompts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (is_public = true) OR (EXISTS ( SELECT 1
   FROM (public.event_prompts ep
     JOIN public.events e ON ((e.id = ep.event_id)))
  WHERE ((ep.prompt_id = prompts.id) AND (e.is_active = true)))) OR public.is_current_user_admin()));
CREATE POLICY "Users can view their own or public prompts" ON public.prompts AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (is_public = true)));
CREATE POLICY "Users can view their purchased passes, admins can view all" ON public.purchased_event_passes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "System can update SMS logs for valid images" ON public.sms_logs AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM public.generated_images
  WHERE (generated_images.id = sms_logs.image_id))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.generated_images
  WHERE (generated_images.id = sms_logs.image_id))));
CREATE POLICY "Users can insert sms logs" ON public.sms_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));
CREATE POLICY "Users can read own sms logs" ON public.sms_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Admins can update upload queue" ON public.smugmug_upload_queue AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.user_is_admin())
  WITH CHECK (public.user_is_admin());
CREATE POLICY "Admins can view upload queue" ON public.smugmug_upload_queue AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.user_is_admin());
CREATE POLICY "Authenticated users can queue uploads" ON public.smugmug_upload_queue AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = smugmug_upload_queue.event_id) AND ((e.created_by = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin))))));
CREATE POLICY anon_delete_sticker_batch_runs ON public.sticker_batch_runs AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (true);
CREATE POLICY anon_insert_sticker_batch_runs ON public.sticker_batch_runs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY anon_select_sticker_batch_runs ON public.sticker_batch_runs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY anon_update_sticker_batch_runs ON public.sticker_batch_runs AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY sticker_designs_delete ON public.sticker_designs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_designs.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_designs_insert ON public.sticker_designs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_designs.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))) AND ((variant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (public.sticker_prompt_variants v
     JOIN public.sticker_people p ON ((p.id = sticker_designs.person_id)))
  WHERE ((v.id = sticker_designs.variant_id) AND (v.job_id = p.job_id)))))));
CREATE POLICY sticker_designs_select ON public.sticker_designs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_designs.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_designs_update ON public.sticker_designs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_designs.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_designs.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))) AND ((variant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (public.sticker_prompt_variants v
     JOIN public.sticker_people p ON ((p.id = sticker_designs.person_id)))
  WHERE ((v.id = sticker_designs.variant_id) AND (v.job_id = p.job_id)))))));
CREATE POLICY sticker_jobs_delete ON public.sticker_jobs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY sticker_jobs_insert ON public.sticker_jobs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY sticker_jobs_select ON public.sticker_jobs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY sticker_jobs_update ON public.sticker_jobs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((owner_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY sticker_people_delete ON public.sticker_people AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_people.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_people_insert ON public.sticker_people AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_people.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_people_select ON public.sticker_people AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_people.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_people_update ON public.sticker_people AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_people.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_people.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_prompt_variants_delete ON public.sticker_prompt_variants AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_prompt_variants.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_prompt_variants_insert ON public.sticker_prompt_variants AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_prompt_variants.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_prompt_variants_select ON public.sticker_prompt_variants AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_prompt_variants.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_prompt_variants_update ON public.sticker_prompt_variants AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_prompt_variants.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sticker_jobs j
  WHERE ((j.id = sticker_prompt_variants.job_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_sheets_delete ON public.sticker_sheets AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_sheets.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_sheets_insert ON public.sticker_sheets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_sheets.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_sheets_select ON public.sticker_sheets AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_sheets.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY sticker_sheets_update ON public.sticker_sheets AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_sheets.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.sticker_people p
     JOIN public.sticker_jobs j ON ((j.id = p.job_id)))
  WHERE ((p.id = sticker_sheets.person_id) AND (j.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Users can view their own customer data" ON public.stripe_customers AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL)));
CREATE POLICY "Users can view their own order data" ON public.stripe_orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (((customer_id IN ( SELECT stripe_customers.customer_id
   FROM public.stripe_customers
  WHERE ((stripe_customers.user_id = ( SELECT auth.uid() AS uid)) AND (stripe_customers.deleted_at IS NULL)))) AND (deleted_at IS NULL)));
CREATE POLICY "Users can view their own subscription data" ON public.stripe_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((customer_id IN ( SELECT stripe_customers.customer_id
   FROM public.stripe_customers
  WHERE ((stripe_customers.user_id = ( SELECT auth.uid() AS uid)) AND (stripe_customers.deleted_at IS NULL)))) AND (deleted_at IS NULL)));
CREATE POLICY "Users can view active tiers, admins can view all" ON public.subscription_tiers AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Admins can delete subscription tiers" ON public.subscription_tiers_new AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_current_user_admin());
CREATE POLICY "Admins can insert subscription tiers" ON public.subscription_tiers_new AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update subscription tiers" ON public.subscription_tiers_new AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Users can view active tiers, admins can view all" ON public.subscription_tiers_new AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Users can insert usage logs" ON public.usage_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));
CREATE POLICY "Users can read own usage logs" ON public.usage_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can read own add-on purchases" ON public.user_add_on_purchases AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "System can create credits" ON public.user_credits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can update credits" ON public.user_credits AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can view credits" ON public.user_credits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can read own event passes" ON public.user_event_passes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Auth system can create profiles" ON public.user_profiles AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can update profiles" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)))
  WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can view profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.user_is_admin() AS user_is_admin)));
CREATE POLICY "Users can delete own settings" ON public.user_settings AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can insert own settings" ON public.user_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can read own settings" ON public.user_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can update own settings" ON public.user_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view their subscriptions, admins can view all" ON public.user_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Admins can view all webhook events" ON public.webhook_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY "Allow booth image uploads for all users" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'temp-booth-images'::text));
CREATE POLICY "Allow event-photo uploads for all users" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'event-photos'::text));
CREATE POLICY "Allow generated image uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'generated_images'::text));
CREATE POLICY "Authenticated users can delete generated images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'generated_images'::text));
CREATE POLICY "Authenticated users can delete prompt images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'prompt-images'::text));
CREATE POLICY "Authenticated users can update prompt images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((bucket_id = 'prompt-images'::text))
  WITH CHECK ((bucket_id = 'prompt-images'::text));
CREATE POLICY "Authenticated users can upload prompt images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'prompt-images'::text));
CREATE POLICY "Public can read booth images by name" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'temp-booth-images'::text) AND (name IS NOT NULL) AND (name <> ''::text)));
CREATE POLICY "Public can read generated images" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'generated_images'::text));
CREATE POLICY "Public can read profile pictures by name" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'profile-pictures'::text) AND (name IS NOT NULL) AND (name <> ''::text)));
CREATE POLICY "Public can read prompt images by name" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'prompt-images'::text) AND (name IS NOT NULL) AND (name <> ''::text)));
CREATE POLICY "Public read access for event-photos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'event-photos'::text));
CREATE POLICY "Users can delete own profile picture" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete their own booth images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'temp-booth-images'::text) AND (owner_id = (auth.uid())::text)));
CREATE POLICY "Users can update own profile picture" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can upload own profile picture" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY anon_delete_event_photos_bucket ON storage.objects AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((bucket_id = 'event-photos'::text));
CREATE POLICY anon_insert_led_display_assets ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'led-display-assets'::text));
CREATE POLICY anon_read_led_display_assets ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((bucket_id = 'led-display-assets'::text));
CREATE POLICY anon_update_led_display_assets ON storage.objects AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((bucket_id = 'led-display-assets'::text))
  WITH CHECK ((bucket_id = 'led-display-assets'::text));
CREATE POLICY batch_results_authenticated_delete ON storage.objects AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((bucket_id = 'batch-results'::text));
CREATE POLICY batch_results_authenticated_upload ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'batch-results'::text));
CREATE POLICY batch_results_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((bucket_id = 'batch-results'::text));
CREATE POLICY sticker_studio_objects_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'sticker-studio'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['sources'::text, 'designs'::text, 'sheets'::text])) AND ((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY sticker_studio_objects_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'sticker-studio'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['sources'::text, 'designs'::text, 'sheets'::text])) AND ((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY sticker_studio_objects_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'sticker-studio'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['sources'::text, 'designs'::text, 'sheets'::text])) AND ((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY sticker_studio_objects_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'sticker-studio'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['sources'::text, 'designs'::text, 'sheets'::text])) AND ((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid))))
  WITH CHECK (((bucket_id = 'sticker-studio'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['sources'::text, 'designs'::text, 'sheets'::text])) AND ((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid))));

-- ======================================================================
-- Table/view/sequence privileges: reset
-- ======================================================================

REVOKE ALL ON TABLE public.add_ons FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.admin_all_users FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.batch_job_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.batch_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_ledger FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_topup_products FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_transactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.disclaimer_acknowledgments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_access FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_access_codes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_device_usage FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_error_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_pass_addons FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_passes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_photos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_prompts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.generated_images FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.global_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.kiosk_text_overrides FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.library_submissions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.prompt_categories FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.prompt_translations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.prompts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.public_global_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.purchased_event_passes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sms_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.smugmug_upload_queue FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_batch_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_designs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_people FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_prompt_variants FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.sticker_sheets FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.stripe_customers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.stripe_customers_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.stripe_orders FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.stripe_orders_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.stripe_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.stripe_subscriptions_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.stripe_user_orders FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.stripe_user_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.subscription_tiers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.subscription_tiers_new FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.usage_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_add_on_purchases FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_credits FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_event_passes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.webhook_events FROM PUBLIC, anon, authenticated, service_role;

-- ======================================================================
-- Table/view/sequence privileges: grants
-- ======================================================================

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.add_ons TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.add_ons TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.add_ons TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_all_users TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_all_users TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_all_users TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_job_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_job_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_job_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_jobs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_jobs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.batch_jobs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_ledger TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_ledger TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_ledger TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_topup_products TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_topup_products TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_topup_products TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.disclaimer_acknowledgments TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.disclaimer_acknowledgments TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.disclaimer_acknowledgments TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access_codes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access_codes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_access_codes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_device_usage TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_device_usage TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_device_usage TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_error_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_error_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_error_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_pass_addons TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_pass_addons TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_pass_addons TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_passes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_passes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_passes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_photos TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_photos TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_photos TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_prompts TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_prompts TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_prompts TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO service_role;
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.generated_images TO anon;
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.generated_images TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.generated_images TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.global_settings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.global_settings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.global_settings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.kiosk_text_overrides TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.kiosk_text_overrides TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.kiosk_text_overrides TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.library_submissions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.library_submissions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.library_submissions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_categories TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_categories TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_categories TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_translations TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_translations TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompt_translations TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompts TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompts TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prompts TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.public_global_settings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.public_global_settings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.public_global_settings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.purchased_event_passes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.purchased_event_passes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.purchased_event_passes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sms_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sms_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sms_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.smugmug_upload_queue TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.smugmug_upload_queue TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.smugmug_upload_queue TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_batch_runs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_batch_runs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_batch_runs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_designs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_designs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_jobs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_jobs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_people TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_people TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_prompt_variants TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_prompt_variants TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_sheets TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sticker_sheets TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_customers TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_customers TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_customers TO service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_customers_id_seq TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_customers_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_customers_id_seq TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_orders TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_orders TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_orders TO service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_orders_id_seq TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_orders_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_orders_id_seq TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_subscriptions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_subscriptions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_subscriptions TO service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_subscriptions_id_seq TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_subscriptions_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.stripe_subscriptions_id_seq TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_orders TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_orders TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_orders TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_subscriptions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_subscriptions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stripe_user_subscriptions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers_new TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers_new TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.subscription_tiers_new TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.usage_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.usage_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.usage_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_add_on_purchases TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_add_on_purchases TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_add_on_purchases TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_credits TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_credits TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_credits TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_event_passes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_event_passes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_event_passes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_settings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_settings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_settings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_subscriptions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_subscriptions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_subscriptions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.webhook_events TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.webhook_events TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.webhook_events TO service_role;

-- ======================================================================
-- Function privileges: reset
-- ======================================================================

REVOKE ALL ON FUNCTION public.activate_pass(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_event_pass_credits(uuid,integer,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_event_pass_sms_credits(uuid,integer,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_purchased_credits(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_purchased_credits(uuid,integer,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_purchased_sms_credits(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_purchased_sms_credits(uuid,integer,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_create_concurrent_event(uuid,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_create_event(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_modify_event_start_time(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_pass_validity(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cleanup_old_device_usage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.clear_event_documentation_stats(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_credit(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_sms_credit(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.count_user_active_events(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.deactivate_expired_pass_events() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.duplicate_prompt(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_available_passes(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_gemini_settings() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_pass_expiration(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_total_credits(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_total_sms_credits(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_concurrent_event_limit(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_credit_balance(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_event_credits(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_image_credits(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_subscription_info(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_subscription_type(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_tenant_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_activated_event_pass(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_image_usage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_image_usage(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_sms_usage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_sms_usage(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_user_image_usage(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_user_sms_usage(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_event_active_and_valid(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_pass_active(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_prompt_owner(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_start_time_change_with_activated_pass() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_event_analytics_reset_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_generated_image(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.transfer_event_ownership(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_global_settings_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_user_settings_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_webhook_events_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_has_role(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_is_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_event_time_restrictions(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ======================================================================
-- Function privileges: grants
-- ======================================================================

GRANT EXECUTE ON FUNCTION public.activate_pass(uuid,uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_pass(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pass(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_event_pass_credits(uuid,integer,uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_event_pass_credits(uuid,integer,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_event_pass_sms_credits(uuid,integer,uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_event_pass_sms_credits(uuid,integer,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid,integer,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid,integer,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_create_concurrent_event(uuid,uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_concurrent_event(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_concurrent_event(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_create_event(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_modify_event_start_time(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_modify_event_start_time(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_modify_event_start_time(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_pass_validity(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pass_validity(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_pass_validity(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_device_usage() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_device_usage() TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_device_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_device_usage() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_event_documentation_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_event_documentation_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_credit(uuid,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_credit(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_user_active_events(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_user_active_events(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_active_events(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_pass_events() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_pass_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_prompt(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_prompt(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_prompt(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_available_passes(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_passes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_passes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gemini_settings() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gemini_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gemini_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pass_expiration(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pass_expiration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pass_expiration(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_credits(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_sms_credits(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_sms_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_sms_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_concurrent_event_limit(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_concurrent_event_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_concurrent_event_limit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_event_credits(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_event_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_event_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_image_credits(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_image_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_image_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_info(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_info(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_type(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_type(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_type(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_activated_event_pass(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_activated_event_pass(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_activated_event_pass(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_image_usage() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_image_usage() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_image_usage(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_sms_usage() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_sms_usage() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_sms_usage(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_sms_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_image_usage(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_sms_usage(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_sms_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_event_active_and_valid(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_active_and_valid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_active_and_valid(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_pass_active(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pass_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pass_active(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_prompt_owner(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_prompt_owner(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_prompt_owner(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_start_time_change_with_activated_pass() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_start_time_change_with_activated_pass() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_event_analytics_reset_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_event_analytics_reset_at() TO anon;
GRANT EXECUTE ON FUNCTION public.protect_event_analytics_reset_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_event_analytics_reset_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.save_generated_image(uuid,uuid,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.save_generated_image(uuid,uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_generated_image(uuid,uuid,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_event_ownership(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_event_ownership(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_global_settings_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_global_settings_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_settings_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_settings_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_settings_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_settings_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_webhook_events_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_webhook_events_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_event_time_restrictions(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_event_time_restrictions(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_event_time_restrictions(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid) TO service_role;

-- ======================================================================
-- Comments
-- ======================================================================

COMMENT ON COLUMN public.events.analytics_reset_at IS 'Documentation baseline for this event only. Analytics count generations created after this time. NULL counts every generation. Photos, displays, and billing are not affected.';
COMMENT ON COLUMN public.events.gemini_model IS 'NULL = use global_settings.gemini_model';
COMMENT ON COLUMN public.prompts.gemini_file_expires_at IS 'Expiration time for the Gemini File API URI (typically 48 hours from upload)';
COMMENT ON COLUMN public.prompts.gemini_file_uploaded_at IS 'Timestamp when the reference image was uploaded to Gemini File API';
COMMENT ON COLUMN public.prompts.gemini_file_uri IS 'Cached Gemini File API URI for the reference image';
COMMENT ON COLUMN public.prompts.gemini_model IS 'NULL = use event-level or account-level model';
COMMENT ON COLUMN public.prompts.reference_images IS 'JSON array of {url, strength} objects for multiple AI style reference images. Takes priority over reference_image_url when populated.';
COMMENT ON COLUMN public.prompts.reference_strength IS 'Default strength (0-100) for reference images that do not specify their own strength value.';
COMMENT ON COLUMN public.prompts.source_prompt_id IS 'References the original prompt if this is a duplicate';
COMMENT ON COLUMN public.prompts.tags IS 'Array of tags for categorizing and filtering prompts (e.g., holiday, professional, fun, vintage)';
COMMENT ON COLUMN public.sticker_jobs.badge_render_mode IS 'Badge rendering mode: overlay, baked, or none.';
COMMENT ON COLUMN public.user_subscriptions.cancel_at_period_end IS 'Flag indicating if the subscription is scheduled to cancel at the end of the current period';
COMMENT ON FUNCTION public.can_modify_event_start_time(uuid,uuid) IS 'Validates if a user can modify an event start time. Returns false if event has an activated pass (except for admins).';
COMMENT ON FUNCTION public.clear_event_documentation_stats(uuid) IS 'Admin-only. Sets analytics_reset_at on one event so documented stats ignore earlier generations. Does not delete rows or change credits.';
COMMENT ON FUNCTION public.duplicate_prompt(uuid,uuid) IS 'Duplicates a public prompt, creating a new prompt owned by the calling user';
COMMENT ON FUNCTION public.get_gemini_settings() IS 'Securely retrieves Gemini API configuration for edge functions. SECURITY DEFINER bypasses RLS.';
COMMENT ON FUNCTION public.has_activated_event_pass(uuid) IS 'Checks if an event has an activated event pass. Used to determine if start time can be modified.';
COMMENT ON FUNCTION public.is_admin(uuid) IS 'True if the given user_profiles.id has role admin. Used by prevent_start_time_change_with_activated_pass and can_modify_event_start_time.';
COMMENT ON FUNCTION public.protect_event_analytics_reset_at() IS 'Rejects changes to events.analytics_reset_at unless the session user is an admin.';
COMMENT ON FUNCTION public.validate_event_time_restrictions(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid) IS 'Validates event creation restrictions based on user subscription type. Admins bypass all checks.';

-- ======================================================================
-- Storage buckets
-- ======================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('batch-results', 'batch-results', 't', NULL, '{image/png,image/jpeg,image/webp,application/zip}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('event-photos', 'event-photos', 't', '10485760', '{image/jpeg,image/png,image/webp}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('generated_images', 'generated_images', 't', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('led-display-assets', 'led-display-assets', 't', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('profile-pictures', 'profile-pictures', 't', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('prompt-images', 'prompt-images', 't', '5242880', '{image/jpeg,image/jpg,image/png,image/webp,image/gif}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('sticker-studio', 'sticker-studio', 'f', '52428800', '{image/png,image/jpeg,image/webp}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('temp-booth-images', 'temp-booth-images', 't', '10485760', '{image/jpeg,image/png,image/webp}') ON CONFLICT (id) DO NOTHING;

RESET check_function_bodies;
