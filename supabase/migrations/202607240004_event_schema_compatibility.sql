-- Align new production tables with the original BALI schema, where events.id is text.

alter table public.events add column if not exists event_end_date date;
alter table public.events add column if not exists event_end_time time not null default '06:00';
alter table public.events add column if not exists qr_token text;
alter table public.events add column if not exists qr_created_at timestamptz;
alter table public.events add column if not exists updated_at timestamptz not null default now();

alter table public.reviews alter column event_id type text using event_id::text;
alter table public.event_checkins alter column event_id type text using event_id::text;
alter table public.event_history alter column event_id type text using event_id::text;

alter table public.customers add column if not exists telegram_id bigint;
create index if not exists customers_telegram_id_idx on public.customers(telegram_id);
create index if not exists events_qr_token_idx on public.events(qr_token) where qr_token is not null;

notify pgrst, 'reload schema';
