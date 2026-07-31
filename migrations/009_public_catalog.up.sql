create table if not exists public.menu_catalog_items (
  id text primary key default gen_random_uuid()::text,
  category text not null default 'Другое',
  name text not null,
  description text not null default '',
  image_url text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.menu_items') is not null
     and (
       select count(*) = 7
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'menu_items'
          and column_name in (
            'id', 'category', 'name', 'description', 'price', 'active', 'sort_order'
          )
     ) then
    execute $copy$
      insert into public.menu_catalog_items(
        id, category, name, description, price, active, sort_order
      )
      select id, category, name, description, price, active, sort_order
        from public.menu_items
      on conflict (id) do nothing
    $copy$;
  end if;
end;
$$;

create table if not exists public.venue_content (
  id text primary key default 'venue-main',
  title text not null default 'BALI',
  description text not null default '',
  formats text not null default '',
  media jsonb not null default '[]'::jsonb,
  contact_configuration jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.venue_content(id, title)
values ('venue-main', 'BALI Nightclub')
on conflict (id) do nothing;

create table if not exists public.venue_reviews (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected', 'archived')),
  moderated_by_admin_id uuid references public.admin_users(id) on delete set null,
  moderated_at timestamptz,
  moderation_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_reviews_status_created_idx
  on public.venue_reviews(status, created_at desc);

alter table public.menu_catalog_items enable row level security;
alter table public.venue_content enable row level security;
alter table public.venue_reviews enable row level security;
