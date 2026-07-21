-- BALI Stable 12: реестр пользователей приложения для метрики «Клиентов в базе всего»
-- Выполните один раз в Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  user_key text primary key,
  telegram_id text,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  avatar text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  opens integer not null default 1 check (opens > 0)
);

create index if not exists app_users_last_seen_idx on public.app_users(last_seen_at desc);
create index if not exists app_users_telegram_idx on public.app_users(telegram_id);
create index if not exists app_users_phone_idx on public.app_users(phone);

alter table public.app_users enable row level security;

drop policy if exists "staff read app users" on public.app_users;
create policy "staff read app users"
on public.app_users
for select
to authenticated
using (true);

drop policy if exists "staff manage app users" on public.app_users;
create policy "staff manage app users"
on public.app_users
for all
to authenticated
using (true)
with check (true);

create or replace function public.register_app_user(
  p_user_key text,
  p_telegram_id text default null,
  p_name text default 'Гость BALI',
  p_username text default '',
  p_phone text default '',
  p_avatar text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_user_key), '') = '' then
    raise exception 'user_key is required';
  end if;

  insert into public.app_users(
    user_key, telegram_id, name, username, phone, avatar,
    first_seen_at, last_seen_at, opens
  ) values (
    p_user_key,
    nullif(p_telegram_id, ''),
    coalesce(nullif(trim(p_name), ''), 'Гость BALI'),
    coalesce(p_username, ''),
    regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
    coalesce(p_avatar, ''),
    now(), now(), 1
  )
  on conflict (user_key) do update set
    telegram_id = coalesce(excluded.telegram_id, public.app_users.telegram_id),
    name = case when excluded.name <> '' then excluded.name else public.app_users.name end,
    username = case when excluded.username <> '' then excluded.username else public.app_users.username end,
    phone = case when excluded.phone <> '' then excluded.phone else public.app_users.phone end,
    avatar = case when excluded.avatar <> '' then excluded.avatar else public.app_users.avatar end,
    last_seen_at = now(),
    opens = public.app_users.opens + 1;
end;
$$;

revoke all on function public.register_app_user(text,text,text,text,text,text) from public;
grant execute on function public.register_app_user(text,text,text,text,text,text) to anon, authenticated;
grant select, insert, update, delete on public.app_users to authenticated;
