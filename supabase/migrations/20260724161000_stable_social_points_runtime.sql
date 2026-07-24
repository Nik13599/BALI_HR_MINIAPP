-- BALI production: stable Telegram identities, points, BALI PEOPLE and VIP directory.
-- Safe to execute repeatedly.

create extension if not exists pgcrypto;

-- Telegram application users used by authentication and BALI PEOPLE.
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  telegram_id bigint,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  avatar text not null default '',
  birth_date date,
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
alter table public.app_users add column if not exists phone text not null default '';
alter table public.app_users add column if not exists avatar text not null default '';
alter table public.app_users add column if not exists birth_date date;
alter table public.app_users add column if not exists gender text not null default 'unspecified';
alter table public.app_users add column if not exists active boolean not null default true;
alter table public.app_users add column if not exists opens integer not null default 1;
alter table public.app_users add column if not exists first_seen_at timestamptz not null default now();
alter table public.app_users add column if not exists last_seen_at timestamptz not null default now();
alter table public.app_users add column if not exists created_at timestamptz not null default now();
alter table public.app_users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists app_users_user_key_uidx on public.app_users(user_key);
create index if not exists app_users_telegram_id_idx on public.app_users(telegram_id);
create index if not exists app_users_last_seen_runtime_idx on public.app_users(last_seen_at desc);

-- One balance per verified Telegram identity.
create table if not exists public.points_accounts (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  telegram_id bigint,
  name text not null default 'Гость BALI',
  phone text not null default '',
  telegram text not null default '',
  avatar text not null default '',
  balance integer not null default 0,
  xp integer not null default 0,
  visits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.points_accounts add column if not exists user_key text;
alter table public.points_accounts add column if not exists telegram_id bigint;
alter table public.points_accounts add column if not exists name text not null default 'Гость BALI';
alter table public.points_accounts add column if not exists phone text not null default '';
alter table public.points_accounts add column if not exists telegram text not null default '';
alter table public.points_accounts add column if not exists avatar text not null default '';
alter table public.points_accounts add column if not exists balance integer not null default 0;
alter table public.points_accounts add column if not exists xp integer not null default 0;
alter table public.points_accounts add column if not exists visits integer not null default 0;
alter table public.points_accounts add column if not exists created_at timestamptz not null default now();
alter table public.points_accounts add column if not exists updated_at timestamptz not null default now();
create unique index if not exists points_accounts_user_key_uidx on public.points_accounts(user_key);
create index if not exists points_accounts_telegram_id_idx on public.points_accounts(telegram_id);

-- Idempotent points operations. action_key prevents a repeated reward.
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  type text not null default 'manual',
  title text not null default 'Операция BALI',
  amount integer not null default 0,
  action_key text,
  created_at timestamptz not null default now()
);
alter table public.points_ledger add column if not exists user_key text;
alter table public.points_ledger add column if not exists type text not null default 'manual';
alter table public.points_ledger add column if not exists title text not null default 'Операция BALI';
alter table public.points_ledger add column if not exists amount integer not null default 0;
alter table public.points_ledger add column if not exists action_key text;
alter table public.points_ledger add column if not exists created_at timestamptz not null default now();
create index if not exists points_ledger_user_created_idx on public.points_ledger(user_key, created_at desc);
create unique index if not exists points_ledger_action_key_uidx on public.points_ledger(action_key) where action_key is not null and action_key <> '';

-- Public-facing social settings are read only through a Telegram-validated Edge Function.
create table if not exists public.social_profiles (
  user_key text primary key,
  telegram_id bigint,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  photo text not null default '',
  crop_x numeric(5,2) not null default 50,
  crop_y numeric(5,2) not null default 40,
  status text not null default 'chat',
  bio text not null default '',
  active boolean not null default true,
  share_telegram boolean not null default false,
  gender text not null default 'unspecified',
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_profiles add column if not exists telegram_id bigint;
alter table public.social_profiles add column if not exists name text not null default 'Гость BALI';
alter table public.social_profiles add column if not exists username text not null default '';
alter table public.social_profiles add column if not exists phone text not null default '';
alter table public.social_profiles add column if not exists photo text not null default '';
alter table public.social_profiles add column if not exists crop_x numeric(5,2) not null default 50;
alter table public.social_profiles add column if not exists crop_y numeric(5,2) not null default 40;
alter table public.social_profiles add column if not exists status text not null default 'chat';
alter table public.social_profiles add column if not exists bio text not null default '';
alter table public.social_profiles add column if not exists active boolean not null default true;
alter table public.social_profiles add column if not exists share_telegram boolean not null default false;
alter table public.social_profiles add column if not exists gender text not null default 'unspecified';
alter table public.social_profiles add column if not exists birth_date date;
alter table public.social_profiles add column if not exists created_at timestamptz not null default now();
alter table public.social_profiles add column if not exists updated_at timestamptz not null default now();
create index if not exists social_profiles_updated_idx on public.social_profiles(updated_at desc);
create index if not exists social_profiles_telegram_idx on public.social_profiles(telegram_id);

create table if not exists public.vip_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  color text not null default '#c8ff3d',
  privileges jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vip_memberships (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  plan_id text not null,
  plan_name text not null default '',
  source text not null default 'admin',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vip_memberships_user_expiry_idx on public.vip_memberships(user_key, expires_at desc);
create index if not exists vip_memberships_active_idx on public.vip_memberships(starts_at, expires_at) where revoked_at is null;

-- Insert default plans only when the installed table uses text IDs.
do $$
declare id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'vip_plans' and column_name = 'id';

  if id_type in ('text', 'character varying') then
    insert into public.vip_plans (id, name, description, color, privileges, active)
    values
      ('vip', 'BALI VIP', 'Базовый клубный статус BALI', '#c8ff3d', '["Приоритетная поддержка", "VIP-рамка профиля"]'::jsonb, true),
      ('black', 'BALI BLACK', 'Расширенный статус постоянного гостя', '#9aa4b2', '["VIP-рамка", "Раннее бронирование", "Специальные предложения"]'::jsonb, true),
      ('legend', 'BALI LEGEND', 'Максимальный статус сообщества BALI', '#e3bd64', '["Золотая рамка", "Максимальный приоритет", "Закрытые предложения"]'::jsonb, true)
    on conflict (id) do update set
      name = excluded.name,
      description = excluded.description,
      color = excluded.color,
      privileges = excluded.privileges,
      active = excluded.active,
      updated_at = now();
  end if;
end $$;

-- Staff can manage the tables from the authenticated admin panel.
alter table public.app_users enable row level security;
alter table public.points_accounts enable row level security;
alter table public.points_ledger enable row level security;
alter table public.social_profiles enable row level security;
alter table public.vip_plans enable row level security;
alter table public.vip_memberships enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['app_users','points_accounts','points_ledger','social_profiles','vip_plans','vip_memberships']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_staff_all', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', table_name || '_staff_all', table_name);
  end loop;
end $$;

-- The public application may read only the non-sensitive app-user directory.
drop policy if exists app_users_public_directory on public.app_users;
create policy app_users_public_directory on public.app_users for select to anon using (active = true);

grant usage on schema public to anon, authenticated;
grant select on public.app_users to anon;
grant select, insert, update, delete on public.app_users, public.points_accounts, public.points_ledger, public.social_profiles, public.vip_plans, public.vip_memberships to authenticated;

notify pgrst, 'reload schema';
