import { createHmac, randomUUID } from "node:crypto";
import { DataType, newDb } from "pg-mem";
import request from "supertest";
import type { SuperAgentTest } from "supertest";
import { createApp } from "../../server/app.js";
import { hashPassword } from "../../server/security.js";
import type { AppConfig, Queryable, TelegramUser } from "../../server/types.js";

export const BOT_TOKEN = "123456:TEST_BOT_TOKEN";

export const TEST_CONFIG: AppConfig = {
  environment: "test",
  port: 0,
  databaseUrl: "postgres://test",
  telegramBotToken: BOT_TOKEN,
  telegramBotUrl: "https://t.me/bali_test_bot",
  sessionSecret: "test-session-secret-that-is-definitely-longer-than-32-characters",
  sessionTtlSeconds: 3600,
  telegramAuthMaxAgeSeconds: 300,
  adminBootstrapEmail: "",
  adminBootstrapPassword: "",
  trustProxy: false,
  secureCookies: false
};

const PERMISSIONS = [
  "chat.read", "chat.write", "chat.reply", "chat.enable", "chat.disable",
  "chat.set_read_only", "chat.settings.update", "message.read", "message.create",
  "message.reply", "message.delete_own", "message.delete_any", "message.pin",
  "poll.read", "poll.vote", "poll.create", "poll.finish", "poll.cancel",
  "poll.delete", "poll.pin", "event.read", "event.attach", "event.detach",
  "event.set_primary", "event.link_poll", "event.pin", "announcement.create",
  "notification.broadcast", "member.restrict_chat", "member.unrestrict_chat",
  "report.create", "report.review", "audit.read"
];

