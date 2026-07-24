-- BALI Minsk production repair migration · 2026-07-24
-- Safe to run repeatedly in Supabase SQL Editor.
-- Run after bali-production-schema.sql and bali-production-admin-complete-migration.sql.

create extension if not exists pgcrypto;

-- Automatic QR code identity for every event.
alter table public.events add column if not exists qr_token text;
alter table public.events add column if not exists qr_created_at timestamptz;
alter table public.events add column if not exists qr_enabled boolean not null default true;

update public.events
set qr_token = encode(gen_random_bytes(18), 'hex'),
    qr_created_at = coalesce(qr_created_at, now())
where qr_token is null or btrim(qr_token) = '';

create unique index if not exists events_qr_token_unique
  on public.events(qr_token)
  where qr_token is not null and qr_token <> '';

create or replace function public.ensure_event_qr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.qr_token is null or btrim(new.qr_token) = '' then
    new.qr_token := encode(gen_random_bytes(18), 'hex');
    new.qr_created_at := now();
  elsif tg_op = 'UPDATE' and new.qr_token is distinct from old.qr_token then
    new.qr_created_at := now();
  elsif new.qr_created_at is null then
    new.qr_created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists events_ensure_qr on public.events;
create trigger events_ensure_qr
before insert or update of qr_token on public.events
for each row execute function public.ensure_event_qr();

-- The QR Edge Function and browser client use these fields.
alter table public.event_checkins add column if not exists event_date date;
alter table public.event_checkins add column if not exists event_time time;
alter table public.event_checkins add column if not exists telegram text not null default '';
alter table public.event_checkins add column if not exists phone text not null default '';
alter table public.event_checkins add column if not exists source text not null default 'event_qr';
alter table public.event_checkins add column if not exists visits integer not null default 0;
alter table public.event_checkins add column if not exists level text not null default '';
alter table public.event_checkins add column if not exists reentered_at timestamptz;

create index if not exists event_checkins_event_user_lookup_idx
  on public.event_checkins(event_id, user_key)
  where event_id is not null and user_key is not null;
create index if not exists event_checkins_active_event_idx
  on public.event_checkins(event_id, presence_status, checked_in_at desc);

do $$
begin
  if not exists (
    select 1
    from public.event_checkins
    where event_id is not null and user_key is not null
    group by event_id, user_key
    having count(*) > 1
  ) then
    begin
      create unique index event_checkins_event_user_unique
        on public.event_checkins(event_id, user_key)
        where event_id is not null and user_key is not null;
    exception when duplicate_table then null;
    end;
  else
    raise notice 'BALI: duplicate historical event_checkins found; unique QR index was not created.';
  end if;
end $$;

-- VIP status presentation and privileges.
alter table public.vip_plans add column if not exists description text not null default '';
alter table public.vip_plans add column if not exists color text not null default '#c8ff3d';
alter table public.vip_plans add column if not exists privileges jsonb not null default '[]'::jsonb;
alter table public.vip_plans add column if not exists free_entry boolean not null default false;
alter table public.vip_plans add column if not exists guest_passes integer not null default 0;
alter table public.vip_plans add column if not exists early_booking_hours integer not null default 0;

update public.vip_plans
set color = case
  when lower(id) like '%legend%' or lower(id) like '%gold%' then '#e3bd64'
  when lower(id) like '%black%' then '#a7b0bd'
  else coalesce(nullif(color, ''), '#c8ff3d')
end;

create index if not exists vip_memberships_active_idx
  on public.vip_memberships(user_key, expires_at desc);

create or replace function public.admin_set_vip(
  p_user_key text,
  p_plan_id text,
  p_days integer default 30
) returns public.vip_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.vip_plans;
  v public.vip_memberships;
  v_start timestamptz := now();
  v_expires timestamptz;
begin
  if auth.uid() is null then raise exception 'Требуется вход администратора'; end if;
  select * into p from public.vip_plans where id = p_plan_id and active = true;
  if p.id is null then raise exception 'VIP-план не найден'; end if;

  select greatest(now(), max(expires_at)) into v_start
  from public.vip_memberships
  where user_key = p_user_key and plan_id = p_plan_id and expires_at > now();

  v_start := coalesce(v_start, now());
  v_expires := v_start + make_interval(days => greatest(p_days, 1));

  insert into public.vip_memberships(user_key, plan_id, plan_name, starts_at, expires_at, source)
  values(p_user_key, p.id, p.name, now(), v_expires, 'admin')
  returning * into v;
  return v;
end;
$$;

create or replace function public.admin_revoke_vip(p_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Требуется вход администратора'; end if;
  update public.vip_memberships set expires_at = least(expires_at, now()) where id = p_membership_id;
  return found;
end;
$$;

-- Reviews: administrator reply and moderation metadata.
alter table public.reviews add column if not exists admin_reply text not null default '';
alter table public.reviews add column if not exists reviewed_at timestamptz;
alter table public.reviews add column if not exists reviewed_by uuid;

-- Rewards: visible icon and optional BALI point reward.
alter table public.loyalty_rewards add column if not exists icon text not null default '🏆';
alter table public.loyalty_rewards add column if not exists points_reward integer not null default 0;

-- Gifts: inventory and availability window.
alter table public.loyalty_gifts add column if not exists stock integer;
alter table public.loyalty_gifts add column if not exists available_from timestamptz;
alter table public.loyalty_gifts add column if not exists available_until timestamptz;
alter table public.loyalty_gifts add column if not exists category text not null default 'Подарки';

-- Data freshness metadata.
alter table public.app_users add column if not exists updated_at timestamptz not null default now();
update public.app_users set updated_at = coalesce(last_seen_at, first_seen_at, now());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'events','app_users','reviews','loyalty_rewards','loyalty_gifts','loyalty_settings','venue_content'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Fast lookup. Existing user records are not deleted or rewritten.
create index if not exists app_users_telegram_lookup_idx on public.app_users(telegram_id) where telegram_id is not null;
create index if not exists app_users_last_seen_idx on public.app_users(last_seen_at desc);
create index if not exists social_profiles_user_key_idx on public.social_profiles(user_key);
create index if not exists social_profiles_updated_idx on public.social_profiles(updated_at desc);

-- Permissions for staff and server functions.
grant execute on function public.ensure_event_qr() to authenticated;
grant execute on function public.admin_set_vip(text,text,integer) to authenticated;
grant execute on function public.admin_revoke_vip(uuid) to authenticated;
grant select,insert,update,delete on public.events,public.event_checkins,public.reviews,public.vip_plans,public.vip_memberships,
  public.loyalty_rewards,public.loyalty_reward_grants,public.loyalty_gifts,public.loyalty_gift_grants to authenticated;

notify pgrst, 'reload schema';
