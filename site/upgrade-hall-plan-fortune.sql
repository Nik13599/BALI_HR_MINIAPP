-- BALI: загружаемая схема зала + колесо фортуны
-- Выполните после site/supabase-schema.sql в Supabase SQL Editor.

alter table public.hall_tables add column if not exists zone text not null default '';
alter table public.hall_tables add column if not exists description text not null default '';
alter table public.hall_tables add column if not exists deposit numeric(10,2) not null default 0 check (deposit >= 0);

create table if not exists public.hall_settings (
  id text primary key default 'main',
  background_url text not null default '',
  aspect_ratio numeric(10,4) not null default 1 check (aspect_ratio > 0),
  updated_at timestamptz not null default now()
);

insert into public.hall_settings(id, background_url, aspect_ratio)
values ('main', '', 1)
on conflict (id) do nothing;

alter table public.hall_settings enable row level security;

drop policy if exists "public read hall settings" on public.hall_settings;
create policy "public read hall settings"
  on public.hall_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "staff manage hall settings" on public.hall_settings;
create policy "staff manage hall settings"
  on public.hall_settings for all
  to authenticated
  using (true)
  with check (true);

grant select on public.hall_settings to anon, authenticated;
grant insert, update, delete on public.hall_settings to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'hall-plans',
  'hall-plans',
  true,
  12582912,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read hall plan files" on storage.objects;
create policy "public read hall plan files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'hall-plans');

drop policy if exists "staff upload hall plan files" on storage.objects;
create policy "staff upload hall plan files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'hall-plans');

drop policy if exists "staff update hall plan files" on storage.objects;
create policy "staff update hall plan files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'hall-plans')
  with check (bucket_id = 'hall-plans');

drop policy if exists "staff delete hall plan files" on storage.objects;
create policy "staff delete hall plan files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'hall-plans');

drop function if exists public.get_table_availability(date);

create function public.get_table_availability(p_date date)
returns table (
  id text,
  name text,
  seats integer,
  x numeric,
  y numeric,
  shape text,
  active boolean,
  zone text,
  description text,
  deposit numeric,
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
    t.zone,
    t.description,
    t.deposit,
    not exists (
      select 1
      from public.bookings b
      where b.table_id = t.id
        and b.booking_date = p_date
        and b.status not in ('cancelled','completed')
    ) as available,
    (
      select b.status
      from public.bookings b
      where b.table_id = t.id
        and b.booking_date = p_date
        and b.status not in ('cancelled','completed')
      order by b.created_at desc
      limit 1
    ) as booking_status
  from public.hall_tables t
  where t.active = true
  order by t.name;
$$;

grant execute on function public.get_table_availability(date) to anon, authenticated;

create table if not exists public.fortune_prizes (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  weight numeric(10,4) not null default 1 check (weight > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.fortune_codes (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  status text not null default 'active'
    check (status in ('active','used','revoked','expired')),
  expires_at timestamptz,
  used_at timestamptz,
  prize_id text references public.fortune_prizes(id) on delete set null,
  prize_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fortune_spins (
  id text primary key default gen_random_uuid()::text,
  code_id text not null references public.fortune_codes(id) on delete restrict,
  code text not null,
  prize_id text references public.fortune_prizes(id) on delete set null,
  prize_name text not null,
  telegram_id text not null default '',
  spun_at timestamptz not null default now()
);

create index if not exists fortune_codes_status_idx on public.fortune_codes(status);
create index if not exists fortune_codes_code_idx on public.fortune_codes(code);
create index if not exists fortune_spins_date_idx on public.fortune_spins(spun_at desc);

alter table public.fortune_prizes enable row level security;
alter table public.fortune_codes enable row level security;
alter table public.fortune_spins enable row level security;

drop policy if exists "public read active fortune prizes" on public.fortune_prizes;
create policy "public read active fortune prizes"
  on public.fortune_prizes for select
  to anon
  using (active = true);

drop policy if exists "authenticated read fortune prizes" on public.fortune_prizes;
create policy "authenticated read fortune prizes"
  on public.fortune_prizes for select
  to authenticated
  using (true);

drop policy if exists "staff manage fortune prizes" on public.fortune_prizes;
create policy "staff manage fortune prizes"
  on public.fortune_prizes for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "staff manage fortune codes" on public.fortune_codes;
create policy "staff manage fortune codes"
  on public.fortune_codes for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "staff manage fortune spins" on public.fortune_spins;
create policy "staff manage fortune spins"
  on public.fortune_spins for all
  to authenticated
  using (true)
  with check (true);

grant select on public.fortune_prizes to anon, authenticated;
grant insert, update, delete on public.fortune_prizes to authenticated;
grant select, insert, update, delete on public.fortune_codes, public.fortune_spins to authenticated;

insert into public.fortune_prizes(id, name, weight, active, sort_order)
values
  ('prize-beer', 'Пиво', 1, true, 1),
  ('prize-cocktail', 'Коктейль', 1, true, 2),
  ('prize-5-shots', '5 шотов', 1, true, 3),
  ('prize-10-shots', '10 шотов', 1, true, 4),
  ('prize-tequila', 'Текила', 1, true, 5),
  ('prize-nothing', 'Ничего', 1, true, 6)
on conflict (id) do nothing;

drop function if exists public.redeem_fortune_code(text, text);

create function public.redeem_fortune_code(
  p_code text,
  p_telegram_id text default ''
)
returns table (
  prize_id text,
  prize_name text,
  code text,
  spun_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.fortune_codes%rowtype;
  v_prize public.fortune_prizes%rowtype;
  v_total numeric;
  v_roll numeric;
  v_used_at timestamptz := now();
begin
  select *
  into v_code
  from public.fortune_codes
  where upper(fortune_codes.code) = upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'))
  for update;

  if not found then
    raise exception 'Код не найден';
  end if;

  if v_code.status <> 'active' then
    raise exception 'Этот код уже использован или отменён';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'Срок действия кода истёк';
  end if;

  select sum(weight)
  into v_total
  from public.fortune_prizes
  where active = true;

  if coalesce(v_total, 0) <= 0 then
    raise exception 'В колесе нет активных призов';
  end if;

  v_roll := random() * v_total;

  for v_prize in
    select *
    from public.fortune_prizes
    where active = true
    order by sort_order, id
  loop
    v_roll := v_roll - v_prize.weight;
    if v_roll <= 0 then
      exit;
    end if;
  end loop;

  if v_prize.id is null then
    select *
    into v_prize
    from public.fortune_prizes
    where active = true
    order by sort_order desc, id desc
    limit 1;
  end if;

  update public.fortune_codes
  set
    status = 'used',
    used_at = v_used_at,
    prize_id = v_prize.id,
    prize_name = v_prize.name
  where id = v_code.id;

  insert into public.fortune_spins(
    code_id,
    code,
    prize_id,
    prize_name,
    telegram_id,
    spun_at
  )
  values (
    v_code.id,
    v_code.code,
    v_prize.id,
    v_prize.name,
    coalesce(p_telegram_id, ''),
    v_used_at
  );

  return query
  select v_prize.id, v_prize.name, v_code.code, v_used_at;
end;
$$;

grant execute on function public.redeem_fortune_code(text, text) to anon, authenticated;
