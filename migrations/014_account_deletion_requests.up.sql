create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete restrict,
  reason text not null default '',
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'cancelled', 'failed')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_deletion_requests_user_idx
  on public.account_deletion_requests(user_key, requested_at desc);

alter table public.account_deletion_requests enable row level security;
