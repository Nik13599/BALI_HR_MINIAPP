create extension if not exists pgcrypto;

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
alter table public.loyalty_rewards add column if not exists created_at timestamptz not null default now();
alter table public.loyalty_rewards add column if not exists updated_at timestamptz not null default now();

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
alter table public.loyalty_gifts add column if not exists created_at timestamptz not null default now();
alter table public.loyalty_gifts add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  reward_id uuid references public.loyalty_rewards(id) on delete set null,
  reward_title text not null default '',
  status text not null default 'issued',
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reward_grants add column if not exists user_key text;
alter table public.reward_grants add column if not exists reward_id uuid;
alter table public.reward_grants add column if not exists reward_title text not null default '';
alter table public.reward_grants add column if not exists status text not null default 'issued';
alter table public.reward_grants add column if not exists source text not null default 'admin';
alter table public.reward_grants add column if not exists created_at timestamptz not null default now();
alter table public.reward_grants add column if not exists updated_at timestamptz not null default now();

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
alter table public.gift_grants add column if not exists from_user_key text;
alter table public.gift_grants add column if not exists to_user_key text;
alter table public.gift_grants add column if not exists gift_id uuid;
alter table public.gift_grants add column if not exists gift_title text not null default '';
alter table public.gift_grants add column if not exists status text not null default 'sent';
alter table public.gift_grants add column if not exists created_at timestamptz not null default now();
alter table public.gift_grants add column if not exists updated_at timestamptz not null default now();
alter table public.gift_grants alter column from_user_key drop not null;

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

alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_gifts enable row level security;
alter table public.reward_grants enable row level security;
alter table public.gift_grants enable row level security;
alter table public.app_users enable row level security;

drop policy if exists loyalty_rewards_public_read on public.loyalty_rewards;
create policy loyalty_rewards_public_read on public.loyalty_rewards for select to anon using (active = true);
drop policy if exists loyalty_gifts_public_read on public.loyalty_gifts;
create policy loyalty_gifts_public_read on public.loyalty_gifts for select to anon using (active = true);
drop policy if exists app_users_public_read on public.app_users;
create policy app_users_public_read on public.app_users for select to anon using (active = true);

drop policy if exists loyalty_rewards_admin_all on public.loyalty_rewards;
create policy loyalty_rewards_admin_all on public.loyalty_rewards for all to authenticated using (true) with check (true);
drop policy if exists loyalty_gifts_admin_all on public.loyalty_gifts;
create policy loyalty_gifts_admin_all on public.loyalty_gifts for all to authenticated using (true) with check (true);
drop policy if exists reward_grants_admin_all on public.reward_grants;
create policy reward_grants_admin_all on public.reward_grants for all to authenticated using (true) with check (true);
drop policy if exists gift_grants_admin_all on public.gift_grants;
create policy gift_grants_admin_all on public.gift_grants for all to authenticated using (true) with check (true);
drop policy if exists app_users_admin_all on public.app_users;
create policy app_users_admin_all on public.app_users for all to authenticated using (true) with check (true);

insert into public.loyalty_rewards (title, description, icon, points_cost, stock, active)
select 'VIP-статус на 7 дней', 'Временный VIP-статус в приложении BALI.', '👑', 500, null, true
where not exists (select 1 from public.loyalty_rewards where lower(title) = lower('VIP-статус на 7 дней'));
insert into public.loyalty_rewards (title, description, icon, points_cost, stock, active)
select 'Приоритетная бронь', 'Приоритетное подтверждение бронирования стола.', '⭐', 300, null, true
where not exists (select 1 from public.loyalty_rewards where lower(title) = lower('Приоритетная бронь'));
insert into public.loyalty_rewards (title, description, icon, points_cost, stock, active)
select 'Комплимент от BALI', 'Специальный комплимент от клуба при следующем посещении.', '🌴', 250, null, true
where not exists (select 1 from public.loyalty_rewards where lower(title) = lower('Комплимент от BALI'));

insert into public.loyalty_gifts (title, description, icon, points_cost, stock, active)
select 'Коктейль BALI', 'Подарочный коктейль из специального меню.', '🍸', 300, null, true
where not exists (select 1 from public.loyalty_gifts where lower(title) = lower('Коктейль BALI'));
insert into public.loyalty_gifts (title, description, icon, points_cost, stock, active)
select 'Кальян BALI', 'Подарочный кальян при следующем посещении клуба.', '💨', 700, null, true
where not exists (select 1 from public.loyalty_gifts where lower(title) = lower('Кальян BALI'));
insert into public.loyalty_gifts (title, description, icon, points_cost, stock, active)
select 'Пять шотов', 'Подарочный сет из пяти шотов.', '🥃', 500, null, true
where not exists (select 1 from public.loyalty_gifts where lower(title) = lower('Пять шотов'));

create index if not exists loyalty_rewards_active_created_idx on public.loyalty_rewards(active, created_at desc);
create index if not exists loyalty_gifts_active_created_idx on public.loyalty_gifts(active, created_at desc);
create index if not exists reward_grants_user_created_idx on public.reward_grants(user_key, created_at desc);
create index if not exists gift_grants_user_created_idx on public.gift_grants(to_user_key, created_at desc);
create index if not exists app_users_last_seen_rebuild_idx on public.app_users(last_seen_at desc);

notify pgrst, 'reload schema';
