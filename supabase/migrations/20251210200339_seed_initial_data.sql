/*
  # Seed Initial Data

  ## Overview
  Populate database with demo tenant, global prompts, and sample configuration.
  This allows the application to work immediately without requiring full setup.

  ## Data Seeded
  1. Demo Tenant - "Acme Event Agency" with PRO tier
  2. Subscription Limits - For the demo tenant
  3. Global Prompts - Available to all tenants
  4. Sample Events - For demonstration

  ## Notes
  - Global prompts (tenant_id = NULL) are accessible by all kiosk users
  - Demo tenant can be used for testing
  - Real production usage should create proper tenants via signup flow
*/

-- =====================================================
-- 1. CREATE DEMO TENANT
-- =====================================================

INSERT INTO tenants (id, name, tier, white_label_enabled, primary_color, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Acme Event Agency',
  'PRO',
  true,
  '#3b82f6',
  true,
  now()
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. SET UP SUBSCRIPTION LIMITS
-- =====================================================

INSERT INTO subscription_limits (
  tenant_id,
  images_limit,
  images_used,
  sms_limit,
  sms_used,
  events_limit,
  reset_date
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  5000,
  1240,
  5000,
  890,
  20,
  date_trunc('month', now()) + interval '1 month'
) ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
-- 3. CREATE GLOBAL PROMPTS (Available to all)
-- =====================================================

INSERT INTO prompts (id, tenant_id, name, description, category, prompt_text, preview_image_url, is_active, usage_count)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Cyberpunk City',
    'Neon lights and futuristic armor in a dystopian cityscape',
    'Sci-Fi',
    'Transform this photo into a futuristic cyberpunk character with neon glowing armor, standing in a rain-slicked Tokyo street at night. Add cinematic lighting, dramatic bokeh, and vibrant purple and blue neon signs in the background. High detail, photorealistic.',
    'https://images.unsplash.com/photo-1618609378039-b572f64c5b42?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    NULL,
    'Renaissance Oil',
    'Classic oil painting style portrait',
    'Artistic',
    'Transform this photo into an 18th-century oil painting of a noble, wearing velvet and gold regalia. Apply dramatic chiaroscuro lighting technique, rich warm tones, museum quality brushwork. Style of Rembrandt and Caravaggio.',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    NULL,
    'Retro 80s',
    'Synthwave aesthetic with vibrant gradients',
    'Retro',
    'Transform this photo into a retro 1980s synthwave style portrait with a sunset gradient background, laser grid floor, cool reflective sunglasses. Add digital noise, VHS scan lines, and vibrant pink and purple color grading. Outrun aesthetic.',
    'https://images.unsplash.com/photo-1614853035111-7ae3f0af6813?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    NULL,
    'Pixar Style',
    '3D animated character with expressive features',
    'Fun',
    'Transform this photo into a cute 3D rendered character in the style of Pixar animation. Apply soft studio lighting, expressive cartoon features, vibrant saturated colors, smooth rendering. Make it charming and family-friendly.',
    'https://images.unsplash.com/photo-1620471195992-1b9e0273f236?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    NULL,
    'Fantasy Warrior',
    'Epic fantasy character with armor and magic',
    'Fantasy',
    'Transform this photo into an epic fantasy warrior character with ornate medieval armor, glowing magical runes, dramatic pose. Set in a mystical forest with god rays streaming through ancient trees. Cinematic lighting, high fantasy art style.',
    'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    NULL,
    'Pop Art',
    'Bold colors and comic book style',
    'Artistic',
    'Transform this photo into vibrant pop art style with bold outlined shapes, Ben-Day dots, comic book halftone effect. Use bright primary colors (red, yellow, blue), high contrast. Style of Roy Lichtenstein and Andy Warhol.',
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    NULL,
    'Noir Detective',
    'Black and white film noir atmosphere',
    'Cinematic',
    'Transform this photo into a 1940s film noir detective scene. Black and white with high contrast, dramatic shadows, cigarette smoke, venetian blind light patterns. Mysterious and moody atmosphere. Classic Hollywood cinematography.',
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop',
    true,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    NULL,
    'Space Explorer',
    'Sci-fi astronaut with cosmic background',
    'Sci-Fi',
    'Transform this photo into a futuristic space explorer with sleek astronaut suit, reflective helmet visor showing nebula reflections. Set against a cosmic background with stars, distant planets, and colorful nebulas. Epic space opera aesthetic.',
    'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400&h=400&fit=crop',
    true,
    0
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. CREATE SAMPLE EVENTS (Requires auth user to exist)
-- =====================================================

-- Note: Sample events will be created when a user signs up
-- These are commented out as they require valid user references

/*
INSERT INTO events (id, tenant_id, name, city, event_date, passcode, is_active, total_generations)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'TechCrunch Disrupt Afterparty',
    'San Francisco',
    '2024-12-15',
    '1234',
    true,
    0
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Sarah & Tom Wedding',
    'Austin',
    '2024-12-20',
    'LOVE',
    false,
    0
  )
ON CONFLICT (id) DO NOTHING;
*/