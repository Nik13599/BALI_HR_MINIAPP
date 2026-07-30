create table if not exists public.user_profiles (
  user_key text primary key references public.app_users(user_key) on delete cascade,
  display_name text not null default '',
  status_text text not null default '' check (char_length(status_text) <= 80),
  bio text not null default '' check (char_length(bio) <= 1000),
  interests text[] not null default '{}'::text[],
  birth_date date,
  gender text not null default 'unspecified'
    check (gender in ('female', 'male', 'unspecified')),
  avatar_url text not null default '',
  phone text not null default '',
  discoverable boolean not null default true,
  allow_connections boolean not null default true,
  allow_event_invites boolean not null default true,
  allow_gifts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_profiles(
  user_key, display_name, birth_date, avatar_url, phone, created_at, updated_at
)
select
  user_key, name, birth_date, avatar, phone, first_seen_at, updated_at
from public.app_users
on conflict (user_key) do nothing;

create table if not exists public.user_consents (
  user_key text primary key references public.app_users(user_key) on delete cascade,
  age_confirmed boolean not null default false,
  age_confirmed_at timestamptz,
  terms_version text not null default '',
  terms_accepted_at timestamptz,
  privacy_version text not null default '',
  privacy_accepted_at timestamptz,
  marketing_opt_in boolean not null default false,
  marketing_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_merge_review (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  legacy_id text not null,
  candidate_user_key text references public.app_users(user_key) on delete set null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'ignored')),
  reviewed_by_admin_id uuid references public.admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_type, legacy_id)
);

create table if not exists public.event_runtime (
  event_id text primary key references public.events(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'active', 'completed', 'archived', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  age_limit integer not null default 18 check (age_limit between 18 and 99),
  dj text not null default '',
  artists jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.event_runtime(event_id, status)
select id, case when active then 'published' else 'draft' end
from public.events
on conflict (event_id) do nothing;

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  status text not null
    check (status in ('going', 'maybe', 'not_going', 'cancelled')),
  source_type text not null default 'self',
  source_id text not null default '',
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_key)
);

create index if not exists event_attendance_event_status_idx
  on public.event_attendance(event_id, status, updated_at desc);

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  sender_user_key text not null references public.app_users(user_key) on delete cascade,
  recipient_user_key text not null references public.app_users(user_key) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'going', 'maybe', 'declined', 'archived', 'cancelled')),
  responded_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_user_key <> recipient_user_key)
);

create unique index if not exists event_invitations_one_pending_idx
  on public.event_invitations(event_id, sender_user_key, recipient_user_key)
  where status = 'pending';

create index if not exists event_invitations_recipient_idx
  on public.event_invitations(recipient_user_key, status, created_at desc);

create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_key text not null references public.app_users(user_key) on delete cascade,
  recipient_user_key text not null references public.app_users(user_key) on delete cascade,
  pair_low text not null references public.app_users(user_key) on delete cascade,
  pair_high text not null references public.app_users(user_key) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed', 'blocked')),
  request_message text not null default '' check (char_length(request_message) <= 500),
  cooldown_until timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_user_key <> recipient_user_key),
  check (pair_low < pair_high),
  unique (pair_low, pair_high)
);

create index if not exists user_connections_recipient_status_idx
  on public.user_connections(recipient_user_key, status, created_at desc);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  pair_low text not null references public.app_users(user_key) on delete cascade,
  pair_high text not null references public.app_users(user_key) on delete cascade,
  connection_id uuid not null unique references public.user_connections(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pair_low < pair_high),
  unique (pair_low, pair_high)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_user_key text references public.app_users(user_key) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to_message_id uuid references public.direct_messages(id) on delete set null,
  deleted_at timestamptz,
  deletion_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at desc);

create table if not exists public.direct_message_read_states (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_key)
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_key text not null references public.app_users(user_key) on delete cascade,
  blocked_user_key text not null references public.app_users(user_key) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (blocker_user_key <> blocked_user_key),
  unique (blocker_user_key, blocked_user_key)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_key text not null references public.app_users(user_key) on delete cascade,
  reported_user_key text not null references public.app_users(user_key) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete set null,
  message_id uuid references public.direct_messages(id) on delete set null,
  reason_code text not null,
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by_admin_id uuid references public.admin_users(id) on delete set null,
  resolution_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_user_key <> reported_user_key)
);

create index if not exists user_reports_status_created_idx
  on public.user_reports(status, created_at desc);

create table if not exists public.clan_profiles (
  clan_id text primary key references public.clans(id) on delete cascade,
  logo_url text not null default '',
  cover_url text not null default '',
  description text not null default '' check (char_length(description) <= 2000),
  achievements jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.clan_profiles(clan_id)
select id from public.clans
on conflict (clan_id) do nothing;

create table if not exists public.clan_creation_settings (
  singleton boolean primary key default true check (singleton),
  user_creation_enabled boolean not null default false,
  user_creation_points_cost integer not null default 0 check (user_creation_points_cost >= 0),
  default_member_limit integer not null default 50 check (default_member_limit between 2 and 10000),
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.clan_creation_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.clan_invitations (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete cascade,
  inviter_user_key text not null references public.app_users(user_key) on delete cascade,
  invitee_user_key text not null references public.app_users(user_key) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  message text not null default '' check (char_length(message) <= 500),
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inviter_user_key <> invitee_user_key)
);

create unique index if not exists clan_invitations_one_pending_idx
  on public.clan_invitations(clan_id, invitee_user_key)
  where status = 'pending';

create table if not exists public.clan_event_attendance (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (clan_id, event_id, user_key)
);

create table if not exists public.idempotency_records (
  scope text not null,
  idempotency_key text not null,
  actor_key text not null default '',
  request_hash text not null default '',
  response_code integer,
  response_body jsonb,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  primary key (scope, idempotency_key)
);

create index if not exists idempotency_records_expiry_idx
  on public.idempotency_records(expires_at);

alter table public.user_profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.data_merge_review enable row level security;
alter table public.event_runtime enable row level security;
alter table public.event_attendance enable row level security;
alter table public.event_invitations enable row level security;
alter table public.user_connections enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_read_states enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.clan_profiles enable row level security;
alter table public.clan_creation_settings enable row level security;
alter table public.clan_invitations enable row level security;
alter table public.clan_event_attendance enable row level security;
alter table public.idempotency_records enable row level security;
