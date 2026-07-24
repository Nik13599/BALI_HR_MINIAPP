create extension if not exists pgcrypto;

create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  action text not null unique,
  title text not null,
  description text not null default '',
  points integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_rules add column if not exists action text;
alter table public.loyalty_rules add column if not exists title text not null default 'Правило BALI';
alter table public.loyalty_rules add column if not exists description text not null default '';
alter table public.loyalty_rules add column if not exists points integer not null default 0;
alter table public.loyalty_rules add column if not exists active boolean not null default true;
alter table public.loyalty_rules add column if not exists created_at timestamptz not null default now();
alter table public.loyalty_rules add column if not exists updated_at timestamptz not null default now();

alter table public.loyalty_rules enable row level security;
drop policy if exists loyalty_rules_public_read on public.loyalty_rules;
create policy loyalty_rules_public_read on public.loyalty_rules for select to anon using (active = true);
drop policy if exists loyalty_rules_admin_all on public.loyalty_rules;
create policy loyalty_rules_admin_all on public.loyalty_rules for all to authenticated using (true) with check (true);

insert into public.loyalty_rules (action, title, description, points, active)
values
  ('event_checkin', 'Посещение мероприятия', 'Начисление после подтверждённого входа по QR-коду.', 100, true),
  ('review', 'Отзыв после посещения', 'Начисление после публикации доступного отзыва.', 50, true),
  ('event_share', 'Поделиться событием', 'Начисление за подтверждённую публикацию события.', 10, true),
  ('referral', 'Приглашение друга', 'Начисление после первого входа приглашённого пользователя.', 10, true)
on conflict (action) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  active = excluded.active,
  updated_at = now();

-- Пользовательский каталог теперь выдаётся только Telegram-проверенной Edge Function.
-- Публичный SELECT всей app_users раскрывал бы телефоны и другие закрытые поля.
drop policy if exists app_users_public_read on public.app_users;
drop policy if exists app_users_anon_read on public.app_users;

create index if not exists loyalty_rules_action_active_idx on public.loyalty_rules(action, active);
notify pgrst, 'reload schema';
