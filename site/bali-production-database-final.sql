-- BALI PRODUCTION DATABASE — FINAL INSTALLER
-- Repeatable: safe to execute more than once in Supabase SQL Editor.
-- Creates loyalty, rewards, gifts, reviews, application users and QR attendance tables.

create extension if not exists pgcrypto;

-- Existing project tables: add fields required by production QR and customer linkage.
alter table public.events add column if not exists event_end_date date;
alter table public.events add column if not exists event_end_time time not null default '06:00';
alter table public.events add column if not exists qr_token text;
alter table public.events add column if not exists qr_created_at timestamptz;
alter table public.events add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists telegram_id bigint;

create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  action text not null,
  description text not null default '',
  points integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_rules add column if not exists description text not null default '';
alter table public.loyalty_rules add column if not exists points integer not null default 0;
alter table public.loyalty_rules add column if not exists active boolean not null default true;
alter table public.loyalty_rules add column if not exists updated_at timestamptz not null default now();

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  icon text not null default '🏆',
  image text not null default '',
  points_cost integer not null default 0,
  stock integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_rewards add column if not exists description text not null default '';
alter table public.loyalty_rewards add column if not exists icon text not null default '🏆';
alter table public.loyalty_rewards add column if not exists image text not null default '';
alter table public.loyalty_rewards add column if not exists points_cost integer not null default 0;
alter table public.loyalty_rewards add column if not exists stock integer;
alter table public.loyalty_rewards add column if not exists active boolean not null default true;
alter table public.loyalty_rewards add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  reward_id uuid references public.loyalty_rewards(id) on delete set null,
  reward_title text not null default '',
  status text not null default 'issued',
  source text not null default 'admin',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reward_grants add column if not exists reward_title text not null default '';
alter table public.reward_grants add column if not exists status text not null default 'issued';
alter table public.reward_grants add column if not exists source text not null default 'admin';
alter table public.reward_grants add column if not exists revoked_at timestamptz;
alter table public.reward_grants add column if not exists updated_at timestamptz not null default now();

create table if not exists public.loyalty_gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  icon text not null default '🎁',
  image text not null default '',
  points_cost integer not null default 0,
  stock integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_gifts add column if not exists description text not null default '';
alter table public.loyalty_gifts add column if not exists icon text not null default '🎁';
alter table public.loyalty_gifts add column if not exists image text not null default '';
alter table public.loyalty_gifts add column if not exists points_cost integer not null default 0;
alter table public.loyalty_gifts add column if not exists stock integer;
alter table public.loyalty_gifts add column if not exists active boolean not null default true;
alter table public.loyalty_gifts add column if not exists updated_at timestamptz not null default now();

