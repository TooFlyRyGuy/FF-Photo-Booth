# Lumina AI Photo Booth - Database Documentation

## Overview

Production-ready PostgreSQL database hosted on Supabase for a multi-tenant SaaS AI photo booth platform. The database supports event management, AI prompt configuration, image generation tracking, SMS delivery, and comprehensive usage analytics.

## Architecture

### Multi-Tenant Design
- Strict tenant isolation via Row Level Security (RLS)
- All data scoped to tenant organizations
- Global resources (prompts) available across tenants
- Secure kiosk mode with public access controls

### Security Features
- Row Level Security (RLS) enabled on all tables
- Helper functions for tenant validation
- Role-based access control (OWNER, ADMIN, OPERATOR)
- Public kiosk access via event passcode validation
- Automatic usage tracking and audit trails

## Database Schema

### 1. `tenants`
Organization accounts using the platform (agencies, event companies, etc.)

**Columns:**
- `id` (uuid, PK) - Unique tenant identifier
- `name` (text) - Organization name
- `tier` (text) - Subscription tier: STARTER | PRO | ENTERPRISE
- `white_label_enabled` (boolean) - Custom branding feature
- `branding_logo_url` (text, nullable) - Custom logo URL
- `primary_color` (text, nullable) - Brand color (hex)
- `is_active` (boolean) - Account status
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**RLS Policies:**
- Users can view their own tenant
- Owners can update their tenant settings

**Sample Data:**
```sql
-- Demo tenant created during seed
id: '00000000-0000-0000-0000-000000000001'
name: 'Acme Event Agency'
tier: 'PRO'
```

### 2. `users`
Admin and operator users with role-based permissions

**Columns:**
- `id` (uuid, PK) - References auth.users(id)
- `tenant_id` (uuid, FK) - Associated tenant
- `email` (text, unique) - User email
- `full_name` (text) - Display name
- `role` (text) - OWNER | ADMIN | OPERATOR
- `is_active` (boolean) - User status
- `last_login_at` (timestamptz, nullable) - Last login time
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**RLS Policies:**
- Users can view users in their tenant
- Admins can create/update users in their tenant
- Owners can delete users in their tenant

**Relationships:**
- `tenant_id` → `tenants.id`
- `id` → `auth.users.id` (Supabase Auth)

### 3. `subscription_limits`
Subscription tier limits and usage tracking

**Columns:**
- `id` (uuid, PK) - Unique identifier
- `tenant_id` (uuid, FK, unique) - Associated tenant
- `images_limit` (integer) - Monthly generation limit
- `images_used` (integer) - Current month usage
- `sms_limit` (integer) - Monthly SMS limit
- `sms_used` (integer) - Current SMS usage
- `events_limit` (integer) - Active events limit
- `reset_date` (timestamptz) - Next billing cycle reset
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**RLS Policies:**
- Users can view their tenant limits
- System can update usage counters

**Automatic Updates:**
- `images_used` incremented via trigger on image generation
- `sms_used` incremented via trigger on SMS delivery
- `reset_date` defines monthly billing cycle

### 4. `prompts`
AI style prompts for photo generation

**Columns:**
- `id` (uuid, PK) - Unique prompt identifier
- `tenant_id` (uuid, FK, nullable) - Owner (null = global prompt)
- `name` (text) - Prompt display name
- `description` (text) - Prompt description
- `category` (text) - Category (Sci-Fi, Artistic, Fun, etc.)
- `prompt_text` (text) - AI generation instruction
- `preview_image_url` (text) - Kiosk thumbnail
- `reference_image_url` (text, nullable) - AI style reference
- `is_active` (boolean) - Active status
- `usage_count` (integer) - Times used counter
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**RLS Policies:**
- Public can view global prompts (tenant_id IS NULL)
- Users can view/manage their tenant prompts
- Admins can delete prompts

**Global Prompts (Seeded):**
1. Cyberpunk City (Sci-Fi)
2. Renaissance Oil (Artistic)
3. Retro 80s (Retro)
4. Pixar Style (Fun)
5. Fantasy Warrior (Fantasy)
6. Pop Art (Artistic)
7. Noir Detective (Cinematic)
8. Space Explorer (Sci-Fi)

### 5. `events`
Event configurations and settings

**Columns:**
- `id` (uuid, PK) - Unique event identifier
- `tenant_id` (uuid, FK) - Associated tenant
- `name` (text) - Event name
- `city` (text) - Event location
- `event_date` (date) - Event date
- `passcode` (text) - Kiosk access code
- `is_active` (boolean) - Active status
- `total_generations` (integer) - Total images generated
- `created_by` (uuid, FK, nullable) - Creator user
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp

**RLS Policies:**
- Users can manage events in their tenant
- Public can view active events (for kiosk passcode lookup)

