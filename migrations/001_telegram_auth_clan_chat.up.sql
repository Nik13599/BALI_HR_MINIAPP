create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.events') is null then
    raise exception 'BALI base schema is required: public.events does not exist';
  end if;
end;
$$;

create table if not exists public.app_users (
  user_key text primary key,
  telegram_id text,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  avatar text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  opens integer not null default 1 check (opens > 0)
);

alter table public.app_users
  add column if not exists account_status text not null default 'active',
  add column if not exists blocked_at timestamptz,
  add column if not exists profile_privacy jsonb not null default
    '{"avatar":"public","username":"private","phone":"private","birth_date":"private"}'::jsonb,
  add column if not exists vip_expires_at timestamptz,
  add column if not exists birth_date date,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_users_telegram_id_unique
  on public.app_users(telegram_id)
  where telegram_id is not null and telegram_id <> '';

create table if not exists public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  app_user_key text not null unique references public.app_users(user_key) on delete cascade,
  telegram_user_id bigint not null unique check (telegram_user_id > 0),
  username text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  language_code text not null default '',
  photo_url text not null default '',
  is_premium boolean not null default false,
  first_verified_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  app_user_key text not null references public.app_users(user_key) on delete cascade,
  token_hash text not null unique,
  telegram_auth_date timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('admin', 'superadmin', 'moderator', 'auditor')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists public.clans (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 120),
  clan_type text not null default 'community',
  leader_user_key text references public.app_users(user_key) on delete set null,
  status text not null default 'active' check (status in ('active', 'disabled', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_roles (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete cascade,
  role_key text not null,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, role_key)
);

create table if not exists public.clan_memberships (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  role text not null default 'member',
  status text not null default 'active' check (status in ('active', 'left', 'removed', 'blocked')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, user_key)
);

create table if not exists public.clan_chats (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null unique references public.clans(id) on delete cascade,
  enabled boolean not null default true,
  read_only boolean not null default false,
  own_delete_window_seconds integer not null default 900 check (own_delete_window_seconds between 0 and 86400),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  author_user_key text references public.app_users(user_key) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  message_type text not null default 'text' check (message_type in ('text', 'system', 'announcement')),
  reply_to_message_id uuid references public.clan_chat_messages(id) on delete set null,
  deleted_at timestamptz,
  deleted_by_type text check (deleted_by_type is null or deleted_by_type in ('user', 'leader', 'delegate', 'admin', 'system')),
  deleted_by_id text,
  deletion_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_chat_message_replies (
  message_id uuid primary key references public.clan_chat_messages(id) on delete cascade,
  parent_message_id uuid not null references public.clan_chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (message_id <> parent_message_id)
);

create table if not exists public.clan_chat_read_states (
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  last_read_message_id uuid references public.clan_chat_messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_key)
);

create table if not exists public.clan_chat_restrictions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  can_write boolean not null default false,
  reason text not null default '',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_type text not null check (created_by_type in ('leader', 'delegate', 'admin')),
  created_by_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clan_chat_restrictions_active_unique
  on public.clan_chat_restrictions(chat_id, user_key)
  where revoked_at is null;

create table if not exists public.clan_chat_polls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  created_by_user_key text references public.app_users(user_key) on delete set null,
  question text not null check (char_length(question) between 1 and 500),
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  show_results_before_vote boolean not null default false,
  status text not null default 'active' check (status in ('active', 'finished', 'cancelled', 'deleted')),
  closes_at timestamptz,
  linked_event_attachment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.clan_chat_polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (poll_id, sort_order)
);

create table if not exists public.clan_chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.clan_chat_polls(id) on delete cascade,
  option_id uuid not null references public.clan_chat_poll_options(id) on delete cascade,
  voter_user_key text not null references public.app_users(user_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, voter_user_key)
);

create table if not exists public.clan_chat_events (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  attached_by_user_key text references public.app_users(user_key) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_id, event_id)
);

alter table public.clan_chat_polls
  drop constraint if exists clan_chat_polls_linked_event_attachment_id_fkey;
alter table public.clan_chat_polls
  add constraint clan_chat_polls_linked_event_attachment_id_fkey
  foreign key (linked_event_attachment_id) references public.clan_chat_events(id) on delete set null;

create unique index if not exists clan_chat_events_one_primary
  on public.clan_chat_events(chat_id)
  where is_primary = true;

create table if not exists public.clan_chat_announcements (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  author_user_key text references public.app_users(user_key) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  body text not null check (char_length(body) between 1 and 4000),
  official boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_chat_pins (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  target_type text not null check (target_type in ('message', 'poll', 'event', 'announcement')),
  target_id uuid not null,
  pinned_by_user_key text references public.app_users(user_key) on delete set null,
  created_at timestamptz not null default now(),
  unique (chat_id, target_type, target_id)
);

create table if not exists public.clan_chat_notification_preferences (
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  muted_until timestamptz,
  announcements_only boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_key)
);

