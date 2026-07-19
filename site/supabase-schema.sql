-- BALI Guest App + Control Center
-- Выполните этот файл в Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  category text not null,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  event_date date not null,
  event_time time not null default '23:00',
  description text not null default '',
  image_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hall_tables (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  seats integer not null default 4 check (seats > 0),
  x numeric(6,2) not null default 50,
  y numeric(6,2) not null default 50,
  shape text not null default 'round' check (shape in ('round','square','vip')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text not null unique,
  telegram text not null default '',
  notes text not null default '',
  visits integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id text primary key default gen_random_uuid()::text,
  booking_date date not null,
  booking_time time not null default '23:00',
  table_id text not null references public.hall_tables(id) on delete restrict,
  table_name text not null default '',
  customer_id text references public.customers(id) on delete set null,
  customer_name text not null,
  phone text not null,
  guests integer not null default 2 check (guests > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','seated','completed','cancelled')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on public.bookings(booking_date);
create index if not exists bookings_table_date_idx on public.bookings(table_id, booking_date);
create index if not exists customers_phone_idx on public.customers(phone);

alter table public.menu_items enable row level security;
alter table public.events enable row level security;
alter table public.hall_tables enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;

-- Публичная часть приложения видит только опубликованный контент и активные столы.
drop policy if exists "public read active menu" on public.menu_items;
create policy "public read active menu" on public.menu_items for select to anon using (active = true);
drop policy if exists "public read active events" on public.events;
create policy "public read active events" on public.events for select to anon using (active = true);
drop policy if exists "public read active tables" on public.hall_tables;
create policy "public read active tables" on public.hall_tables for select to anon using (active = true);

-- Любой пользователь, вошедший через Supabase Auth, считается сотрудником панели.
-- Не создавайте публичную регистрацию; добавляйте администраторов вручную в Authentication > Users.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_items' and policyname='staff manage menu') then
    create policy "staff manage menu" on public.menu_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='events' and policyname='staff manage events') then
    create policy "staff manage events" on public.events for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hall_tables' and policyname='staff manage tables') then
    create policy "staff manage tables" on public.hall_tables for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customers' and policyname='staff manage customers') then
    create policy "staff manage customers" on public.customers for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='staff manage bookings') then
    create policy "staff manage bookings" on public.bookings for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Гость видит только свободен ли стол. Персональные данные брони не возвращаются.
create or replace function public.get_table_availability(p_date date)
returns table (
  id text,
  name text,
  seats integer,
  x numeric,
  y numeric,
  shape text,
  active boolean,
  available boolean,
  booking_status text
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.seats,
    t.x,
    t.y,
    t.shape,
    t.active,
    not exists (
      select 1 from public.bookings b
      where b.table_id = t.id
        and b.booking_date = p_date
        and b.status not in ('cancelled','completed')
    ) as available,
    (
      select b.status from public.bookings b
      where b.table_id = t.id
        and b.booking_date = p_date
        and b.status not in ('cancelled','completed')
      order by b.created_at desc limit 1
    ) as booking_status
  from public.hall_tables t
  where t.active = true
  order by t.name;
$$;

-- Безопасное создание брони из гостевого приложения.
create or replace function public.create_public_booking(
  p_booking_date date,
  p_booking_time time,
  p_table_id text,
  p_name text,
  p_phone text,
  p_guests integer,
  p_telegram text default '',
  p_comment text default ''
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
  v_table public.hall_tables;
  v_booking public.bookings;
begin
  if exists (
    select 1 from public.bookings
    where table_id = p_table_id
      and booking_date = p_booking_date
      and status not in ('cancelled','completed')
  ) then
    raise exception 'Этот стол уже забронирован на выбранную дату';
  end if;

  select * into v_table from public.hall_tables where id = p_table_id and active = true;
  if v_table.id is null then raise exception 'Стол не найден'; end if;

  insert into public.customers(name, phone, telegram)
  values (p_name, regexp_replace(p_phone, '\s+', '', 'g'), coalesce(p_telegram,''))
  on conflict (phone) do update set
    name = excluded.name,
    telegram = case when excluded.telegram <> '' then excluded.telegram else public.customers.telegram end,
    updated_at = now()
  returning * into v_customer;

  insert into public.bookings(
    booking_date, booking_time, table_id, table_name, customer_id,
    customer_name, phone, guests, status, comment
  ) values (
    p_booking_date, coalesce(p_booking_time,'23:00'), p_table_id, v_table.name, v_customer.id,
    p_name, regexp_replace(p_phone, '\s+', '', 'g'), greatest(p_guests,1), 'pending', coalesce(p_comment,'')
  ) returning * into v_booking;

  return v_booking;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.menu_items, public.events, public.hall_tables to anon;
grant select, insert, update, delete on public.menu_items, public.events, public.hall_tables, public.customers, public.bookings to authenticated;
grant execute on function public.get_table_availability(date) to anon, authenticated;
grant execute on function public.create_public_booking(date,time,text,text,text,integer,text,text) to anon, authenticated;

-- Стартовая рассадка. Выполняется только если столов ещё нет.
insert into public.hall_tables(id,name,seats,x,y,shape,active)
select * from (values
  ('table-1','Стол 1',4,12,18,'round',true),
  ('table-2','Стол 2',4,40,18,'round',true),
  ('table-3','Стол 3',6,68,18,'round',true),
  ('table-4','Стол 4',4,15,52,'square',true),
  ('table-5','Стол 5',6,43,52,'square',true),
  ('table-6','VIP 1',8,72,50,'vip',true),
  ('table-7','VIP 2',10,70,76,'vip',true)
) as seed(id,name,seats,x,y,shape,active)
where not exists (select 1 from public.hall_tables);
