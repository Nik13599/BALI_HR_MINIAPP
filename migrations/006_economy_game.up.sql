create table if not exists public.point_accounts (
  user_key text primary key references public.app_users(user_key) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_spent bigint not null default 0 check (lifetime_spent >= 0),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economy_settings (
  singleton boolean primary key default true check (singleton),
  registration_points bigint not null default 100 check (registration_points >= 0),
  profile_completion_points bigint not null default 100 check (profile_completion_points >= 0),
  checkin_points bigint not null default 250 check (checkin_points >= 0),
  invited_friend_points bigint not null default 150 check (invited_friend_points >= 0),
  clan_activity_points bigint not null default 25 check (clan_activity_points >= 0),
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.economy_settings(singleton)
values (true)
on conflict (singleton) do nothing;

insert into public.point_accounts(user_key)
select user_key from public.app_users
on conflict (user_key) do nothing;

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete restrict,
  amount bigint not null check (amount <> 0),
  balance_before bigint not null check (balance_before >= 0),
  balance_after bigint not null check (balance_after >= 0),
  operation_type text not null
    check (operation_type in ('credit', 'debit', 'refund', 'reversal', 'adjustment')),
  source_type text not null,
  source_id text not null default '',
  reason text not null default '',
  administrator_id uuid references public.admin_users(id) on delete set null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (balance_after = balance_before + amount)
);

create index if not exists point_ledger_user_created_idx
  on public.point_ledger(user_key, created_at desc);

create table if not exists public.reward_definitions (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 160),
  icon_url text not null default '',
  description text not null default '',
  points bigint not null default 0,
  xp integer not null default 0,
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic', 'legendary')),
  condition_type text not null default 'manual',
  condition_config jsonb not null default '{}'::jsonb,
  event_id text references public.events(id) on delete set null,
  clan_id text references public.clans(id) on delete set null,
  valid_from timestamptz,
  valid_until timestamptz,
  repeatable boolean not null default false,
  max_grants_per_user integer not null default 1 check (max_grants_per_user > 0),
  active boolean not null default true,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.reward_definitions(id) on delete restrict,
  user_key text not null references public.app_users(user_key) on delete restrict,
  source_type text not null default 'manual',
  source_id text not null default '',
  idempotency_key text not null unique,
  granted_by_admin_id uuid references public.admin_users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'redeemed', 'expired', 'revoked')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists user_rewards_user_status_idx
  on public.user_rewards(user_key, status, granted_at desc);

create table if not exists public.gift_catalog (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  image_url text not null default '',
  gift_type text not null default 'virtual'
    check (gift_type in ('virtual', 'physical')),
  points_cost bigint not null default 0 check (points_cost >= 0),
  validity_days integer check (validity_days is null or validity_days > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id text not null references public.gift_catalog(id) on delete restrict,
  sender_user_key text references public.app_users(user_key) on delete set null,
  recipient_user_key text not null references public.app_users(user_key) on delete restrict,
  points_cost bigint not null check (points_cost >= 0),
  point_transaction_id uuid references public.point_ledger(id) on delete set null,
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'delivered'
    check (status in ('pending', 'delivered', 'redeemed', 'expired', 'cancelled', 'refunded')),
  qr_token_hash text unique,
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by_admin_id uuid references public.admin_users(id) on delete set null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_user_key is null or sender_user_key <> recipient_user_key)
);

create index if not exists gifts_recipient_status_idx
  on public.gifts(recipient_user_key, status, created_at desc);