create table if not exists public.clan_chat_permissions (
  permission_key text primary key,
  description text not null,
  management_permission boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clan_chat_permission_grants (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references public.clans(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  permission_key text not null references public.clan_chat_permissions(permission_key) on delete cascade,
  effect text not null default 'allow' check (effect in ('allow', 'deny')),
  reason text not null default '',
  granted_by_admin_id uuid references public.admin_users(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_chat_reports (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.clan_chats(id) on delete cascade,
  message_id uuid not null references public.clan_chat_messages(id) on delete cascade,
  reporter_user_key text not null references public.app_users(user_key) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by_admin_id uuid references public.admin_users(id) on delete set null,
  reviewed_at timestamptz,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, reporter_user_key)
);

create table if not exists public.clan_chat_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'leader', 'delegate', 'admin', 'system')),
  actor_id text not null,
  actor_telegram_id bigint,
  actor_user_key text references public.app_users(user_key) on delete set null,
  permission_key text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  clan_id text references public.clans(id) on delete set null,
  chat_id uuid references public.clan_chats(id) on delete set null,
  request_id text not null,
  reason text not null default '',
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_settings (
  bucket text primary key,
  limit_count integer not null check (limit_count > 0),
  window_seconds integer not null check (window_seconds > 0),
  enabled boolean not null default true,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_limit_buckets (
  bucket text not null references public.rate_limit_settings(bucket) on delete cascade,
  subject_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (bucket, subject_key, window_started_at)
);

insert into public.clan_chat_permissions(permission_key, description, management_permission) values
  ('chat.read', 'Read clan chat', false),
  ('chat.write', 'Write to clan chat', false),
  ('chat.reply', 'Reply in clan chat', false),
  ('chat.enable', 'Enable clan chat', true),
  ('chat.disable', 'Disable clan chat', true),
  ('chat.set_read_only', 'Set chat read-only mode', true),
  ('chat.settings.update', 'Update chat settings', true),
  ('message.read', 'Read messages', false),
  ('message.create', 'Create text messages', false),
  ('message.reply', 'Reply to messages', false),
  ('message.delete_own', 'Delete own messages in the allowed period', false),
  ('message.delete_any', 'Delete any message', true),
  ('message.pin', 'Pin a message', true),
  ('poll.read', 'Read polls', false),
  ('poll.vote', 'Vote in polls', false),
  ('poll.create', 'Create polls', true),
  ('poll.finish', 'Finish polls', true),
  ('poll.cancel', 'Cancel polls', true),
  ('poll.delete', 'Delete polls', true),
  ('poll.pin', 'Pin polls', true),
  ('event.read', 'Read attached events', false),
  ('event.attach', 'Attach an official event', true),
  ('event.detach', 'Detach an event', true),
  ('event.set_primary', 'Select the primary clan event', true),
  ('event.link_poll', 'Link an event to a poll', true),
  ('event.pin', 'Pin attached events', true),
  ('announcement.create', 'Create official announcements', true),
  ('notification.broadcast', 'Broadcast notifications', true),
  ('member.restrict_chat', 'Restrict a member from writing', true),
  ('member.unrestrict_chat', 'Remove a chat restriction', true),
  ('report.create', 'Report a message', false),
  ('report.review', 'Review reports', true),
  ('audit.read', 'Read audit log', true)
on conflict (permission_key) do update set
  description = excluded.description,
  management_permission = excluded.management_permission;

insert into public.rate_limit_settings(bucket, limit_count, window_seconds) values
  ('auth.telegram', 10, 60),
  ('auth.admin', 8, 300),
  ('message.create', 20, 60),
  ('message.repeat', 3, 300),
  ('message.mentions', 8, 60),
  ('message.links', 5, 60),
  ('poll.create', 5, 3600),
  ('poll.vote', 30, 60),
  ('event.attach', 10, 3600),
  ('invitation.create', 10, 3600),
  ('report.create', 5, 3600),
  ('notification.broadcast', 3, 3600)
on conflict (bucket) do nothing;

create index if not exists telegram_accounts_user_id_idx
  on public.telegram_accounts(telegram_user_id);
create index if not exists user_sessions_user_expires_idx
  on public.user_sessions(app_user_key, expires_at desc)
  where revoked_at is null;
create index if not exists admin_sessions_admin_expires_idx
  on public.admin_sessions(admin_user_id, expires_at desc)
  where revoked_at is null;
create index if not exists clan_memberships_user_status_idx
  on public.clan_memberships(user_key, status, clan_id);
create index if not exists clan_memberships_clan_status_idx
  on public.clan_memberships(clan_id, status, user_key);
create index if not exists clan_chat_messages_chat_created_idx
  on public.clan_chat_messages(chat_id, created_at desc, id);
create index if not exists clan_chat_replies_parent_idx
  on public.clan_chat_message_replies(parent_message_id, created_at);
create index if not exists clan_chat_poll_votes_poll_idx
  on public.clan_chat_poll_votes(poll_id, option_id, created_at);
create index if not exists clan_chat_permission_grants_lookup_idx
  on public.clan_chat_permission_grants(clan_id, user_key, permission_key, effect)
  where revoked_at is null;
create index if not exists clan_chat_reports_status_created_idx
  on public.clan_chat_reports(status, created_at desc);
create index if not exists clan_chat_reports_chat_idx
  on public.clan_chat_reports(chat_id, created_at desc);
create index if not exists clan_chat_audit_clan_created_idx
  on public.clan_chat_audit_log(clan_id, created_at desc);
create index if not exists clan_chat_audit_actor_idx
  on public.clan_chat_audit_log(actor_type, actor_id, created_at desc);
create index if not exists rate_limit_buckets_expiry_idx
  on public.rate_limit_buckets(expires_at);

create or replace function public.bali_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_users', 'telegram_accounts', 'admin_users', 'clans', 'clan_roles',
    'clan_memberships', 'clan_chats', 'clan_chat_messages', 'clan_chat_read_states',
    'clan_chat_restrictions', 'clan_chat_polls', 'clan_chat_events',
    'clan_chat_announcements', 'clan_chat_notification_preferences',
    'clan_chat_permission_grants', 'clan_chat_reports', 'rate_limit_settings'
  ]
  loop
    execute format('drop trigger if exists bali_set_updated_at on public.%I', table_name);
    execute format(
      'create trigger bali_set_updated_at before update on public.%I for each row execute function public.bali_set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.bali_create_clan_chat()
returns trigger
language plpgsql
as $$
declare
  created_chat_id uuid;
begin
  insert into public.clan_chats(clan_id) values (new.id)
  on conflict (clan_id) do update set clan_id = excluded.clan_id
  returning id into created_chat_id;
  insert into public.clan_chat_audit_log(
    actor_type, actor_id, action, target_type, target_id, clan_id, chat_id,
    request_id, after_value
  ) values (
    'system', 'database-trigger', 'chat.create', 'chat', created_chat_id::text,
    new.id, created_chat_id, 'db-trigger:' || created_chat_id::text,
    jsonb_build_object('clanId', new.id, 'chatId', created_chat_id)
  );
  return new;
end;
$$;

drop trigger if exists bali_create_clan_chat on public.clans;
create trigger bali_create_clan_chat
after insert on public.clans
for each row execute function public.bali_create_clan_chat();

insert into public.clan_chats(clan_id)
select id from public.clans
on conflict (clan_id) do nothing;

insert into public.clan_chat_audit_log(
  actor_type, actor_id, action, target_type, target_id, clan_id, chat_id,
  request_id, after_value
)
select
  'system', 'migration', 'chat.create', 'chat', ch.id::text, ch.clan_id, ch.id,
  'migration:' || ch.id::text,
  jsonb_build_object('clanId', ch.clan_id, 'chatId', ch.id)
from public.clan_chats ch
where not exists (
  select 1 from public.clan_chat_audit_log audit
   where audit.action = 'chat.create' and audit.target_id = ch.id::text
);

create or replace function public.bali_reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'clan_chat_audit_log is immutable';
end;
$$;

drop trigger if exists bali_audit_immutable on public.clan_chat_audit_log;
create trigger bali_audit_immutable
before update or delete on public.clan_chat_audit_log
for each row execute function public.bali_reject_audit_mutation();

alter table public.telegram_accounts enable row level security;
alter table public.user_sessions enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.clans enable row level security;
alter table public.clan_roles enable row level security;
alter table public.clan_memberships enable row level security;
alter table public.clan_chats enable row level security;
alter table public.clan_chat_messages enable row level security;
alter table public.clan_chat_message_replies enable row level security;
alter table public.clan_chat_read_states enable row level security;
alter table public.clan_chat_restrictions enable row level security;
alter table public.clan_chat_polls enable row level security;
alter table public.clan_chat_poll_options enable row level security;
alter table public.clan_chat_poll_votes enable row level security;
alter table public.clan_chat_events enable row level security;
alter table public.clan_chat_announcements enable row level security;
alter table public.clan_chat_pins enable row level security;
alter table public.clan_chat_notification_preferences enable row level security;
alter table public.clan_chat_permissions enable row level security;
alter table public.clan_chat_permission_grants enable row level security;
alter table public.clan_chat_reports enable row level security;
alter table public.clan_chat_audit_log enable row level security;
alter table public.rate_limit_settings enable row level security;
alter table public.rate_limit_buckets enable row level security;

revoke all on public.telegram_accounts, public.user_sessions, public.admin_users,
  public.admin_sessions, public.clans, public.clan_roles, public.clan_memberships,
  public.clan_chats, public.clan_chat_messages, public.clan_chat_message_replies,
  public.clan_chat_read_states, public.clan_chat_restrictions, public.clan_chat_polls,
  public.clan_chat_poll_options, public.clan_chat_poll_votes, public.clan_chat_events,
  public.clan_chat_announcements, public.clan_chat_pins,
  public.clan_chat_notification_preferences, public.clan_chat_permissions,
  public.clan_chat_permission_grants, public.clan_chat_reports,
  public.clan_chat_audit_log, public.rate_limit_settings, public.rate_limit_buckets
from public;
