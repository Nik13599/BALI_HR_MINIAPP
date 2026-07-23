-- BALI production runtime migration: QR check-ins and BALI People
-- Run after bali-production-schema.sql in Supabase SQL Editor.

alter table public.events add column if not exists qr_token text;
alter table public.events add column if not exists qr_created_at timestamptz;
create unique index if not exists events_qr_token_unique on public.events(qr_token) where qr_token is not null;

alter table public.event_checkins add column if not exists event_date date;
alter table public.event_checkins add column if not exists event_time time;
alter table public.event_checkins add column if not exists telegram text not null default '';
alter table public.event_checkins add column if not exists phone text not null default '';
alter table public.event_checkins add column if not exists source text not null default 'event_qr';
alter table public.event_checkins add column if not exists visits integer not null default 0;
alter table public.event_checkins add column if not exists level text not null default '';
create unique index if not exists event_checkins_event_user_unique on public.event_checkins(event_id,user_key) where event_id is not null and user_key is not null;

create table if not exists public.social_profiles (
  user_key text primary key,
  telegram_id bigint unique,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  photo text not null default '',
  crop_x numeric(5,2) not null default 50,
  crop_y numeric(5,2) not null default 40,
  status text not null default 'closed',
  bio text not null default '',
  active boolean not null default false,
  gender text not null default 'unspecified',
  birth_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.social_likes (
  id uuid primary key default gen_random_uuid(),
  from_user_key text not null references public.social_profiles(user_key) on delete cascade,
  to_user_key text not null references public.social_profiles(user_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique(from_user_key,to_user_key),
  check(from_user_key<>to_user_key)
);
create index if not exists social_likes_to_idx on public.social_likes(to_user_key,created_at desc);
create index if not exists social_likes_from_idx on public.social_likes(from_user_key,created_at desc);

alter table public.social_profiles enable row level security;
alter table public.social_likes enable row level security;
drop policy if exists "public active social profiles" on public.social_profiles;
create policy "public active social profiles" on public.social_profiles for select to anon using(active=true and status<>'closed');
drop policy if exists "staff manage social profiles" on public.social_profiles;
create policy "staff manage social profiles" on public.social_profiles for all to authenticated using(true) with check(true);
drop policy if exists "staff manage social likes" on public.social_likes;
create policy "staff manage social likes" on public.social_likes for all to authenticated using(true) with check(true);
grant select on public.social_profiles to anon;
grant select,insert,update,delete on public.social_profiles,public.social_likes to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.social_profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.social_likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.event_checkins; exception when duplicate_object then null; end;
end $$;