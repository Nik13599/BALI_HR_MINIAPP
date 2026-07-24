-- BALI production repair: loyalty, rewards, gifts, reviews, event analytics
-- Safe migration: creates missing structures only.

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
 description text default '',
 icon text default '🏆',
 points_cost integer not null default 0,
 stock integer,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.reward_grants (
 id uuid primary key default gen_random_uuid(),
 user_key text not null,
 reward_id uuid references public.loyalty_rewards(id) on delete set null,
 reward_title text default '',
 created_at timestamptz not null default now()
);

create table if not exists public.loyalty_gifts (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text default '',
 image text default '',
 points_cost integer not null default 0,
 stock integer,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.gift_grants (
 id uuid primary key default gen_random_uuid(),
 sender_key text,
 receiver_key text not null,
 gift_id uuid references public.loyalty_gifts(id) on delete set null,
 status text not null default 'created',
 created_at timestamptz not null default now()
);

create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 user_key text,
 user_name text default '',
 message text not null,
 rating integer,
 status text not null default 'new',
 admin_reply text default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.event_checkins (
 id uuid primary key default gen_random_uuid(),
 event_id uuid,
 user_key text not null,
 telegram text default '',
 checked_in_at timestamptz not null default now(),
 checked_out_at timestamptz,
 active boolean not null default true
);

create index if not exists event_checkins_event_idx on public.event_checkins(event_id, checked_in_at desc);
create index if not exists event_checkins_user_idx on public.event_checkins(user_key);

create table if not exists public.event_history (
 id uuid primary key default gen_random_uuid(),
 event_id uuid,
 title text default '',
 qr_scans integer not null default 0,
 created_at timestamptz not null default now()
);

notify pgrst, 'reload schema';
