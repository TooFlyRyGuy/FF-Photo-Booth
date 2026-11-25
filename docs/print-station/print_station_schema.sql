-- FF Print Station, booth side.
-- Additive only. Apply this whole file as one new migration.
-- Do not drop or rewrite existing columns, policies, or functions.
--
-- Matches FF-Print-Station supabase/proposed (branch cursor/ff-print-station-v1-dbf3),
-- plus the booth settings that proposal does not store:
--   events.print_enabled, print_paper_size, print_cut, print_delivery,
--   print_max_copies, print_event_limit
--   enqueue_print_job enforces those settings (same arguments as the station contract)
--   retry_print_job / cancel_print_job for the booth admin
--
-- The existing anon update policy on events is left as it is. A new trigger
-- blocks anyone except the event owner, an admin, or a user with event_access
-- from changing the new print columns. Stations pair to the booth account
-- (owner_user_id). The operator picks the event on the PC.

do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception
  when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------------------
-- Event print settings. Defaults keep printing off for every existing event.
-- ---------------------------------------------------------------------------

alter table public.events add column if not exists print_enabled boolean not null default false;
alter table public.events add column if not exists print_paper_size text not null default '4x6';
alter table public.events add column if not exists print_cut text not null default 'none';
alter table public.events add column if not exists print_delivery text not null default 'button';
alter table public.events add column if not exists print_max_copies integer not null default 1;
alter table public.events add column if not exists print_event_limit integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_print_paper_size_chk') then
    alter table public.events add constraint events_print_paper_size_chk
      check (print_paper_size in ('4x6', '6x4', '2x6', '5x7', '6x8', '6x6', '6x9'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_print_cut_chk') then
    alter table public.events add constraint events_print_cut_chk
      check (print_cut in ('none', '2inch'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_print_delivery_chk') then
    alter table public.events add constraint events_print_delivery_chk
      check (print_delivery in ('button', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_print_max_copies_chk') then
    alter table public.events add constraint events_print_max_copies_chk
      check (print_max_copies between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_print_event_limit_chk') then
    alter table public.events add constraint events_print_event_limit_chk
      check (print_event_limit is null or (print_event_limit between 1 and 100000));
  end if;
end
$$;

comment on column public.events.print_enabled is
  'Guest printing for this event. Off by default. The kiosk shows Print only when this is true.';
comment on column public.events.print_paper_size is
  'One size for the event. 2x6 means one copy is one strip.';
comment on column public.events.print_cut is
  'none, or 2inch when the size is 2x6. Glossy or matte stays on the printer.';
comment on column public.events.print_delivery is
  'button: guest taps Print. auto: enqueue one copy when the photo is ready.';
comment on column public.events.print_max_copies is
  'Most copies one guest photo can send, including repeats of that generated image.';
comment on column public.events.print_event_limit is
  'Optional cap on copies for the event. Null means no cap. Cancelled and failed jobs do not count.';

create or replace function public.prevent_anon_event_print_modification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.print_enabled is not distinct from old.print_enabled
     and new.print_paper_size is not distinct from old.print_paper_size
     and new.print_cut is not distinct from old.print_cut
     and new.print_delivery is not distinct from old.print_delivery
     and new.print_max_copies is not distinct from old.print_max_copies
     and new.print_event_limit is not distinct from old.print_event_limit then
    return new;
  end if;

  if coalesce(current_setting('role', true), 'none') not in ('anon', 'authenticated') then
    return new;
  end if;

  if v_uid is not null and (
    old.user_id = v_uid
    or public.is_admin(v_uid)
    or exists (
      select 1 from public.event_access ea
      where ea.event_id = old.id and ea.user_id = v_uid
    )
  ) then
    return new;
  end if;

  raise exception 'Only the event owner, a collaborator, or an admin can change print settings';
end;
$$;

drop trigger if exists trg_prevent_anon_event_print_modification on public.events;
create trigger trg_prevent_anon_event_print_modification
  before update on public.events
  for each row
  execute function public.prevent_anon_event_print_modification();

revoke all on function public.prevent_anon_event_print_modification() from public;
grant execute on function public.prevent_anon_event_print_modification() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Stations and jobs. A station belongs to the booth account, not one event.
-- ---------------------------------------------------------------------------

create table if not exists public.print_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_label text,
  organization_id uuid,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  pairing_code_hash text,
  pairing_code_expires_at timestamptz,
  paired_at timestamptz,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  paused boolean not null default false,
  last_seen_at timestamptz,
  printer_name text,
  printer_model text,
  status text not null default 'unpaired',
  status_detail text,
  prints_remaining integer,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint print_stations_status_chk check (
    status in ('unpaired', 'online', 'offline', 'printing', 'error', 'paused')
  ),
  constraint print_stations_prints_remaining_chk check (
    prints_remaining is null or prints_remaining >= 0
  )
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.print_stations (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  generated_image_id uuid references public.generated_images (id) on delete set null,
  image_url text not null,
  storage_bucket text,
  storage_path text,
  paper_size text not null,
  cut text not null default 'none',
  copies integer not null default 1,
  status text not null default 'queued',
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  claimed_by uuid references public.print_stations (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printing_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint print_jobs_target_chk check (station_id is not null or event_id is not null),
  constraint print_jobs_paper_size_chk check (
    paper_size in ('4x6', '6x4', '2x6', '5x7', '6x8', '6x6', '6x9')
  ),
  constraint print_jobs_cut_chk check (cut in ('none', '2inch')),
  constraint print_jobs_copies_chk check (copies between 1 and 20),
  constraint print_jobs_status_chk check (
    status in ('queued', 'claimed', 'printing', 'done', 'failed', 'cancelled')
  ),
  constraint print_jobs_attempts_chk check (attempts >= 0 and max_attempts between 1 and 10)
);

create index if not exists print_jobs_queued_idx
  on public.print_jobs (created_at)
  where status = 'queued';

create index if not exists print_jobs_station_queued_idx
  on public.print_jobs (station_id, created_at)
  where status = 'queued';

create index if not exists print_jobs_event_queued_idx
  on public.print_jobs (event_id, created_at)
  where status = 'queued';

create index if not exists print_jobs_event_status_idx
  on public.print_jobs (event_id, status);

create index if not exists print_jobs_image_status_idx
  on public.print_jobs (generated_image_id, status);

create index if not exists print_jobs_claimed_idx
  on public.print_jobs (claimed_by, claimed_at)
  where status in ('claimed', 'printing');

create index if not exists print_stations_owner_idx
  on public.print_stations (owner_user_id);

create index if not exists print_stations_event_idx
  on public.print_stations (event_id);

create unique index if not exists print_stations_pairing_hash_idx
  on public.print_stations (pairing_code_hash)
  where pairing_code_hash is not null;

comment on table public.print_stations is
  'A Windows PC with a DNP printer, paired to a booth account. event_id is the event the operator selected.';
comment on column public.print_stations.organization_id is
  'Reserved. No foreign key until an organizations table exists.';
comment on column public.print_stations.event_id is
  'The event the operator selected on this PC. Pairing does not set it. Null claims nothing.';
comment on column public.print_stations.prints_remaining is
  'Null until a later build can read DNP media remaining. The spooler does not know it.';
comment on column public.print_stations.paused is
  'Owner or station pause. Heartbeats do not clear this flag.';
comment on table public.print_jobs is
  'One guest print. Claimed with FOR UPDATE SKIP LOCKED so two stations cannot take it.';
comment on column public.print_jobs.attempts is
  'Incremented on failure and on stale recovery, not when the job is claimed.';

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.normalize_pairing_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_text, 'sha256'), 'hex');
$$;

create or replace function public.assert_not_print_station()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'print_station' then
    raise exception 'not allowed';
  end if;
end;
$$;

create or replace function public.current_station_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.print_stations where auth_user_id = auth.uid();
$$;

create or replace function public.touch_print_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists print_stations_touch on public.print_stations;
create trigger print_stations_touch
  before update on public.print_stations
  for each row execute function public.touch_print_row();

create or replace function public.print_jobs_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.paper_size := lower(replace(coalesce(new.paper_size, ''), ' ', ''));
  new.cut := lower(coalesce(new.cut, 'none'));
  if new.paper_size = '2x6' then
    new.cut := '2inch';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists print_jobs_before_write on public.print_jobs;
create trigger print_jobs_before_write
  before insert or update on public.print_jobs
  for each row execute function public.print_jobs_before_write();

create or replace function public.create_station_pairing(
  p_name text,
  p_location_label text default null,
  p_expires_minutes integer default 30
)
returns table (station_id uuid, pairing_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_bytes bytea;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_raw text := '';
  v_plain text;
  v_id uuid;
  v_expires timestamptz;
  i integer;
begin
  if v_owner is null then
    raise exception 'sign in required';
  end if;
  perform public.assert_not_print_station();
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;

  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_raw := v_raw || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  v_plain := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
  v_expires := now() + make_interval(mins => least(greatest(coalesce(p_expires_minutes, 30), 5), 120));

  insert into public.print_stations (
    name, location_label, owner_user_id,
    pairing_code_hash, pairing_code_expires_at, status
  ) values (
    trim(p_name), nullif(trim(coalesce(p_location_label, '')), ''), v_owner,
    public.sha256_hex(public.normalize_pairing_code(v_plain)), v_expires, 'unpaired'
  )
  returning id into v_id;

  station_id := v_id;
  pairing_code := v_plain;
  expires_at := v_expires;
  return next;
end;
$$;

create or replace function public.refresh_station_pairing(
  p_station_id uuid,
  p_expires_minutes integer default 30
)
returns table (station_id uuid, pairing_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_station public.print_stations;
  v_bytes bytea;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_raw text := '';
  v_plain text;
  v_expires timestamptz;
  i integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  perform public.assert_not_print_station();
  select * into v_station from public.print_stations
  where id = p_station_id and owner_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'station not found';
  end if;

  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_raw := v_raw || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  v_plain := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
  v_expires := now() + make_interval(mins => least(greatest(coalesce(p_expires_minutes, 30), 5), 120));

  update public.print_stations
  set pairing_code_hash = public.sha256_hex(public.normalize_pairing_code(v_plain)),
      pairing_code_expires_at = v_expires
  where id = v_station.id;

  station_id := v_station.id;
  pairing_code := v_plain;
  expires_at := v_expires;
  return next;
end;
$$;

create or replace function public.unpair_station(p_station_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  perform public.assert_not_print_station();
  update public.print_stations
  set auth_user_id = null,
      pairing_code_hash = null,
      pairing_code_expires_at = null,
      paired_at = null,
      paused = false,
      status = 'unpaired',
      status_detail = 'unpaired by owner'
  where id = p_station_id and owner_user_id = auth.uid();
  if not found then
    raise exception 'station not found';
  end if;
end;
$$;

create or replace function public.redeem_pairing_code(p_code_hash text)
returns setof public.print_stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
begin
  select * into v_station
  from public.print_stations
  where pairing_code_hash = p_code_hash
    and pairing_code_expires_at > now()
  for update skip locked;

  if not found then
    return;
  end if;

  update public.print_stations
  set pairing_code_hash = null,
      pairing_code_expires_at = null
  where id = v_station.id
  returning * into v_station;

  return next v_station;
end;
$$;

create or replace function public.restore_pairing_code(
  p_station_id uuid,
  p_code_hash text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.print_stations
  set pairing_code_hash = p_code_hash,
      pairing_code_expires_at = p_expires_at
  where id = p_station_id
    and auth_user_id is null
    and pairing_code_hash is null;
end;
$$;

-- Same arguments as the print station contract. The event's saved size wins.
-- Copies that are queued, claimed, printing, or done count toward the limits.
-- Failed and cancelled do not, so a failed sheet can be tried again.
create or replace function public.enqueue_print_job(
  p_event_id uuid,
  p_event_passcode text,
  p_generated_image_id uuid,
  p_paper_size text,
  p_cut text default 'none',
  p_copies integer default 1,
  p_station_id uuid default null
)
returns public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_image public.generated_images;
  v_station public.print_stations;
  v_is_owner boolean;
  v_pass_ok boolean;
  v_job public.print_jobs;
  v_size text;
  v_cut text;
  v_max integer;
  v_guest_used integer;
  v_event_used integer;
begin
  perform public.assert_not_print_station();
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found';
  end if;

  v_is_owner := auth.uid() is not null and auth.uid() = v_event.user_id;
  v_pass_ok := coalesce(length(trim(coalesce(p_event_passcode, ''))), 0) > 0
    and lower(trim(p_event_passcode)) = lower(v_event.passcode);
  if not v_is_owner and not v_pass_ok then
    raise exception 'not allowed';
  end if;
  if not v_event.is_active and not v_is_owner then
    raise exception 'event is not active';
  end if;
  if coalesce(v_event.print_enabled, false) is not true then
    raise exception 'printing is off for this event';
  end if;

  select * into v_image
  from public.generated_images
  where id = p_generated_image_id and event_id = v_event.id;
  if not found or v_image.status <> 'completed' or v_image.generated_image_url is null then
    raise exception 'image is not ready';
  end if;

  v_size := lower(replace(coalesce(nullif(v_event.print_paper_size, ''), p_paper_size, ''), ' ', ''));
  if v_size not in ('4x6', '6x4', '2x6', '5x7', '6x8', '6x6', '6x9') then
    raise exception 'unsupported paper size';
  end if;
  if v_size = '2x6' then
    v_cut := '2inch';
  else
    v_cut := 'none';
  end if;

  v_max := least(20, greatest(coalesce(v_event.print_max_copies, 1), 1));
  if p_copies is null or p_copies < 1 or p_copies > v_max then
    raise exception 'copies must be between 1 and %', v_max;
  end if;

  select coalesce(sum(copies), 0) into v_guest_used
  from public.print_jobs
  where generated_image_id = v_image.id
    and status in ('queued', 'claimed', 'printing', 'done');
  if v_guest_used + p_copies > v_max then
    raise exception 'guest copy limit reached';
  end if;

  if v_event.print_event_limit is not null then
    select coalesce(sum(copies), 0) into v_event_used
    from public.print_jobs
    where event_id = v_event.id
      and status in ('queued', 'claimed', 'printing', 'done');
    if v_event_used + p_copies > v_event.print_event_limit then
      raise exception 'event print limit reached';
    end if;
  end if;

  if p_station_id is not null then
    select * into v_station from public.print_stations where id = p_station_id;
    if not found or v_station.owner_user_id is distinct from v_event.user_id then
      raise exception 'station not found';
    end if;
  end if;

  insert into public.print_jobs (
    station_id, event_id, owner_user_id, generated_image_id, image_url,
    paper_size, cut, copies, status
  ) values (
    p_station_id, v_event.id, v_event.user_id, v_image.id, v_image.generated_image_url,
    v_size, v_cut, p_copies, 'queued'
  )
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.claim_print_job()
returns setof public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
  v_job public.print_jobs;
begin
  select * into v_station
  from public.print_stations
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'not a paired station';
  end if;
  if v_station.paused or v_station.event_id is null then
    return;
  end if;

  select * into v_job
  from public.print_jobs
  where status = 'queued'
    and attempts < max_attempts
    and event_id = v_station.event_id
    and (station_id is null or station_id = v_station.id)
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.print_jobs
  set status = 'claimed',
      claimed_by = v_station.id,
      claimed_at = now(),
      error = null
  where id = v_job.id
  returning * into v_job;

  return next v_job;
end;
$$;

create or replace function public.mark_print_job(
  p_job_id uuid,
  p_status text,
  p_error text default null
)
returns setof public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station_id uuid := public.current_station_id();
  v_job public.print_jobs;
  v_attempts integer;
  v_error text;
begin
  if v_station_id is null then
    raise exception 'not a paired station';
  end if;
  if p_status not in ('printing', 'done', 'failed', 'queued') then
    raise exception 'unsupported status';
  end if;

  select * into v_job
  from public.print_jobs
  where id = p_job_id and claimed_by = v_station_id
  for update;

  if not found or v_job.status not in ('claimed', 'printing') then
    raise exception 'job is not claimed by this station';
  end if;

  v_error := left(nullif(trim(coalesce(p_error, '')), ''), 500);

  if p_status = 'printing' then
    update public.print_jobs
    set status = 'printing', printing_at = coalesce(printing_at, now()), error = null
    where id = v_job.id
    returning * into v_job;
  elsif p_status = 'done' then
    update public.print_jobs
    set status = 'done', finished_at = now(), error = null
    where id = v_job.id
    returning * into v_job;
  else
    v_attempts := v_job.attempts + 1;
    if p_status = 'failed' or v_attempts >= v_job.max_attempts then
      update public.print_jobs
      set status = 'failed', attempts = v_attempts, error = coalesce(v_error, 'failed'), finished_at = now()
      where id = v_job.id
      returning * into v_job;
    else
      update public.print_jobs
      set status = 'queued', attempts = v_attempts, error = v_error,
          claimed_by = null, claimed_at = null, printing_at = null
      where id = v_job.id
      returning * into v_job;
    end if;
  end if;

  return next v_job;
end;
$$;

create or replace function public.release_stale_print_jobs(p_stale_seconds integer default 600)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station_id uuid := public.current_station_id();
  v_job public.print_jobs;
  v_count integer := 0;
  v_attempts integer;
  v_cutoff timestamptz;
begin
  if v_station_id is null then
    return 0;
  end if;
  v_cutoff := now() - make_interval(secs => greatest(coalesce(p_stale_seconds, 600), 60));

  for v_job in
    select * from public.print_jobs
    where claimed_by = v_station_id
      and status in ('claimed', 'printing')
      and claimed_at is not null
      and claimed_at < v_cutoff
    for update skip locked
  loop
    v_attempts := v_job.attempts + 1;
    if v_attempts >= v_job.max_attempts then
      update public.print_jobs
      set status = 'failed', attempts = v_attempts, error = 'stale claim', finished_at = now()
      where id = v_job.id;
    else
      update public.print_jobs
      set status = 'queued', attempts = v_attempts, error = 'stale claim',
          claimed_by = null, claimed_at = null, printing_at = null
      where id = v_job.id;
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.station_heartbeat(
  p_status text,
  p_status_detail text default null,
  p_printer_name text default null,
  p_printer_model text default null,
  p_prints_remaining integer default null,
  p_app_version text default null
)
returns setof public.print_stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
  v_status text := lower(coalesce(p_status, 'online'));
begin
  select * into v_station from public.print_stations where auth_user_id = auth.uid() for update;
  if not found then
    raise exception 'not a paired station';
  end if;
  if v_status not in ('online', 'offline', 'printing', 'error', 'paused') then
    v_status := 'online';
  end if;

  update public.print_stations
  set status = v_status,
      status_detail = left(p_status_detail, 500),
      printer_name = coalesce(p_printer_name, printer_name),
      printer_model = coalesce(p_printer_model, printer_model),
      prints_remaining = coalesce(p_prints_remaining, prints_remaining),
      app_version = coalesce(p_app_version, app_version),
      last_seen_at = now()
  where id = v_station.id
  returning * into v_station;

  return next v_station;
end;
$$;

create or replace function public.set_station_paused(p_paused boolean)
returns setof public.print_stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select * into v_station
  from public.print_stations
  where auth_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'not a paired station';
  end if;

  update public.print_stations
  set paused = coalesce(p_paused, false),
      status = case when coalesce(p_paused, false) then 'paused' else status end
  where id = v_station.id
  returning * into v_station;

  return next v_station;
end;
$$;

create or replace function public.set_station_paused_by_owner(p_station_id uuid, p_paused boolean)
returns setof public.print_stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
begin
  perform public.assert_not_print_station();
  update public.print_stations
  set paused = coalesce(p_paused, false),
      status = case when coalesce(p_paused, false) then 'paused' else status end
  where id = p_station_id and owner_user_id = auth.uid()
  returning * into v_station;
  if not found then
    raise exception 'station not found';
  end if;
  return next v_station;
end;
$$;

create or replace function public.list_station_events()
returns table (
  id uuid,
  name text,
  city text,
  event_date text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_user_id into v_owner
  from public.print_stations
  where auth_user_id = auth.uid();
  if v_owner is null then
    raise exception 'not a paired station';
  end if;

  return query
  select e.id, e.name, e.city, e.event_date::text, e.start_datetime, e.end_datetime, e.is_active
  from public.events e
  where e.user_id = v_owner
    and (
      (e.is_active and (e.end_datetime is null or e.end_datetime >= now()))
      or (e.start_datetime is not null and e.start_datetime >= now())
    )
  order by e.start_datetime nulls last, e.name;
end;
$$;

create or replace function public.set_station_event(p_event_id uuid)
returns setof public.print_stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.print_stations;
begin
  select * into v_station
  from public.print_stations
  where auth_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'not a paired station';
  end if;

  if p_event_id is not null then
    perform 1
    from public.events e
    where e.id = p_event_id
      and e.user_id = v_station.owner_user_id
      and (
        (e.is_active and (e.end_datetime is null or e.end_datetime >= now()))
        or (e.start_datetime is not null and e.start_datetime >= now())
      );
    if not found then
      raise exception 'event not found';
    end if;
  end if;

  update public.print_stations
  set event_id = p_event_id
  where id = v_station.id
  returning * into v_station;

  return next v_station;
end;
$$;

create or replace function public.booth_can_manage_print_job(p_job public.print_jobs)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'print_station' then
    return false;
  end if;
  if public.is_admin(auth.uid()) then
    return true;
  end if;
  if exists (
    select 1 from public.events e
    where e.id = p_job.event_id and (e.user_id = auth.uid() or exists (
      select 1 from public.event_access ea
      where ea.event_id = e.id and ea.user_id = auth.uid()
    ))
  ) then
    return true;
  end if;
  if exists (
    select 1 from public.print_stations s
    where s.owner_user_id = auth.uid()
      and (s.id = p_job.station_id or s.id = p_job.claimed_by)
  ) then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.retry_print_job(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.print_jobs;
begin
  perform public.assert_not_print_station();
  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found or not public.booth_can_manage_print_job(v_job) then
    raise exception 'job not found';
  end if;
  if v_job.status <> 'failed' then
    raise exception 'only a failed job can be retried';
  end if;

  update public.print_jobs
  set status = 'queued',
      attempts = 0,
      error = null,
      claimed_by = null,
      claimed_at = null,
      printing_at = null,
      finished_at = null
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.cancel_print_job(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.print_jobs;
begin
  perform public.assert_not_print_station();
  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found or not public.booth_can_manage_print_job(v_job) then
    raise exception 'job not found';
  end if;
  if v_job.status not in ('failed', 'queued') then
    raise exception 'only a queued or failed job can be cancelled';
  end if;

  update public.print_jobs
  set status = 'cancelled',
      finished_at = now(),
      claimed_by = null,
      claimed_at = null,
      printing_at = null
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row security. Anon cannot read stations or jobs. The kiosk only enqueues.
-- ---------------------------------------------------------------------------

alter table public.print_stations enable row level security;
alter table public.print_jobs enable row level security;

revoke all on public.print_stations from public, anon, authenticated;
revoke all on public.print_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.print_stations to authenticated;
grant select, insert, update, delete on public.print_jobs to authenticated;
grant all on public.print_stations to service_role;
grant all on public.print_jobs to service_role;

drop policy if exists print_stations_select on public.print_stations;
create policy print_stations_select on public.print_stations
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or auth_user_id = (select auth.uid()));

drop policy if exists print_stations_owner_write on public.print_stations;
create policy print_stations_owner_write on public.print_stations
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists print_jobs_select on public.print_jobs;
create policy print_jobs_select on public.print_jobs
  for select to authenticated
  using (
    claimed_by = public.current_station_id()
    or (
      event_id is not null
      and event_id = (select s.event_id from public.print_stations s where s.id = public.current_station_id())
      and (station_id is null or station_id = public.current_station_id())
    )
    or exists (
      select 1 from public.events e
      where e.id = print_jobs.event_id and e.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.event_access ea
      where ea.event_id = print_jobs.event_id and ea.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.print_stations s
      where s.id = print_jobs.station_id and s.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists print_jobs_owner_write on public.print_jobs;
create policy print_jobs_owner_write on public.print_jobs
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = print_jobs.event_id and e.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.event_access ea
      where ea.event_id = print_jobs.event_id and ea.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.print_stations s
      where s.id = print_jobs.station_id and s.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.event_access ea
      where ea.event_id = event_id and ea.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.print_stations s
      where s.id = station_id and s.owner_user_id = (select auth.uid())
    )
  );

revoke all on function public.normalize_pairing_code(text) from public, anon, authenticated;
revoke all on function public.sha256_hex(text) from public, anon, authenticated;
revoke all on function public.assert_not_print_station() from public, anon, authenticated;
revoke all on function public.current_station_id() from public, anon, authenticated;
revoke all on function public.touch_print_row() from public, anon, authenticated;
revoke all on function public.print_jobs_before_write() from public, anon, authenticated;
revoke all on function public.create_station_pairing(text, text, integer) from public, anon, authenticated;
revoke all on function public.refresh_station_pairing(uuid, integer) from public, anon, authenticated;
revoke all on function public.unpair_station(uuid) from public, anon, authenticated;
revoke all on function public.redeem_pairing_code(text) from public, anon, authenticated;
revoke all on function public.restore_pairing_code(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_print_job(uuid, text, uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.claim_print_job() from public, anon, authenticated;
revoke all on function public.mark_print_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_stale_print_jobs(integer) from public, anon, authenticated;
revoke all on function public.station_heartbeat(text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.set_station_paused(boolean) from public, anon, authenticated;
revoke all on function public.set_station_paused_by_owner(uuid, boolean) from public, anon, authenticated;
revoke all on function public.list_station_events() from public, anon, authenticated;
revoke all on function public.set_station_event(uuid) from public, anon, authenticated;
revoke all on function public.booth_can_manage_print_job(public.print_jobs) from public, anon, authenticated;
revoke all on function public.retry_print_job(uuid) from public, anon, authenticated;
revoke all on function public.cancel_print_job(uuid) from public, anon, authenticated;

grant execute on function public.current_station_id() to authenticated;
grant execute on function public.create_station_pairing(text, text, integer) to authenticated;
grant execute on function public.refresh_station_pairing(uuid, integer) to authenticated;
grant execute on function public.unpair_station(uuid) to authenticated;
grant execute on function public.enqueue_print_job(uuid, text, uuid, text, text, integer, uuid) to anon, authenticated;
grant execute on function public.claim_print_job() to authenticated;
grant execute on function public.mark_print_job(uuid, text, text) to authenticated;
grant execute on function public.release_stale_print_jobs(integer) to authenticated;
grant execute on function public.station_heartbeat(text, text, text, text, integer, text) to authenticated;
grant execute on function public.set_station_paused(boolean) to authenticated;
grant execute on function public.set_station_paused_by_owner(uuid, boolean) to authenticated;
grant execute on function public.list_station_events() to authenticated;
grant execute on function public.set_station_event(uuid) to authenticated;
grant execute on function public.retry_print_job(uuid) to authenticated;
grant execute on function public.cancel_print_job(uuid) to authenticated;

grant execute on function public.redeem_pairing_code(text) to service_role;
grant execute on function public.restore_pairing_code(uuid, text, timestamptz) to service_role;
grant execute on function public.enqueue_print_job(uuid, text, uuid, text, text, integer, uuid) to service_role;
grant execute on function public.retry_print_job(uuid) to service_role;
grant execute on function public.cancel_print_job(uuid) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.print_jobs;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication was not found. Enable Realtime for print_jobs in the dashboard.';
end
$$;