const SCHEMA = `
create table app_users (
  user_key text primary key,
  telegram_id text unique,
  name text not null default 'Гость BALI',
  username text not null default '',
  phone text not null default '',
  avatar text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  opens integer not null default 1,
  account_status text not null default 'active',
  blocked_at timestamptz,
  profile_privacy jsonb not null default '{"avatar":"public","username":"private","phone":"private","birth_date":"private"}',
  vip_expires_at timestamptz,
  birth_date date,
  updated_at timestamptz not null default now()
);
create table user_profiles (
  user_key text primary key references app_users(user_key) on delete cascade,
  display_name text not null default '',
  status_text text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  birth_date date,
  gender text not null default 'unspecified',
  avatar_url text not null default '',
  phone text not null default '',
  discoverable boolean not null default true,
  allow_connections boolean not null default true,
  allow_event_invites boolean not null default true,
  allow_gifts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table user_consents (
  user_key text primary key references app_users(user_key) on delete cascade,
  age_confirmed boolean not null default false,
  age_confirmed_at timestamptz,
  terms_version text not null default '',
  terms_accepted_at timestamptz,
  privacy_version text not null default '',
  privacy_accepted_at timestamptz,
  marketing_opt_in boolean not null default false,
  marketing_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  app_user_key text not null unique references app_users(user_key) on delete cascade,
  telegram_user_id bigint not null unique,
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
create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  app_user_key text not null references app_users(user_key) on delete cascade,
  token_hash text not null unique,
  telegram_auth_date timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table crm_customers (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique references app_users(user_key) on delete cascade,
  legacy_customer_id text unique,
  phone text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  birth_date date,
  trust_status text not null default 'normal',
  marketing_opt_in boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  app_opens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table point_accounts (
  user_key text primary key references app_users(user_key) on delete cascade,
  balance bigint not null default 0,
  lifetime_earned bigint not null default 0,
  lifetime_spent bigint not null default 0,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table economy_settings (
  singleton boolean primary key default true,
  registration_points bigint not null default 100,
  profile_completion_points bigint not null default 100,
  checkin_points bigint not null default 250,
  invited_friend_points bigint not null default 150,
  clan_activity_points bigint not null default 25,
  updated_by_admin_id uuid references admin_users(id),
  updated_at timestamptz not null default now()
);
insert into economy_settings(singleton) values (true);
create table point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references app_users(user_key),
  amount bigint not null,
  balance_before bigint not null,
  balance_after bigint not null,
  operation_type text not null,
  source_type text not null,
  source_id text not null default '',
  reason text not null default '',
  administrator_id uuid references admin_users(id),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table game_profiles (
  user_key text primary key references app_users(user_key) on delete cascade,
  lives integer not null default 5,
  best_score bigint not null default 0,
  xp bigint not null default 0,
  suspicious_score_count integer not null default 0,
  last_life_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table notification_preferences (
  user_key text primary key references app_users(user_key) on delete cascade,
  in_app_enabled boolean not null default true,
  telegram_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  disabled_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table idempotency_records (
  scope text not null,
  idempotency_key text not null,
  actor_key text not null default '',
  request_hash text not null default '',
  response_code integer,
  response_body jsonb,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  primary key (scope, idempotency_key)
);
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_key text references app_users(user_key),
  session_id uuid references user_sessions(id),
  event_name text not null,
  source text not null default 'app',
  entity_type text not null default '',
  entity_id text not null default '',
  properties jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table events (
  id text primary key,
  title text not null,
  event_date date not null,
  event_time time not null default '23:00',
  description text not null default '',
  image_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table clans (
  id text primary key,
  name text not null,
  clan_type text not null default 'user' check (clan_type in ('user', 'corporate')),
  leader_user_key text references app_users(user_key),
  status text not null default 'active',
  rating_points integer not null default 0 check (rating_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_memberships (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references clans(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  clan_type text not null default 'user' check (clan_type in ('user', 'corporate')),
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, user_key)
);
create unique index clan_memberships_one_active_category
  on clan_memberships(user_key, clan_type) where status = 'active';
create table clan_invitations (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references clans(id) on delete cascade,
  inviter_user_key text not null references app_users(user_key) on delete cascade,
  invitee_user_key text not null references app_users(user_key) on delete cascade,
  status text not null default 'pending',
  message text not null default '',
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clan_invitations_one_pending_idx
  on clan_invitations(clan_id, invitee_user_key) where status = 'pending';
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references app_users(user_key) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  idempotency_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table clan_profiles (
  clan_id text primary key references clans(id) on delete cascade,
  logo_url text not null default '',
  cover_url text not null default '',
  description text not null default '',
  achievements jsonb not null default '[]',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_key text not null references app_users(user_key),
  recipient_user_key text not null references app_users(user_key),
  pair_low text not null references app_users(user_key),
  pair_high text not null references app_users(user_key),
  status text not null default 'pending',
  request_message text not null default '',
  cooldown_until timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_low, pair_high)
);
create table user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_key text not null references app_users(user_key),
  blocked_user_key text not null references app_users(user_key),
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (blocker_user_key, blocked_user_key)
);
create table event_runtime (
  event_id text primary key references events(id) on delete cascade,
  status text not null default 'published',
  starts_at timestamptz,
  ends_at timestamptz,
  age_limit integer not null default 18,
  dj text not null default '',
  artists jsonb not null default '[]',
  metadata jsonb not null default '{}',
  published_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  status text not null,
  source_type text not null default 'self',
  source_id text not null default '',
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_key)
);
create table clan_chats (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null unique references clans(id) on delete cascade,
  enabled boolean not null default true,
  read_only boolean not null default false,
  own_delete_window_seconds integer not null default 900,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  author_user_key text references app_users(user_key),
  body text not null,
  message_type text not null default 'text',
  reply_to_message_id uuid references clan_chat_messages(id),
  deleted_at timestamptz,
  deleted_by_type text,
  deleted_by_id text,
  deletion_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_chat_message_replies (
  message_id uuid primary key references clan_chat_messages(id) on delete cascade,
  parent_message_id uuid not null references clan_chat_messages(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table clan_chat_read_states (
  chat_id uuid not null references clan_chats(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  last_read_message_id uuid references clan_chat_messages(id),
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_key)
);
create table clan_chat_restrictions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  can_write boolean not null default false,
  reason text not null default '',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_type text not null,
  created_by_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clan_chat_restrictions_active_unique
  on clan_chat_restrictions(chat_id, user_key) where revoked_at is null;
create table clan_chat_polls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  created_by_user_key text references app_users(user_key),
  question text not null,
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  show_results_before_vote boolean not null default false,
  status text not null default 'active',
  closes_at timestamptz,
  linked_event_attachment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references clan_chat_polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (poll_id, sort_order)
);
create table clan_chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references clan_chat_polls(id) on delete cascade,
  option_id uuid not null references clan_chat_poll_options(id) on delete cascade,
  voter_user_key text not null references app_users(user_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, voter_user_key)
);
create table clan_chat_events (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  attached_by_user_key text references app_users(user_key),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_id, event_id)
);
alter table clan_chat_polls add constraint clan_chat_polls_event_fk
  foreign key (linked_event_attachment_id) references clan_chat_events(id) on delete set null;
create table clan_chat_announcements (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  author_user_key text references app_users(user_key),
  title text not null default '',
  body text not null,
  official boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_chat_pins (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  pinned_by_user_key text references app_users(user_key),
  created_at timestamptz not null default now(),
  unique (chat_id, target_type, target_id)
);
create table clan_chat_notification_preferences (
  chat_id uuid not null references clan_chats(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  muted_until timestamptz,
  announcements_only boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_key)
);
create table clan_chat_permissions (
  permission_key text primary key,
  description text not null,
  management_permission boolean not null default true,
  created_at timestamptz not null default now()
);
create table clan_chat_permission_grants (
  id uuid primary key default gen_random_uuid(),
  clan_id text not null references clans(id) on delete cascade,
  user_key text not null references app_users(user_key) on delete cascade,
  permission_key text not null references clan_chat_permissions(permission_key),
  effect text not null default 'allow',
  reason text not null default '',
  granted_by_admin_id uuid references admin_users(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table clan_chat_reports (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references clan_chats(id) on delete cascade,
  message_id uuid not null references clan_chat_messages(id) on delete cascade,
  reporter_user_key text not null references app_users(user_key),
  reason text not null,
  status text not null default 'new',
  reviewed_by_admin_id uuid references admin_users(id),
  reviewed_at timestamptz,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, reporter_user_key)
);
create table clan_chat_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text not null,
  actor_telegram_id bigint,
  actor_user_key text references app_users(user_key),
  permission_key text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  clan_id text references clans(id),
  chat_id uuid references clan_chats(id),
  request_id text not null,
  reason text not null default '',
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table rate_limit_settings (
  bucket text primary key,
  limit_count integer not null,
  window_seconds integer not null,
  enabled boolean not null default true,
  updated_by_admin_id uuid references admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table rate_limit_buckets (
  bucket text not null references rate_limit_settings(bucket),
  subject_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (bucket, subject_key, window_started_at)
);
`;

