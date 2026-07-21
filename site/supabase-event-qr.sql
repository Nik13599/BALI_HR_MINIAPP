-- BALI event QR check-in migration
-- Run once in Supabase SQL Editor after the base schema.

alter table public.events
  add column if not exists qr_token text,
  add column if not exists qr_created_at timestamptz;

create table if not exists public.event_checkins (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_title text not null default '',
  event_date date,
  event_time text,
  user_key text not null,
  telegram_id text,
  telegram text,
  name text not null default 'Гость BALI',
  phone text,
  checked_in_at timestamptz not null default now(),
  source text not null default 'event_qr',
  reward integer not null default 0,
  xp integer not null default 0,
  visits integer not null default 0,
  level text,
  unique(event_id, user_key)
);

create index if not exists event_checkins_event_idx
  on public.event_checkins(event_id, checked_in_at desc);

alter table public.event_checkins enable row level security;

drop policy if exists "Authenticated admins read event checkins" on public.event_checkins;
create policy "Authenticated admins read event checkins"
  on public.event_checkins for select
  to authenticated
  using (true);

drop policy if exists "Authenticated admins manage event checkins" on public.event_checkins;
create policy "Authenticated admins manage event checkins"
  on public.event_checkins for all
  to authenticated
  using (true)
  with check (true);

create or replace function public.check_in_event_beta(
  p_event_id text,
  p_qr_token text,
  p_user_key text,
  p_telegram_id text default null,
  p_telegram text default '',
  p_name text default 'Гость BALI',
  p_phone text default '',
  p_reward integer default 0,
  p_xp integer default 0,
  p_visits integer default 0,
  p_level text default ''
)
returns public.event_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_row public.event_checkins;
begin
  select * into v_event
  from public.events
  where id = p_event_id
    and active is not false
    and qr_token = p_qr_token;

  if v_event.id is null then
    raise exception 'INVALID_EVENT_QR';
  end if;

  insert into public.event_checkins (
    id, event_id, event_title, event_date, event_time,
    user_key, telegram_id, telegram, name, phone,
    source, reward, xp, visits, level
  ) values (
    'checkin-' || p_event_id || '-' || regexp_replace(p_user_key, '[^a-zA-Z0-9_-]', '-', 'g'),
    v_event.id, v_event.title, v_event.event_date, v_event.event_time,
    p_user_key, nullif(p_telegram_id, ''), coalesce(p_telegram, ''),
    coalesce(nullif(p_name, ''), 'Гость BALI'), coalesce(p_phone, ''),
    'event_qr', greatest(coalesce(p_reward, 0), 0), greatest(coalesce(p_xp, 0), 0),
    greatest(coalesce(p_visits, 0), 0), coalesce(p_level, '')
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'ALREADY_CHECKED_IN';
end;
$$;

grant execute on function public.check_in_event_beta(
  text, text, text, text, text, text, text, integer, integer, integer, text
) to anon, authenticated;
