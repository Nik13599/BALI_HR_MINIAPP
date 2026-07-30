create table if not exists public.hall_layouts (
  id text primary key default gen_random_uuid()::text,
  layout_family_key text not null default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 160),
  internal_description text not null default '',
  canvas_width integer not null default 1000 check (canvas_width between 240 and 10000),
  canvas_height integer not null default 1400 check (canvas_height between 240 and 10000),
  background_url text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  source_layout_id text references public.hall_layouts(id) on delete set null,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  published_by_admin_id uuid references public.admin_users(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layout_family_key, version)
);

create index if not exists hall_layouts_status_updated_idx
  on public.hall_layouts(status, updated_at desc);

create table if not exists public.hall_layout_elements (
  id uuid primary key default gen_random_uuid(),
  layout_id text not null references public.hall_layouts(id) on delete cascade,
  element_type text not null
    check (element_type in (
      'stage', 'dance_floor', 'bar', 'entrance', 'exit', 'cloakroom',
      'restroom', 'dj_zone', 'stairs', 'partition', 'decoration', 'label'
    )),
  label text not null default '',
  x numeric(10,4) not null default 0,
  y numeric(10,4) not null default 0,
  width numeric(10,4) not null default 10 check (width > 0),
  height numeric(10,4) not null default 10 check (height > 0),
  rotation numeric(8,3) not null default 0,
  style jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hall_layout_elements_layout_sort_idx
  on public.hall_layout_elements(layout_id, sort_order, id);

create table if not exists public.layout_tables (
  id text primary key default gen_random_uuid()::text,
  layout_id text not null references public.hall_layouts(id) on delete cascade,
  table_number text not null,
  name text not null default '',
  x numeric(10,4) not null default 0,
  y numeric(10,4) not null default 0,
  width numeric(10,4) not null default 8 check (width > 0),
  height numeric(10,4) not null default 8 check (height > 0),
  rotation numeric(8,3) not null default 0,
  shape text not null default 'round'
    check (shape in ('round', 'square', 'rectangle', 'sofa', 'custom')),
  capacity integer not null default 4 check (capacity > 0),
  recommended_guests integer not null default 4 check (recommended_guests > 0),
  minimum_deposit numeric(12,2) not null default 0 check (minimum_deposit >= 0),
  table_type text not null default 'regular'
    check (table_type in ('regular', 'vip', 'bar', 'sofa', 'clan', 'service')),
  description text not null default '',
  status text not null default 'available'
    check (status in ('available', 'unavailable', 'vip_only', 'clan_only')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layout_id, table_number),
  unique (id, layout_id),
  check (recommended_guests <= capacity)
);

create index if not exists layout_tables_layout_sort_idx
  on public.layout_tables(layout_id, sort_order, table_number);

create table if not exists public.event_layout_assignments (
  event_id text primary key references public.events(id) on delete cascade,
  layout_id text not null references public.hall_layouts(id) on delete restrict,
  assigned_by_admin_id uuid references public.admin_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_layout_assignment_history (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  previous_layout_id text references public.hall_layouts(id) on delete set null,
  next_layout_id text not null references public.hall_layouts(id) on delete restrict,
  affected_booking_count integer not null default 0 check (affected_booking_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  confirmed boolean not null default false,
  reason text not null default '',
  changed_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_settings (
  singleton boolean primary key default true check (singleton),
  hold_seconds integer not null default 420 check (hold_seconds between 60 and 3600),
  allow_capacity_override boolean not null default false,
  auto_confirm boolean not null default false,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.booking_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique references public.app_users(user_key) on delete cascade,
  legacy_customer_id text unique,
  phone text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  birth_date date,
  trust_status text not null default 'normal'
    check (trust_status in ('trusted', 'normal', 'watch', 'restricted')),
  marketing_opt_in boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  app_opens integer not null default 0 check (app_opens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crm_customers(user_key, phone, first_name, birth_date, first_seen_at, last_activity_at, app_opens)
select
  user_key,
  phone,
  name,
  birth_date,
  first_seen_at,
  last_seen_at,
  opens
from public.app_users
on conflict (user_key) do nothing;

create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#c8ff3d',
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_customer_tags (
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  tag_id uuid not null references public.crm_tags(id) on delete cascade,
  assigned_by_admin_id uuid references public.admin_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  layout_id text not null references public.hall_layouts(id) on delete restrict,
  table_id text not null,
  user_key text not null references public.app_users(user_key) on delete cascade,
  clan_id text references public.clans(id) on delete cascade,
  session_id uuid references public.user_sessions(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'converted', 'released', 'expired')),
  expires_at timestamptz not null,
  released_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, layout_id)
    references public.layout_tables(id, layout_id)
    on delete restrict,
  check (expires_at > created_at)
);

create unique index if not exists booking_holds_one_active_table_idx
  on public.booking_holds(event_id, table_id)
  where status = 'active';

create unique index if not exists booking_holds_one_active_user_idx
  on public.booking_holds(user_key)
  where status = 'active';

create index if not exists booking_holds_expiry_idx
  on public.booking_holds(status, expires_at);

create table if not exists public.booking_records (
  id text primary key default gen_random_uuid()::text,
  booking_reference text not null unique,
  idempotency_key text not null unique,
  event_id text not null references public.events(id) on delete restrict,
  layout_id text not null references public.hall_layouts(id) on delete restrict,
  table_id text not null,
  hold_id uuid unique references public.booking_holds(id) on delete set null,
  user_key text not null references public.app_users(user_key) on delete restrict,
  crm_customer_id uuid references public.crm_customers(id) on delete set null,
  clan_id text references public.clans(id) on delete set null,
  booking_kind text not null default 'personal'
    check (booking_kind in ('personal', 'clan')),
  customer_name text not null,
  phone text not null,
  guests integer not null check (guests > 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  comment text not null default '' check (char_length(comment) <= 2000),
  status text not null default 'new'
    check (status in (
      'draft', 'held', 'new', 'pending', 'confirmed', 'cancelled',
      'expired', 'checked_in', 'no_show', 'completed'
    )),
  consent_accepted boolean not null default false,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text not null default '',
  checked_in_at timestamptz,
  no_show_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, layout_id)
    references public.layout_tables(id, layout_id)
    on delete restrict
);

create unique index if not exists booking_records_one_active_table_idx
  on public.booking_records(event_id, table_id)
  where status in ('held', 'new', 'pending', 'confirmed', 'checked_in');

create index if not exists booking_records_user_created_idx
  on public.booking_records(user_key, created_at desc);

create index if not exists booking_records_event_status_idx
  on public.booking_records(event_id, status, created_at desc);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null references public.booking_records(id) on delete cascade,
  previous_status text,
  next_status text not null,
  actor_type text not null check (actor_type in ('user', 'admin', 'system', 'checkin')),
  actor_id text not null,
  reason text not null default '',
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_status_history_booking_idx
  on public.booking_status_history(booking_id, created_at desc);

create table if not exists public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete restrict,
  user_key text not null references public.app_users(user_key) on delete restrict,
  booking_id text references public.booking_records(id) on delete set null,
  idempotency_key text not null unique,
  qr_subject_type text not null check (qr_subject_type in ('user', 'booking', 'gift', 'shop')),
  qr_subject_id text not null,
  checked_in_by_admin_id uuid references public.admin_users(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (event_id, user_key)
);

create index if not exists event_checkins_event_time_idx
  on public.event_checkins(event_id, checked_in_at desc);

insert into public.hall_layouts(
  id, layout_family_key, name, internal_description, status, version, published_at
)
values (
  'layout-standard-v1',
  'layout-standard',
  'Стандартный зал',
  'Перенесено из исходной схемы BALI',
  'published',
  1,
  now()
)
on conflict (id) do nothing;

do $$
begin
  if to_regclass('public.hall_tables') is not null then
    execute $copy$
      insert into public.layout_tables(
        id, layout_id, table_number, name, x, y, shape, capacity,
        recommended_guests, table_type, sort_order, active
      )
      select
        'layout-standard-v1:' || id,
        'layout-standard-v1',
        coalesce(nullif(regexp_replace(name, '[^0-9A-Za-zА-Яа-я_-]+', '', 'g'), ''), id),
        name,
        x,
        y,
        case when shape = 'square' then 'square' else 'round' end,
        seats,
        seats,
        case when shape = 'vip' then 'vip' else 'regular' end,
        (row_number() over (order by created_at, id))::integer,
        active
      from public.hall_tables
      on conflict (id) do nothing
    $copy$;
  end if;
end;
$$;

insert into public.event_layout_assignments(event_id, layout_id)
select id, 'layout-standard-v1'
from public.events
on conflict (event_id) do nothing;

insert into public.event_layout_assignment_history(
  event_id, next_layout_id, confirmed, reason
)
select id, 'layout-standard-v1', true, 'Исходная раскладка сохранена при production-миграции'
from public.events
where not exists (
  select 1
  from public.event_layout_assignment_history history
  where history.event_id = events.id
);

alter table public.hall_layouts enable row level security;
alter table public.hall_layout_elements enable row level security;
alter table public.layout_tables enable row level security;
alter table public.event_layout_assignments enable row level security;
alter table public.event_layout_assignment_history enable row level security;
alter table public.booking_settings enable row level security;
alter table public.crm_customers enable row level security;
alter table public.crm_tags enable row level security;
alter table public.crm_customer_tags enable row level security;
alter table public.crm_notes enable row level security;
alter table public.booking_holds enable row level security;
alter table public.booking_records enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.event_checkins enable row level security;
