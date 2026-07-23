-- BALI Minsk production schema
-- Run once in Supabase SQL Editor. No demo rows are inserted.
create extension if not exists pgcrypto;

create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  category text not null default 'Другое', name text not null, description text not null default '',
  price numeric(10,2) not null default 0, image_url text not null default '', active boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  title text not null, event_date date not null, event_time time not null default '23:00',
  event_end_date date, event_end_time time not null default '06:00', description text not null default '',
  details_description text not null default '', image_url text not null default '', active boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hall_tables (
  id text primary key default gen_random_uuid()::text, name text not null, seats integer not null default 4 check(seats>0),
  x numeric(6,2) not null default 50, y numeric(6,2) not null default 50,
  shape text not null default 'round' check(shape in ('round','square','vip')), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text, name text not null, phone text not null unique,
  telegram text not null default '', telegram_id bigint, birth_date date, notes text not null default '', visits integer not null default 0,
  total_spent numeric(12,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id text primary key default gen_random_uuid()::text, event_id text references public.events(id) on delete set null,
  booking_date date not null, booking_time time not null default '23:00', table_id text references public.hall_tables(id) on delete set null,
  table_name text not null default '', customer_id text references public.customers(id) on delete set null,
  customer_name text not null, phone text not null, telegram text not null default '', guests integer not null default 2 check(guests>0),
  status text not null default 'pending' check(status in ('pending','confirmed','seated','completed','cancelled')),
  comment text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  user_key text primary key, telegram_id bigint unique, name text not null default 'Гость BALI', username text not null default '',
  phone text not null default '', avatar text not null default '', birth_date date, gender text not null default 'unspecified',
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), opens integer not null default 1
);
create table if not exists public.event_checkins (
  id text primary key default gen_random_uuid()::text, event_id text references public.events(id) on delete set null,
  event_title text not null default 'Событие BALI', user_key text references public.app_users(user_key) on delete set null,
  telegram_id bigint, name text not null default 'Гость BALI', checked_in_at timestamptz not null default now(),
  left_at timestamptz, presence_status text not null default 'inside', reward integer not null default 0, xp integer not null default 0
);
create table if not exists public.chip_requests (
  id text primary key, lookup_token text not null unique, user_key text, telegram_id bigint, name text not null default 'Гость BALI',
  phone text not null default '', telegram text not null default '', quantity integer not null, points_cost integer not null,
  rate_points integer not null, status text not null default 'pending' check(status in ('pending','fulfilled','cancelled')),
  created_at timestamptz not null default now(), fulfilled_at timestamptz, fulfilled_by text, cancelled_at timestamptz,
  cancelled_by text, refund_at timestamptz
);

create table if not exists public.telegram_conversations (
  id uuid primary key default gen_random_uuid(), telegram_user_id bigint not null unique, telegram_chat_id bigint not null unique,
  first_name text not null default '', last_name text not null default '', username text not null default '', photo_url text not null default '',
  status text not null default 'open' check(status in ('open','closed','blocked')), unread_admin integer not null default 0,
  unread_user integer not null default 0, last_message_text text not null default '', last_message_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.telegram_conversations(id) on delete cascade,
  direction text not null check(direction in ('user','admin','system')), admin_user_id uuid,
  telegram_message_id bigint, message_type text not null default 'text', text text not null default '', payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'received', created_at timestamptz not null default now(), read_at timestamptz
);
create unique index if not exists telegram_message_chat_unique on public.telegram_messages(conversation_id,telegram_message_id) where telegram_message_id is not null;