export interface TestContext {
  db: Queryable & { end(): Promise<void> };
  app: ReturnType<typeof createApp>;
  config: AppConfig;
  adminAgent: SuperAgentTest;
}

export function signInitData(
  user: TelegramUser,
  options: { authDate?: number; botToken?: string; startParam?: string } = {}
): string {
  const params = new URLSearchParams({
    auth_date: String(options.authDate || Math.floor(Date.now() / 1000)),
    query_id: `query-${user.id}`,
    user: JSON.stringify(user)
  });
  if (options.startParam) params.set("start_param", options.startParam);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(options.botToken || BOT_TOKEN)
    .digest();
  params.set("hash", createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return params.toString();
}

export async function createTestContext(
  overrides: Partial<AppConfig> = {}
): Promise<TestContext> {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    impure: true,
    implementation: randomUUID
  });
  memory.public.none(SCHEMA);
  const adapter = memory.adapters.createPg();
  const db = new adapter.Pool() as unknown as Queryable & { end(): Promise<void> };
  for (const permission of PERMISSIONS) {
    await db.query(
      `insert into clan_chat_permissions(permission_key, description)
       values ($1,$2)`,
      [permission, permission]
    );
  }
  for (const [bucket, limit, window] of [
    ["auth.telegram", 1000, 60],
    ["auth.admin", 1000, 300],
    ["message.create", 1000, 60],
    ["message.repeat", 1000, 300],
    ["message.mentions", 1000, 60],
    ["message.links", 1000, 60],
    ["poll.create", 1000, 3600],
    ["poll.vote", 1000, 60],
    ["event.attach", 1000, 3600],
    ["invitation.create", 1000, 3600],
    ["report.create", 1000, 3600],
    ["notification.broadcast", 1000, 3600]
  ] as const) {
    await db.query(
      `insert into rate_limit_settings(bucket, limit_count, window_seconds)
       values ($1,$2,$3)`,
      [bucket, limit, window]
    );
  }
  const passwordHash = await hashPassword("CorrectHorseBatteryStaple!");
  await db.query(
    `insert into admin_users(email, password_hash, role)
     values ('admin@bali.test',$1,'superadmin')`,
    [passwordHash]
  );
  const config = { ...TEST_CONFIG, ...overrides };
  const app = createApp(db, config);
  const adminAgent = request.agent(app);
  const login = await adminAgent
    .post("/api/v1/auth/admin/login")
    .send({ email: "admin@bali.test", password: "CorrectHorseBatteryStaple!" });
  if (login.status !== 200) throw new Error(`Admin test login failed: ${login.status} ${login.text}`);
  return { db, app, config, adminAgent };
}

