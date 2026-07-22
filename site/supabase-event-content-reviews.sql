-- BALI event details, performers, venue media and guest reviews
-- Выполните после основного файла supabase-schema.sql в Supabase SQL Editor.

alter table public.events
  add column if not exists details_description text not null default '',
  add column if not exists performers jsonb not null default '[]'::jsonb;

create table if not exists public.venue_content (
  id text primary key default 'venue-main',
  title text not null default 'Площадка BALI',
  description text not null default '',
  formats text not null default '',
  media jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id text primary key default gen_random_uuid()::text,
  user_key text not null default '',
  user_name text not null default 'Гость BALI',
  telegram text not null default '',
  event_id text not null default '',
  event_title text not null default '',
  type text not null default 'other' check (type in ('event','improvement','party','artist','venue','other')),
  rating integer check (rating is null or rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new' check (status in ('new','reviewed','planned','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_created_at_idx on public.reviews(created_at desc);
create index if not exists reviews_status_idx on public.reviews(status);
create index if not exists reviews_event_id_idx on public.reviews(event_id);

alter table public.venue_content enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "public read active venue content" on public.venue_content;
create policy "public read active venue content"
  on public.venue_content for select to anon
  using (active = true);

drop policy if exists "staff manage venue content" on public.venue_content;
create policy "staff manage venue content"
  on public.venue_content for all to authenticated
  using (true) with check (true);

drop policy if exists "public submit reviews" on public.reviews;
create policy "public submit reviews"
  on public.reviews for insert to anon
  with check (status = 'new' and char_length(message) between 1 and 2000);

drop policy if exists "staff manage reviews" on public.reviews;
create policy "staff manage reviews"
  on public.reviews for all to authenticated
  using (true) with check (true);

insert into public.venue_content (id, title, description, formats, media, active)
values (
  'venue-main',
  'Площадка BALI',
  'BALI — многофункциональная клубная площадка в центре Минска с танцполом, большими экранами, профессиональным звуком, контактным баром, кухней, кальянами и комфортной рассадкой.',
  'Клубные вечеринки, концерты, DJ-сеты, спортивные трансляции, закрытые мероприятия, презентации, дни рождения и корпоративные события.',
  '[]'::jsonb,
  true
)
on conflict (id) do nothing;