-- BALI Minsk: final production tables for admin functions
-- Run once in Supabase SQL Editor after bali-production-schema.sql and bali-production-runtime-migration.sql.
-- Safe to run repeatedly. No demo users, rewards, gifts or reviews are inserted.

create extension if not exists pgcrypto;

create table if not exists public.venue_content (
  id text primary key default 'venue-main',
  title text not null default 'Площадка BALI',
  description text not null default '',
  formats text not null default '',
  media jsonb not null default '[]'::jsonb,
  home_design jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venue_content add column if not exists home_design jsonb not null default '{}'::jsonb;
insert into public.venue_content(id,title,active,home_design)
values ('venue-main','Площадка BALI',true,'{}'::jsonb)
on conflict(id) do nothing;

create table if not exists public.reviews (
  id text primary key default gen_random_uuid()::text,
  user_key text not null default '',
  user_name text not null default 'Гость BALI',
  telegram text not null default '',
  event_id text references public.events(id) on delete set null,
  event_title text not null default '',
  type text not null default 'other' check(type in ('event','improvement','party','artist','venue','other')),
  rating integer check(rating between 1 and 5),
  message text not null,
  status text not null default 'new' check(status in ('new','reviewed','planned','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews(created_at desc);
create index if not exists reviews_status_idx on public.reviews(status);

create table if not exists public.loyalty_settings (
  id text primary key default 'main',
  referral_points integer not null default 50 check(referral_points >= 0),
  attendance_points integer not null default 100 check(attendance_points >= 0),
  event_share_points integer not null default 10 check(event_share_points >= 0),
  review_points integer not null default 100 check(review_points >= 0),
  chip_rate_points integer not null default 100 check(chip_rate_points > 0),
  updated_at timestamptz not null default now()
);
insert into public.loyalty_settings(id) values ('main') on conflict(id) do nothing;

create table if not exists public.loyalty_rewards (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  image_url text not null default '',
  xp integer not null default 0 check(xp >= 0),
  condition_type text not null default 'manual' check(condition_type in ('manual','event','visits','anniversary')),
  event_id text references public.events(id) on delete set null,
  event_title text not null default '',
  threshold integer not null default 1 check(threshold > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loyalty_rewards_order_idx on public.loyalty_rewards(active,sort_order);

create table if not exists public.loyalty_reward_grants (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.loyalty_rewards(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  user_name text not null default 'Гость BALI',
  source text not null default 'admin_manual',
  xp integer not null default 0,
  earned_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists loyalty_reward_active_unique
  on public.loyalty_reward_grants(reward_id,user_key) where revoked_at is null;

create table if not exists public.loyalty_gifts (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  icon text not null default '🎁',
  image_url text not null default '',
  points_price integer not null default 0 check(points_price >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loyalty_gifts_order_idx on public.loyalty_gifts(active,sort_order);

create table if not exists public.loyalty_gift_grants (
  id uuid primary key default gen_random_uuid(),
  gift_id text not null references public.loyalty_gifts(id) on delete restrict,
  gift_title text not null default 'Подарок BALI',
  gift_icon text not null default '🎁',
  from_user_key text,
  from_name text not null default 'BALI',
  user_key text not null references public.app_users(user_key) on delete cascade,
  user_name text not null default 'Гость BALI',
  points_price integer not null default 0,
  note text not null default '',
  status text not null default 'active' check(status in ('active','used','revoked')),
  granted_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists loyalty_gift_grants_recipient_idx on public.loyalty_gift_grants(user_key,granted_at desc);

create table if not exists public.vip_gifts (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete cascade,
  plan_id text not null references public.vip_plans(id) on delete restrict,
  plan_name text not null,
  days integer not null default 30 check(days > 0),
  note text not null default 'Подарок от BALI',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.venue_content enable row level security;
alter table public.reviews enable row level security;
alter table public.loyalty_settings enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_reward_grants enable row level security;
alter table public.loyalty_gifts enable row level security;
alter table public.loyalty_gift_grants enable row level security;
alter table public.vip_gifts enable row level security;

drop policy if exists "public venue content" on public.venue_content;
create policy "public venue content" on public.venue_content for select to anon using(active=true);
drop policy if exists "public active rewards" on public.loyalty_rewards;
create policy "public active rewards" on public.loyalty_rewards for select to anon using(active=true);
drop policy if exists "public active gifts" on public.loyalty_gifts;
create policy "public active gifts" on public.loyalty_gifts for select to anon using(active=true);
drop policy if exists "telegram app submit reviews" on public.reviews;
create policy "telegram app submit reviews" on public.reviews for insert to anon with check(char_length(message) between 1 and 2000);

do $$ declare t text; begin
  foreach t in array array[
    'venue_content','reviews','loyalty_settings','loyalty_rewards',
    'loyalty_reward_grants','loyalty_gifts','loyalty_gift_grants','vip_gifts'
  ] loop
    execute format('drop policy if exists "staff manage %1$s" on public.%1$I',t);
    execute format('create policy "staff manage %1$s" on public.%1$I for all to authenticated using(true) with check(true)',t);
  end loop;
end $$;

grant select on public.venue_content,public.loyalty_rewards,public.loyalty_gifts to anon;
grant insert on public.reviews to anon;
grant select,insert,update,delete on public.venue_content,public.reviews,public.loyalty_settings,
  public.loyalty_rewards,public.loyalty_reward_grants,public.loyalty_gifts,
  public.loyalty_gift_grants,public.vip_gifts to authenticated;

notify pgrst, 'reload schema';
