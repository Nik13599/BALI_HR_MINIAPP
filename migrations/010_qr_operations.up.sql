create table if not exists public.booking_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique references public.booking_records(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_admin_id uuid references public.admin_users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists booking_qr_tokens_expiry_idx
  on public.booking_qr_tokens(expires_at)
  where redeemed_at is null and revoked_at is null;

alter table public.booking_qr_tokens enable row level security;