**Relationships:**
- `tenant_id` → `tenants.id`
- `created_by` → `users.id`

**Kiosk Access:**
Events are accessed in kiosk mode by entering the passcode. The app validates against `passcode` field and `is_active` status.

### 6. `event_prompts`
Junction table linking events to available prompts

**Columns:**
- `id` (uuid, PK) - Unique identifier
- `event_id` (uuid, FK) - Associated event
- `prompt_id` (uuid, FK) - Associated prompt
- `display_order` (integer) - Sort order in kiosk
- `created_at` (timestamptz) - Creation timestamp

**Unique Constraint:**
- `(event_id, prompt_id)` - Prevent duplicate assignments

**RLS Policies:**
- Users can manage prompts for their tenant events
- Public can view event prompts (for kiosk)

### 7. `generated_images`
Track all AI-generated photos

**Columns:**
- `id` (uuid, PK) - Unique image identifier
- `event_id` (uuid, FK) - Associated event
- `prompt_id` (uuid, FK) - Prompt used
- `tenant_id` (uuid, FK) - Associated tenant
- `original_image_url` (text) - User photo (base64 or URL)
- `generated_image_url` (text, nullable) - AI result URL
- `status` (text) - processing | completed | failed
- `error_message` (text, nullable) - Error details
- `phone_number` (text, nullable) - Delivery phone (hashed)
- `generation_time_ms` (integer, nullable) - Processing time
- `created_at` (timestamptz) - Creation timestamp
- `completed_at` (timestamptz, nullable) - Completion time

**RLS Policies:**
- Users can view tenant generated images
- Public can create images (kiosk mode)
- System can update images (async processing)

**Automatic Tracking:**
- Trigger increments `subscription_limits.images_used`
- Trigger increments `events.total_generations`
- Trigger increments `prompts.usage_count`

### 8. `sms_logs`
SMS delivery tracking and audit trail

**Columns:**
- `id` (uuid, PK) - Unique log identifier
- `image_id` (uuid, FK) - Associated image
- `tenant_id` (uuid, FK) - Associated tenant
- `phone_number` (text) - Recipient (hashed for privacy)
- `message_sid` (text, nullable) - Twilio message ID
- `status` (text) - queued | sent | delivered | failed
- `error_message` (text, nullable) - Error details
- `sent_at` (timestamptz) - Send timestamp
- `delivered_at` (timestamptz, nullable) - Delivery timestamp

**RLS Policies:**
- Users can view tenant SMS logs
- Public can create SMS logs (kiosk)
- System can update delivery status

**Automatic Tracking:**
- Trigger increments `subscription_limits.sms_used`

### 9. `usage_logs`
Detailed usage analytics and audit trail

**Columns:**
- `id` (uuid, PK) - Unique log identifier
- `tenant_id` (uuid, FK) - Associated tenant
- `event_id` (uuid, FK, nullable) - Associated event
- `action_type` (text) - Action performed
- `metadata` (jsonb, nullable) - Additional structured data
- `created_at` (timestamptz) - Action timestamp

**RLS Policies:**
- Users can view tenant usage logs
- System can create usage logs

**Action Types:**
- `image_generated` - Photo generation completed
- `sms_sent` - SMS delivery initiated
- `event_created` - New event created
- `prompt_created` - Custom prompt created
- `kiosk_launched` - Kiosk mode activated

## Indexes

Performance indexes created for frequently queried fields:

**Users:**
- `idx_users_tenant_id` - ON users(tenant_id)
- `idx_users_email` - ON users(email)

**Events:**
- `idx_events_tenant_id` - ON events(tenant_id)
- `idx_events_is_active` - ON events(is_active)
- `idx_events_passcode` - ON events(passcode)
- `idx_events_event_date` - ON events(event_date)

**Prompts:**
- `idx_prompts_tenant_id` - ON prompts(tenant_id)
- `idx_prompts_is_active` - ON prompts(is_active)
- `idx_prompts_category` - ON prompts(category)

**Generated Images:**
- `idx_generated_images_event_id` - ON generated_images(event_id)
- `idx_generated_images_tenant_id` - ON generated_images(tenant_id)
- `idx_generated_images_status` - ON generated_images(status)
- `idx_generated_images_created_at` - ON generated_images(created_at DESC)

**SMS Logs:**
- `idx_sms_logs_image_id` - ON sms_logs(image_id)
- `idx_sms_logs_tenant_id` - ON sms_logs(tenant_id)
- `idx_sms_logs_status` - ON sms_logs(status)

**Usage Logs:**
- `idx_usage_logs_tenant_id` - ON usage_logs(tenant_id)
- `idx_usage_logs_event_id` - ON usage_logs(event_id)
- `idx_usage_logs_created_at` - ON usage_logs(created_at DESC)
- `idx_usage_logs_action_type` - ON usage_logs(action_type)

