-- BALI Stable 7 migration
-- Выполните файл один раз в Supabase SQL Editor.

alter table if exists public.menu_items add column if not exists image_url text not null default '';
alter table if exists public.menu_items add column if not exists portion_value numeric(10,2) not null default 0;
alter table if exists public.menu_items add column if not exists portion_unit text not null default 'g';

alter table if exists public.events add column if not exists seating_template_id text not null default '';
alter table if exists public.events add column if not exists qr_token text not null default '';
alter table if exists public.events add column if not exists qr_created_at timestamptz;

create table if not exists public.chip_requests (
  id text primary key,
  user_key text not null,
  telegram_id text,
  name text not null default 'Гость BALI',
  phone text not null default '',
  telegram text not null default '',
  quantity integer not null check (quantity > 0),
  points_cost integer not null check (points_cost > 0),
  rate_points integer not null check (rate_points > 0),
  status text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by text not null default '',
  cancelled_at timestamptz,
  cancelled_by text not null default '',
  refund_at timestamptz
);

create index if not exists chip_requests_status_created_idx on public.chip_requests(status, created_at desc);
create index if not exists chip_requests_user_key_idx on public.chip_requests(user_key);

alter table public.chip_requests enable row level security;

drop policy if exists "guest create chip request" on public.chip_requests;
create policy "guest create chip request"
on public.chip_requests
for insert
to anon
with check (
  status = 'pending'
  and quantity > 0
  and points_cost > 0
  and rate_points > 0
  and fulfilled_at is null
  and cancelled_at is null
);

drop policy if exists "staff manage chip requests" on public.chip_requests;
create policy "staff manage chip requests"
on public.chip_requests
for all
to authenticated
using (true)
with check (true);

grant insert on public.chip_requests to anon;
grant select, insert, update, delete on public.chip_requests to authenticated;

-- Включает доставку новых заявок через Supabase Realtime, если публикация уже существует.
do $$
begin
  alter publication supabase_realtime add table public.chip_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