create table if not exists public.points_accounts (
  user_key text primary key, telegram_id bigint, name text not null default 'Гость BALI', phone text not null default '', telegram text not null default '',
  balance integer not null default 0 check(balance>=0), updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(), user_key text not null references public.points_accounts(user_key) on delete cascade,
  type text not null, title text not null, amount integer not null, action_key text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists points_action_unique on public.points_ledger(user_key,action_key) where action_key is not null;
create table if not exists public.vip_plans (
  id text primary key, name text not null, days integer not null default 30, points_price integer not null default 0,
  discount integer not null default 0, points_multiplier numeric(6,2) not null default 1, active boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.vip_memberships (
  id uuid primary key default gen_random_uuid(), user_key text not null references public.points_accounts(user_key) on delete cascade,
  plan_id text not null references public.vip_plans(id) on delete restrict, plan_name text not null,
  starts_at timestamptz not null default now(), expires_at timestamptz not null, source text not null default 'admin', note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_share_tokens (
  token uuid primary key default gen_random_uuid(), kind text not null check(kind in ('referral','event')),
  inviter_user_key text not null, inviter_telegram_id bigint not null, event_id text references public.events(id) on delete set null,
  share_confirmed_at timestamptz, base_reward_granted_at timestamptz, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days'
);
create table if not exists public.loyalty_conversions (
  id uuid primary key default gen_random_uuid(), token uuid not null references public.loyalty_share_tokens(token) on delete cascade,
  invited_user_key text not null, invited_telegram_id bigint not null, reward_amount integer not null,
  created_at timestamptz not null default now(), unique(token,invited_user_key)
);

create index if not exists bookings_date_idx on public.bookings(booking_date);
create index if not exists checkins_date_idx on public.event_checkins(checked_in_at);
create index if not exists app_users_birth_idx on public.app_users(birth_date);
create index if not exists messages_conversation_idx on public.telegram_messages(conversation_id,created_at);
create index if not exists ledger_user_idx on public.points_ledger(user_key,created_at desc);

create or replace function public.register_app_user(
  p_user_key text, p_telegram_id text, p_name text, p_username text, p_phone text, p_avatar text,
  p_birth_date date default null, p_gender text default 'unspecified'
) returns public.app_users language plpgsql security definer set search_path=public as $$
declare v public.app_users;
begin
  insert into public.app_users(user_key,telegram_id,name,username,phone,avatar,birth_date,gender)
  values(p_user_key,nullif(p_telegram_id,'')::bigint,coalesce(nullif(p_name,''),'Гость BALI'),coalesce(p_username,''),coalesce(p_phone,''),coalesce(p_avatar,''),p_birth_date,coalesce(p_gender,'unspecified'))
  on conflict(user_key) do update set telegram_id=excluded.telegram_id,name=excluded.name,username=excluded.username,
    phone=case when excluded.phone<>'' then excluded.phone else app_users.phone end,
    avatar=case when excluded.avatar<>'' then excluded.avatar else app_users.avatar end,
    birth_date=coalesce(excluded.birth_date,app_users.birth_date),gender=excluded.gender,last_seen_at=now(),opens=app_users.opens+1
  returning * into v;
  insert into public.points_accounts(user_key,telegram_id,name,phone,telegram)
  values(v.user_key,v.telegram_id,v.name,v.phone,v.username)
  on conflict(user_key) do update set telegram_id=excluded.telegram_id,name=excluded.name,phone=excluded.phone,telegram=excluded.telegram,updated_at=now();
  return v;
end $$;

create or replace function public.get_table_availability(p_date date)
returns table(id text,name text,seats integer,x numeric,y numeric,shape text,active boolean,available boolean,booking_status text)
language sql security definer set search_path=public as $$
  select t.id,t.name,t.seats,t.x,t.y,t.shape,t.active,
    not exists(select 1 from public.bookings b where b.table_id=t.id and b.booking_date=p_date and b.status not in ('cancelled','completed')),
    (select b.status from public.bookings b where b.table_id=t.id and b.booking_date=p_date and b.status not in ('cancelled','completed') order by b.created_at desc limit 1)
  from public.hall_tables t where t.active=true order by t.name;
$$;

create or replace function public.create_public_booking(
  p_booking_date date,p_booking_time time,p_table_id text,p_name text,p_phone text,p_guests integer,
  p_telegram text default '',p_comment text default '',p_event_id text default null
) returns public.bookings language plpgsql security definer set search_path=public as $$
declare c public.customers; t public.hall_tables; b public.bookings;
begin
  select * into t from public.hall_tables where id=p_table_id and active=true;
  if t.id is null then raise exception 'Стол не найден'; end if;
  if exists(select 1 from public.bookings where table_id=p_table_id and booking_date=p_booking_date and status not in ('cancelled','completed')) then raise exception 'Этот стол уже забронирован'; end if;
  insert into public.customers(name,phone,telegram) values(p_name,regexp_replace(p_phone,'\s+','','g'),coalesce(p_telegram,''))
  on conflict(phone) do update set name=excluded.name,telegram=case when excluded.telegram<>'' then excluded.telegram else customers.telegram end,updated_at=now()
  returning * into c;
  insert into public.bookings(event_id,booking_date,booking_time,table_id,table_name,customer_id,customer_name,phone,telegram,guests,status,comment)
  values(nullif(p_event_id,''),p_booking_date,coalesce(p_booking_time,'23:00'),p_table_id,t.name,c.id,p_name,regexp_replace(p_phone,'\s+','','g'),coalesce(p_telegram,''),greatest(p_guests,1),'pending',coalesce(p_comment,'')) returning * into b;
  return b;
end $$;

create or replace function public.admin_adjust_points(p_user_key text,p_delta integer,p_note text default 'Корректировка администратора')
returns integer language plpgsql security definer set search_path=public as $$
declare v integer;
begin
  if auth.uid() is null then raise exception 'Требуется вход администратора'; end if;
  insert into public.points_accounts(user_key,balance) values(p_user_key,greatest(p_delta,0)) on conflict(user_key) do nothing;
  update public.points_accounts set balance=greatest(0,balance+p_delta),updated_at=now() where user_key=p_user_key returning balance into v;
  insert into public.points_ledger(user_key,type,title,amount) values(p_user_key,case when p_delta>=0 then 'admin_add' else 'admin_remove' end,p_note,p_delta);
  return v;
end $$;

create or replace function public.admin_set_vip(p_user_key text,p_plan_id text,p_days integer default 30)
returns public.vip_memberships language plpgsql security definer set search_path=public as $$
declare p public.vip_plans; v public.vip_memberships;
begin
  if auth.uid() is null then raise exception 'Требуется вход администратора'; end if;
  select * into p from public.vip_plans where id=p_plan_id and active=true;
  if p.id is null then raise exception 'VIP-план не найден'; end if;
  insert into public.vip_memberships(user_key,plan_id,plan_name,expires_at,source)
  values(p_user_key,p.id,p.name,now()+make_interval(days=>greatest(p_days,1)),'admin') returning * into v;
  return v;
end $$;

alter table public.menu_items enable row level security; alter table public.events enable row level security;
alter table public.hall_tables enable row level security; alter table public.customers enable row level security;
alter table public.bookings enable row level security; alter table public.app_users enable row level security;
alter table public.event_checkins enable row level security; alter table public.chip_requests enable row level security;
alter table public.telegram_conversations enable row level security; alter table public.telegram_messages enable row level security;
alter table public.points_accounts enable row level security; alter table public.points_ledger enable row level security;
alter table public.vip_plans enable row level security; alter table public.vip_memberships enable row level security;
alter table public.loyalty_share_tokens enable row level security; alter table public.loyalty_conversions enable row level security;

drop policy if exists "public active menu" on public.menu_items; create policy "public active menu" on public.menu_items for select to anon using(active=true);
drop policy if exists "public active events" on public.events; create policy "public active events" on public.events for select to anon using(active=true);
drop policy if exists "public active tables" on public.hall_tables; create policy "public active tables" on public.hall_tables for select to anon using(active=true);
drop policy if exists "public vip plans" on public.vip_plans; create policy "public vip plans" on public.vip_plans for select to anon using(active=true);

-- Authenticated Supabase users are BALI administrators. End-user writes go only through security-definer RPCs or Edge Functions.
do $$ declare t text; begin
  foreach t in array array['menu_items','events','hall_tables','customers','bookings','app_users','event_checkins','chip_requests','telegram_conversations','telegram_messages','points_accounts','points_ledger','vip_plans','vip_memberships','loyalty_share_tokens','loyalty_conversions'] loop
    execute format('drop policy if exists "staff manage %1$s" on public.%1$I',t);
    execute format('create policy "staff manage %1$s" on public.%1$I for all to authenticated using(true) with check(true)',t);
  end loop;
end $$;

grant usage on schema public to anon,authenticated;
grant select on public.menu_items,public.events,public.hall_tables,public.vip_plans to anon;
grant execute on function public.register_app_user(text,text,text,text,text,text,date,text) to anon,authenticated;
grant execute on function public.get_table_availability(date) to anon,authenticated;
grant execute on function public.create_public_booking(date,time,text,text,text,integer,text,text,text) to anon,authenticated;
grant execute on function public.admin_adjust_points(text,integer,text) to authenticated;
grant execute on function public.admin_set_vip(text,text,integer) to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;

insert into public.vip_plans(id,name,days,points_price,discount,points_multiplier,active,sort_order) values
('vip','VIP',30,2500,10,1.2,true,1),('black','BLACK',30,5000,15,1.5,true,2),('legend','LEGEND',30,9000,20,2,true,3)
on conflict(id) do update set name=excluded.name,days=excluded.days,points_price=excluded.points_price,discount=excluded.discount,points_multiplier=excluded.points_multiplier,active=excluded.active,sort_order=excluded.sort_order;

-- Enable realtime for messaging when not already present.
do $$ begin
  begin alter publication supabase_realtime add table public.telegram_conversations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.telegram_messages; exception when duplicate_object then null; end;
end $$;