## Triggers

### Automatic Timestamp Updates
`update_updated_at_column()` - Updates `updated_at` on row changes for:
- tenants
- users
- subscription_limits
- prompts
- events

### Usage Tracking
`increment_image_usage()` - Runs after image generation:
- Increments `subscription_limits.images_used`
- Increments `events.total_generations`
- Increments `prompts.usage_count`

`increment_sms_usage()` - Runs after SMS log creation:
- Increments `subscription_limits.sms_used`

## Helper Functions

### `get_user_tenant_id()`
Returns the tenant_id for the currently authenticated user.

```sql
SELECT get_user_tenant_id();
```

### `user_has_role(role_name)`
Checks if current user has specific role.

```sql
SELECT user_has_role('OWNER'); -- Returns boolean
```

### `user_is_admin()`
Checks if current user is OWNER or ADMIN.

```sql
SELECT user_is_admin(); -- Returns boolean
```

## Data Flow

### Admin Dashboard Flow
1. User logs in via Supabase Auth
2. `users` table validates tenant membership
3. Dashboard loads tenant data, events, prompts
4. RLS ensures data isolation by tenant

### Kiosk Mode Flow
1. User enters event passcode
2. App queries `events` table (public access via RLS)
3. Loads associated prompts via `event_prompts`
4. User takes photo and selects style
5. AI generates image → saved to `generated_images`
6. Triggers update usage counters
7. Optional: SMS sent → logged in `sms_logs`

### Event Management Flow
1. Admin creates event with name, date, passcode
2. Selects prompts from library (global + tenant)
3. App creates `events` record
4. Creates junction records in `event_prompts`
5. Event becomes available in kiosk mode

## Migration History

### 1. `create_lumina_booth_schema.sql`
- Created all 9 core tables
- Defined foreign key relationships
- Created performance indexes
- Set up automatic triggers
- Configured default values

### 2. `setup_row_level_security_v2.sql`
- Enabled RLS on all tables
- Created helper functions
- Configured tenant isolation policies
- Enabled kiosk public access
- Set up role-based permissions

### 3. `seed_initial_data.sql`
- Created demo tenant (Acme Event Agency)
- Seeded 8 global AI prompts
- Configured subscription limits
- Set up initial usage tracking

## Connection Details

The application connects using environment variables:

```env
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

## Best Practices

### Data Safety
- Never use `DROP` or `DELETE` without proper backups
- Always test RLS policies thoroughly
- Use transactions for multi-step operations
- Regular automated backups recommended

### Performance
- Use proper indexes for all foreign keys
- Monitor slow queries with `pg_stat_statements`
- Consider partitioning for high-volume tables
- Use `EXPLAIN ANALYZE` for query optimization

### Security
- Never expose service role key in client code
- Validate all user input at application layer
- Use prepared statements to prevent SQL injection
- Regularly audit RLS policies
- Hash sensitive data (phone numbers, emails)

### Scaling
- Current schema supports millions of records
- Consider read replicas for reporting queries
- Use connection pooling (PgBouncer)
- Implement caching layer (Redis) for hot data
- Archive old records to separate tables

## Monitoring

### Key Metrics to Track
- `subscription_limits.images_used` vs `images_limit`
- `generated_images` count per event
- Average `generation_time_ms`
- SMS delivery success rate
- Active events count per tenant

### Query Examples

**Get tenant usage summary:**
```sql
SELECT
  t.name,
  sl.images_used,
  sl.images_limit,
  ROUND((sl.images_used::float / sl.images_limit) * 100, 2) as usage_percent
FROM tenants t
JOIN subscription_limits sl ON t.id = sl.tenant_id;
```

**Get event performance:**
```sql
SELECT
  e.name,
  e.total_generations,
  COUNT(gi.id) as verified_generations,
  AVG(gi.generation_time_ms) as avg_time_ms
FROM events e
LEFT JOIN generated_images gi ON e.id = gi.event_id
GROUP BY e.id, e.name, e.total_generations;
```

**Get popular prompts:**
```sql
SELECT
  name,
  category,
  usage_count,
  CASE WHEN tenant_id IS NULL THEN 'Global' ELSE 'Custom' END as type
FROM prompts
WHERE is_active = true
ORDER BY usage_count DESC
LIMIT 10;
```

## Support

For database issues:
- Check RLS policies with `SELECT * FROM pg_policies;`
- View active connections with `SELECT * FROM pg_stat_activity;`
- Check table sizes with `SELECT pg_size_pretty(pg_total_relation_size('table_name'));`

## Version

**Database Version:** 1.0.0
**Last Updated:** 2024-12-10
**PostgreSQL Version:** 15+
**Supabase Platform:** Latest
