create table if not exists public.mobile_credentials (
  app_user_key text primary key references public.app_users(user_key) on delete cascade,
  phone text not null unique,
  telegram_username text not null,
  password_hash text not null,
  must_change_password boolean not null default true,
  password_issued_at timestamptz not null default now(),
  password_changed_at timestamptz,
  last_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_access_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('registration','reset')),
  phone text not null,
  telegram_username text not null,
  display_name text not null default '',
  app_user_key text references public.app_users(user_key) on delete set null,
  status text not null default 'pending' check (status in ('pending','issued','completed','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  issued_at timestamptz,
  completed_at timestamptz,
  issued_by_admin_id uuid references public.admin_users(id) on delete set null,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists mobile_access_pending_unique
  on public.mobile_access_requests(phone, request_type)
  where status = 'pending';
create index if not exists mobile_access_requests_status_idx
  on public.mobile_access_requests(status, requested_at desc);
create index if not exists mobile_credentials_telegram_idx
  on public.mobile_credentials(lower(telegram_username));

alter table public.user_sessions
  add column if not exists auth_method text not null default 'telegram'
    check (auth_method in ('telegram','mobile'));

insert into public.rate_limit_settings(bucket, limit_count, window_seconds) values
  ('auth.mobile_request', 5, 3600),
  ('auth.mobile_login', 10, 300),
  ('auth.mobile_reset', 5, 3600),
  ('auth.mobile_password', 10, 600)
on conflict (bucket) do nothing;

drop trigger if exists bali_set_updated_at on public.mobile_credentials;
create trigger bali_set_updated_at before update on public.mobile_credentials
for each row execute function public.bali_set_updated_at();

drop trigger if exists bali_set_updated_at on public.mobile_access_requests;
create trigger bali_set_updated_at before update on public.mobile_access_requests
for each row execute function public.bali_set_updated_at();

alter table public.mobile_credentials enable row level security;
alter table public.mobile_access_requests enable row level security;
revoke all on public.mobile_credentials, public.mobile_access_requests from public;
