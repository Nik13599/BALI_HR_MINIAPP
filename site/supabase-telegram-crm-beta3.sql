-- BALI Beta3: Telegram CRM migration
-- Run after supabase-schema.sql.
-- Production note: Telegram initData must be validated on a trusted server or Edge Function
-- before calling database operations for a specific Telegram user.

alter table public.customers alter column phone drop not null;
alter table public.customers add column if not exists client_key text;
alter table public.customers add column if not exists owner_key text;
alter table public.customers add column if not exists telegram_id text;
alter table public.customers add column if not exists telegram_username text not null default '';
alter table public.customers add column if not exists first_name text not null default '';
alter table public.customers add column if not exists last_name text not null default '';
alter table public.customers add column if not exists language_code text not null default '';
alter table public.customers add column if not exists photo_url text not null default '';
alter table public.customers add column if not exists is_premium boolean not null default false;
alter table public.customers add column if not exists points_balance integer not null default 0;
alter table public.customers add column if not exists app_opens integer not null default 0;
alter table public.customers add column if not exists first_seen_at timestamptz not null default now();
alter table public.customers add column if not exists last_opened_at timestamptz;
alter table public.customers add column if not exists phone_source text not null default '';

create unique index if not exists customers_telegram_id_unique
  on public.customers(telegram_id) where telegram_id is not null;
create unique index if not exists customers_client_key_unique
  on public.customers(client_key) where client_key is not null;

alter table public.bookings add column if not exists client_key text;
alter table public.bookings add column if not exists owner_key text;
alter table public.bookings add column if not exists telegram_id text;
alter table public.bookings add column if not exists telegram_username text not null default '';
alter table public.bookings add column if not exists booking_reference text;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancelled_by text not null default '';

create index if not exists bookings_owner_key_idx on public.bookings(owner_key);
create index if not exists bookings_telegram_id_idx on public.bookings(telegram_id);

-- Client balances and visit history should be changed only by authenticated staff
-- or a server function that has validated Telegram initData.
revoke insert, update, delete on public.customers from anon;
revoke insert, update, delete on public.bookings from anon;