create table if not exists public.vip_plans (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  points_cost bigint not null default 0 check (points_cost >= 0),
  duration_days integer not null check (duration_days > 0),
  benefits jsonb not null default '[]'::jsonb,
  points_multiplier numeric(8,3) not null default 1 check (points_multiplier >= 1),
  extra_game_lives integer not null default 0 check (extra_game_lives >= 0),
  event_access jsonb not null default '[]'::jsonb,
  shop_access jsonb not null default '[]'::jsonb,
  booking_priority integer not null default 0,
  profile_frame_url text not null default '',
  badge_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_vip_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete restrict,
  plan_id text not null references public.vip_plans(id) on delete restrict,
  source_type text not null default 'purchase',
  point_transaction_id uuid references public.point_ledger(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active'
    check (status in ('scheduled', 'active', 'expired', 'revoked')),
  issued_by_admin_id uuid references public.admin_users(id) on delete set null,
  revoked_by_admin_id uuid references public.admin_users(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text not null default '',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists user_vip_user_status_idx
  on public.user_vip_subscriptions(user_key, status, ends_at desc);

create table if not exists public.shop_items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  image_url text not null default '',
  category text not null default 'other',
  points_cost bigint not null default 0 check (points_cost >= 0),
  stock integer check (stock is null or stock >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  status text not null default 'active'
    check (status in ('draft', 'active', 'sold_out', 'archived')),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  requires_redemption boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete restrict,
  total_points bigint not null check (total_points >= 0),
  point_transaction_id uuid references public.point_ledger(id) on delete set null,
  status text not null default 'paid'
    check (status in ('pending', 'paid', 'fulfilled', 'redeemed', 'cancelled', 'refunded')),
  qr_token_hash text unique,
  redeemed_at timestamptz,
  redeemed_by_admin_id uuid references public.admin_users(id) on delete set null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete restrict,
  item_name text not null,
  unit_points bigint not null check (unit_points >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.game_settings (
  singleton boolean primary key default true check (singleton),
  base_lives integer not null default 5 check (base_lives between 1 and 100),
  continue_points_cost bigint not null default 100 check (continue_points_cost >= 0),
  ranking_period_days integer not null default 7 check (ranking_period_days between 1 and 366),
  max_score_per_second numeric(12,3) not null default 500 check (max_score_per_second > 0),
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.game_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.game_profiles (
  user_key text primary key references public.app_users(user_key) on delete cascade,
  lives integer not null default 5 check (lives >= 0),
  best_score bigint not null default 0 check (best_score >= 0),
  xp bigint not null default 0 check (xp >= 0),
  suspicious_score_count integer not null default 0 check (suspicious_score_count >= 0),
  last_life_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.game_profiles(user_key)
select user_key from public.app_users
on conflict (user_key) do nothing;

create table if not exists public.game_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'completed', 'archived')),
  rewards jsonb not null default '[]'::jsonb,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete restrict,
  season_id uuid references public.game_seasons(id) on delete set null,
  user_session_id uuid references public.user_sessions(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned', 'rejected', 'excluded')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  lives_used integer not null default 1 check (lives_used > 0),
  continues_used integer not null default 0 check (continues_used >= 0),
  boosters jsonb not null default '[]'::jsonb,
  final_score bigint not null default 0 check (final_score >= 0),
  best_combo integer not null default 0 check (best_combo >= 0),
  device_hash text not null default '',
  suspicious boolean not null default false,
  suspicious_reasons jsonb not null default '[]'::jsonb,
  excluded_by_admin_id uuid references public.admin_users(id) on delete set null,
  exclusion_reason text not null default '',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_sessions_one_active_user_idx
  on public.game_sessions(user_key)
  where status = 'active';

create index if not exists game_sessions_score_idx
  on public.game_sessions(status, final_score desc, ended_at asc)
  where status = 'completed' and suspicious = false;

create table if not exists public.game_continues (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  points_cost bigint not null check (points_cost >= 0),
  point_transaction_id uuid not null unique references public.point_ledger(id) on delete restrict,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.game_prizes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.game_seasons(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  position integer not null check (position between 1 and 10),
  reward_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'issued', 'revoked')),
  issued_by_admin_id uuid references public.admin_users(id) on delete set null,
  issued_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  unique (season_id, position),
  unique (season_id, user_key)
);

create table if not exists public.clan_points_ledger (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete restrict,
  user_key text references public.app_users(user_key) on delete set null,
  points bigint not null check (points <> 0),
  source_type text not null,
  source_id text not null default '',
  idempotency_key text not null unique,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists clan_points_ledger_clan_created_idx
  on public.clan_points_ledger(clan_id, created_at desc);

alter table public.point_accounts enable row level security;
alter table public.economy_settings enable row level security;
alter table public.point_ledger enable row level security;
alter table public.reward_definitions enable row level security;
alter table public.user_rewards enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.gifts enable row level security;
alter table public.vip_plans enable row level security;
alter table public.user_vip_subscriptions enable row level security;
alter table public.shop_items enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.game_settings enable row level security;
alter table public.game_profiles enable row level security;
alter table public.game_seasons enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_continues enable row level security;
alter table public.game_prizes enable row level security;
alter table public.clan_points_ledger enable row level security;