export async function loginUser(
  context: TestContext,
  user: TelegramUser
): Promise<SuperAgentTest> {
  const agent = request.agent(context.app);
  const response = await agent
    .post("/api/v1/auth/telegram")
    .send({ initData: signInitData(user) });
  if (response.status !== 201) throw new Error(`User test login failed: ${response.status} ${response.text}`);
  return agent;
}

export async function createClan(
  context: TestContext,
  input: {
    id?: string;
    name?: string;
    clanType?: "user" | "corporate";
    leaderUserKey: string;
    ratingPoints?: number;
    members?: Array<{ userKey: string; role?: string; status?: string }>;
  }
): Promise<{ clanId: string; chatId: string }> {
  const clanId = input.id || `clan-${randomUUID()}`;
  const clanType = input.clanType || "user";
  await context.db.query(
    `insert into clans(id, name, clan_type, leader_user_key, rating_points) values ($1,$2,$3,$4,$5)`,
    [clanId, input.name || "BALI Clan", clanType, input.leaderUserKey, input.ratingPoints || 0]
  );
  const chat = await context.db.query(
    `insert into clan_chats(clan_id) values ($1) returning id`,
    [clanId]
  );
  const rows = input.members || [{ userKey: input.leaderUserKey, role: "leader" }];
  if (!rows.some(row => row.userKey === input.leaderUserKey)) {
    rows.unshift({ userKey: input.leaderUserKey, role: "leader" });
  }
  for (const member of rows) {
    await context.db.query(
      `insert into clan_memberships(clan_id, user_key, clan_type, role, status)
       values ($1,$2,$3,$4,$5)`,
      [clanId, member.userKey, clanType, member.role || "member", member.status || "active"]
    );
  }
  return { clanId, chatId: String(chat.rows[0].id) };
}

export async function seedEvent(context: TestContext, id = "event-official"): Promise<string> {
  await context.db.query(
    `insert into events(id, title, event_date, event_time, description, active)
     values ($1,'Official BALI Night','2030-12-31','23:00','Official event',true)`,
    [id]
  );
  return id;
}

export const USERS = {
  leader: { id: 1001, first_name: "Leader", username: "leader" },
  member: { id: 1002, first_name: "Member", username: "member" },
  deputy: { id: 1003, first_name: "Deputy", username: "deputy" },
  moderator: { id: 1004, first_name: "Moderator", username: "moderator" },
  outsider: { id: 1005, first_name: "Outsider", username: "outsider" },
  former: { id: 1006, first_name: "Former", username: "former" }
} satisfies Record<string, TelegramUser>;