create table if not exists public.gift_grants (
  id uuid primary key default gen_random_uuid(),
  from_user_key text,
  to_user_key text not null,
  gift_id uuid references public.loyalty_gifts(id) on delete set null,
  gift_title text not null default '',
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gift_grants alter column from_user_key drop not null;
alter table public.gift_grants add column if not exists gift_title text not null default '';
alter table public.gift_grants add column if not exists status text not null default 'sent';
alter table public.gift_grants add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reviews (
  id text primary key default ('review-' || gen_random_uuid()::text),
  user_key text,
  telegram_id bigint,
  telegram text not null default '',
  user_name text not null default '',
  type text not null default 'venue',
  event_id text,
  event_title text not null default '',
  message text not null default '',
  rating integer check (rating is null or rating between 1 and 5),
  status text not null default 'new',
  admin_reply text not null default '',
  reward_amount integer not null default 0,
  reward_status text not null default 'not_eligible',
  reward_action_key text,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reviews add column if not exists user_key text;
alter table public.reviews add column if not exists telegram_id bigint;
alter table public.reviews add column if not exists telegram text not null default '';
alter table public.reviews add column if not exists user_name text not null default '';
alter table public.reviews add column if not exists type text not null default 'venue';
alter table public.reviews add column if not exists event_id text;
alter table public.reviews alter column event_id type text using event_id::text;
alter table public.reviews add column if not exists event_title text not null default '';
alter table public.reviews add column if not exists message text not null default '';
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists status text not null default 'new';
alter table public.reviews add column if not exists admin_reply text not null default '';
alter table public.reviews add column if not exists reward_amount integer not null default 0;
alter table public.reviews add column if not exists reward_status text not null default 'not_eligible';
alter table public.reviews add column if not exists reward_action_key text;
alter table public.reviews add column if not exists rewarded_at timestamptz;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_settings (
  id text primary key default 'main',
  club_name text not null default 'BALI',
  address text not null default 'Минск, ул. Кирова, 13',
  phone text not null default '+375 (29) 670-03-00',
  events_title text not null default 'Ближайшие события',
  about_title text not null default 'О клубе',
  attendance_points integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_settings add column if not exists club_name text not null default 'BALI';
alter table public.app_settings add column if not exists address text not null default 'Минск, ул. Кирова, 13';
alter table public.app_settings add column if not exists phone text not null default '+375 (29) 670-03-00';
alter table public.app_settings add column if not exists events_title text not null default 'Ближайшие события';
alter table public.app_settings add column if not exists about_title text not null default 'О клубе';
alter table public.app_settings add column if not exists attendance_points integer not null default 100;
alter table public.app_settings add column if not exists updated_at timestamptz not null default now();
insert into public.app_settings (id) values ('main') on conflict (id) do nothing;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  telegram_id bigint,
  name text not null default 'Гость BALI',
  username text not null default '',
  avatar text not null default '',
  gender text not null default 'unspecified',
  active boolean not null default true,
  opens integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_users add column if not exists telegram_id bigint;
alter table public.app_users add column if not exists name text not null default 'Гость BALI';
alter table public.app_users add column if not exists username text not null default '';
alter table public.app_users add column if not exists avatar text not null default '';
alter table public.app_users add column if not exists gender text not null default 'unspecified';
alter table public.app_users add column if not exists active boolean not null default true;
alter table public.app_users add column if not exists opens integer not null default 1;
alter table public.app_users add column if not exists first_seen_at timestamptz not null default now();
alter table public.app_users add column if not exists last_seen_at timestamptz not null default now();
alter table public.app_users add column if not exists updated_at timestamptz not null default now();

create table if not exists public.event_checkins (
  id text primary key,
  event_id text not null,
  event_title text not null default '',
  event_date date,
  event_time time,
  user_key text not null,
  telegram_id bigint,
  telegram text not null default '',
  name text not null default 'Гость BALI',
  phone text not null default '',
  checked_in_at timestamptz not null default now(),
  left_at timestamptz,
  reentered_at timestamptz,
  presence_status text not null default 'inside',
  source text not null default 'event_qr',
  reward integer not null default 0,
  xp integer not null default 0,
  visits integer not null default 0,
  level text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_key)
);
alter table public.event_checkins alter column event_id type text using event_id::text;
alter table public.event_checkins add column if not exists event_title text not null default '';
alter table public.event_checkins add column if not exists event_date date;
alter table public.event_checkins add column if not exists event_time time;
alter table public.event_checkins add column if not exists telegram_id bigint;
alter table public.event_checkins add column if not exists telegram text not null default '';
alter table public.event_checkins add column if not exists name text not null default 'Гость BALI';
alter table public.event_checkins add column if not exists phone text not null default '';
alter table public.event_checkins add column if not exists checked_in_at timestamptz not null default now();
alter table public.event_checkins add column if not exists left_at timestamptz;
alter table public.event_checkins add column if not exists reentered_at timestamptz;
alter table public.event_checkins add column if not exists presence_status text not null default 'inside';
alter table public.event_checkins add column if not exists source text not null default 'event_qr';
alter table public.event_checkins add column if not exists reward integer not null default 0;
alter table public.event_checkins add column if not exists xp integer not null default 0;
alter table public.event_checkins add column if not exists visits integer not null default 0;
alter table public.event_checkins add column if not exists level text not null default '';
alter table public.event_checkins add column if not exists updated_at timestamptz not null default now();

create table if not exists public.event_history (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  total_scans integer not null default 0,
  unique_visitors integer not null default 0,
  current_inside integer not null default 0,
  last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_history alter column event_id type text using event_id::text;
alter table public.event_history add column if not exists total_scans integer not null default 0;
alter table public.event_history add column if not exists unique_visitors integer not null default 0;
alter table public.event_history add column if not exists current_inside integer not null default 0;
alter table public.event_history add column if not exists last_scan_at timestamptz;
alter table public.event_history add column if not exists updated_at timestamptz not null default now();

-- Indexes.
create index if not exists loyalty_rules_action_idx on public.loyalty_rules(action);
create index if not exists loyalty_rewards_active_idx on public.loyalty_rewards(active);
create index if not exists loyalty_gifts_active_idx on public.loyalty_gifts(active);
create index if not exists reward_grants_user_idx on public.reward_grants(user_key, created_at desc);
create index if not exists gift_grants_to_user_idx on public.gift_grants(to_user_key, created_at desc);
create index if not exists reviews_created_idx on public.reviews(created_at desc);
create index if not exists reviews_user_event_idx on public.reviews(user_key, event_id, created_at desc);
create index if not exists reviews_reward_status_idx on public.reviews(reward_status, created_at desc);
create index if not exists app_users_user_key_idx on public.app_users(user_key);
create index if not exists app_users_telegram_idx on public.app_users(telegram_id);
create index if not exists app_users_last_seen_idx on public.app_users(last_seen_at desc);
create index if not exists event_checkins_event_idx on public.event_checkins(event_id, checked_in_at desc);
create index if not exists event_checkins_user_idx on public.event_checkins(user_key, checked_in_at desc);
create index if not exists customers_telegram_id_idx on public.customers(telegram_id);
create index if not exists events_qr_token_idx on public.events(qr_token) where qr_token is not null;

-- Default production rules.
insert into public.loyalty_rules (title, action, description, points, active)
select 'Посещение мероприятия по QR', 'event_checkin', 'Начисляется один раз за первое подтверждение входа на мероприятие.', 100, true
where not exists (select 1 from public.loyalty_rules where action in ('event_checkin','attendance','qr_checkin'));
insert into public.loyalty_rules (title, action, description, points, active)
select 'Отзыв о мероприятии', 'review', 'Начисляется один раз за первый отзыв пользователя о посещённом мероприятии.', 100, true
where not exists (select 1 from public.loyalty_rules where action = 'review');
insert into public.loyalty_rules (title, action, description, points, active)
select 'Репост мероприятия', 'event_share', 'Начисляется за подтверждённый репост мероприятия.', 5, true
where not exists (select 1 from public.loyalty_rules where action = 'event_share');
insert into public.loyalty_rules (title, action, description, points, active)
select 'Приглашение нового пользователя', 'referral', 'Начисляется после первого входа действительно нового пользователя по приглашению.', 10, true
where not exists (select 1 from public.loyalty_rules where action = 'referral');

-- Row level security.
alter table public.loyalty_rules enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.reward_grants enable row level security;
alter table public.loyalty_gifts enable row level security;
alter table public.gift_grants enable row level security;
alter table public.reviews enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_users enable row level security;
alter table public.event_checkins enable row level security;
alter table public.event_history enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['loyalty_rules','loyalty_rewards','reward_grants','loyalty_gifts','gift_grants','reviews','app_settings','app_users','event_checkins','event_history']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', table_name || '_admin_all', table_name);
  end loop;
end $$;

drop policy if exists loyalty_rules_public_read on public.loyalty_rules;
create policy loyalty_rules_public_read on public.loyalty_rules for select to anon using (active = true);
drop policy if exists loyalty_rewards_public_read on public.loyalty_rewards;
create policy loyalty_rewards_public_read on public.loyalty_rewards for select to anon using (active = true);
drop policy if exists loyalty_gifts_public_read on public.loyalty_gifts;
create policy loyalty_gifts_public_read on public.loyalty_gifts for select to anon using (active = true);
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select to anon using (true);
drop policy if exists app_users_public_read on public.app_users;
create policy app_users_public_read on public.app_users for select to anon using (active = true);
drop policy if exists app_users_public_insert on public.app_users;
drop policy if exists app_users_public_update on public.app_users;
drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert on public.reviews for insert to anon with check (status = 'new');
drop policy if exists event_checkins_public_read on public.event_checkins;
create policy event_checkins_public_read on public.event_checkins for select to anon using (true);
drop policy if exists event_checkins_public_insert on public.event_checkins;
create policy event_checkins_public_insert on public.event_checkins for insert to anon with check (true);
drop policy if exists event_checkins_public_update on public.event_checkins;
create policy event_checkins_public_update on public.event_checkins for update to anon using (true) with check (true);

update public.app_settings
set attendance_points = coalesce((select points from public.loyalty_rules where action in ('event_checkin','attendance','qr_checkin') and active = true order by updated_at desc limit 1), attendance_points),
    events_title = 'Ближайшие события',
    about_title = 'О клубе',
    updated_at = now()
where id = 'main';

notify pgrst, 'reload schema';
