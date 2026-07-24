-- BALI production full repair migration
-- Safe repeatable bootstrap for missing modules

create extension if not exists pgcrypto;

create table if not exists public.loyalty_rules (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 action text not null,
 points integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_rewards (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 icon text not null default '🏆',
 points_cost integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.reward_grants (
 id uuid primary key default gen_random_uuid(),
 user_key text not null,
 reward_id uuid references public.loyalty_rewards(id) on delete set null,
 status text not null default 'issued',
 created_at timestamptz not null default now()
);

create table if not exists public.loyalty_gifts (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 image text not null default '',
 points_cost integer not null default 0,
 stock integer,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.gift_grants (
 id uuid primary key default gen_random_uuid(),
 from_user_key text not null,
 to_user_key text not null,
 gift_id uuid references public.loyalty_gifts(id) on delete set null,
 created_at timestamptz not null default now()
);

create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 user_key text,
 user_name text default '',
 message text not null default '',
 rating integer,
 status text not null default 'new',
 admin_reply text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.event_history (
 id uuid primary key default gen_random_uuid(),
 event_id uuid,
 total_scans integer not null default 0,
 unique_visitors integer not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.app_users (
 id uuid primary key default gen_random_uuid(),
 user_key text unique,
 telegram_id text,
 name text default '',
 photo text default '',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists app_users_user_key_idx on public.app_users(user_key);
create index if not exists app_users_telegram_idx on public.app_users(telegram_id);
create index if not exists reviews_created_idx on public.reviews(created_at desc);
create index if not exists event_history_event_idx on public.event_history(event_id);

notify pgrst, 'reload schema';
