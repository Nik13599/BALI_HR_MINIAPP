create table if not exists public.notification_preferences (
  user_key text primary key references public.app_users(user_key) on delete cascade,
  in_app_enabled boolean not null default true,
  telegram_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  disabled_types text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.notification_preferences(user_key, marketing_enabled)
select user_key, marketing_opt_in
from public.user_consents
on conflict (user_key) do nothing;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.app_users(user_key) on delete cascade,
  notification_type text not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 4000),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
  read_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_key, created_at desc);

create index if not exists notifications_status_created_idx
  on public.notifications(status, created_at);

create table if not exists public.telegram_delivery_log (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  campaign_recipient_id uuid,
  telegram_user_id bigint not null check (telegram_user_id > 0),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  provider_message_id text not null default '',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text not null default '',
  deduplication_key text not null unique,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  segment jsonb not null default '{}'::jsonb,
  message_text text not null check (char_length(message_text) between 1 and 4000),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'previewed', 'confirmed', 'sending', 'completed', 'cancelled', 'failed')),
  idempotency_key text not null unique,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  confirmed_by_admin_id uuid references public.admin_users(id) on delete set null,
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'skipped', 'opted_out')),
  skip_reason text not null default '',
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_key)
);

alter table public.telegram_delivery_log
  add constraint telegram_delivery_campaign_recipient_fk
  foreign key (campaign_recipient_id)
  references public.crm_campaign_recipients(id)
  on delete cascade;

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null,
  source_type text not null,
  source_id text not null,
  reported_user_key text references public.app_users(user_key) on delete set null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed', 'closed')),
  assigned_admin_id uuid references public.admin_users(id) on delete set null,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists moderation_cases_status_priority_idx
  on public.moderation_cases(status, priority, created_at);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  actor_email text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null default '',
  request_id text not null default '',
  reason text not null default '',
  before_value jsonb,
  after_value jsonb,
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_action_created_idx
  on public.admin_audit_log(action, created_at desc);

create index if not exists admin_audit_target_created_idx
  on public.admin_audit_log(target_type, target_id, created_at desc);

create or replace function public.bali_reject_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_log is immutable';
end;
$$;

drop trigger if exists bali_admin_audit_immutable on public.admin_audit_log;
create trigger bali_admin_audit_immutable
before update or delete on public.admin_audit_log
for each row execute function public.bali_reject_admin_audit_mutation();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_key text references public.app_users(user_key) on delete set null,
  session_id uuid references public.user_sessions(id) on delete set null,
  event_name text not null,
  source text not null default 'app',
  entity_type text not null default '',
  entity_id text not null default '',
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events(event_name, occurred_at desc);

create index if not exists analytics_events_user_time_idx
  on public.analytics_events(user_key, occurred_at desc);

create table if not exists public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  aggregate_type text not null default '',
  aggregate_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbox_jobs_pending_idx
  on public.outbox_jobs(status, available_at)
  where status in ('pending', 'failed');

create table if not exists public.migration_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  migration_target text not null,
  database_fingerprint text not null default '',
  results jsonb not null default '{}'::jsonb,
  blocking_issue_count integer not null default 0 check (blocking_issue_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null check (backup_type in ('full', 'schema', 'data')),
  storage_reference text not null,
  checksum text not null default '',
  status text not null default 'started'
    check (status in ('started', 'completed', 'failed', 'verified')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.telegram_delivery_log enable row level security;
alter table public.crm_campaigns enable row level security;
alter table public.crm_campaign_recipients enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.analytics_events enable row level security;
alter table public.outbox_jobs enable row level security;
alter table public.migration_preflight_runs enable row level security;
alter table public.backup_runs enable row level security;
