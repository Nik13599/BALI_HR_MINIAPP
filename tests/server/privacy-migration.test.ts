import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import request from "supertest";
import {
  USERS,
  createClan,
  createTestContext,
  loginUser,
  type TestContext
} from "./helpers.js";

let context: TestContext | undefined;
afterEach(async () => {
  await context?.db.end();
  context = undefined;
});

async function seedPrivateProfile(): Promise<{
  leader: Awaited<ReturnType<typeof loginUser>>;
  member: Awaited<ReturnType<typeof loginUser>>;
}> {
  if (!context) throw new Error("Test context is not initialized");
  const leader = await loginUser(context, USERS.leader);
  const member = await loginUser(context, USERS.member);
  await context.db.query(
    `update app_users
        set avatar = 'https://assets.test/leader.jpg',
            phone = '+375290000001',
            username = 'leader_private',
            birth_date = '1994-04-17',
            profile_privacy = $2::jsonb
      where user_key = $1`,
    [
      `tg:${USERS.leader.id}`,
      JSON.stringify({
        avatar: "public",
        username: "vip",
        phone: "private",
        birth_date: "clan"
      })
    ]
  );
  return { leader, member };
}

test("VIP access reveals only fields explicitly marked visible to VIP", async () => {
  context = await createTestContext();
  const { member } = await seedPrivateProfile();
  await context.db.query(
    `update app_users set vip_expires_at = now() + interval '7 days' where user_key = $1`,
    [`tg:${USERS.member.id}`]
  );

  const response = await member.get(`/api/v1/people/tg:${USERS.leader.id}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.profile.avatar, "https://assets.test/leader.jpg");
  assert.equal(response.body.profile.username, "leader_private");
  assert.equal(response.body.profile.phone, undefined);
  assert.equal(response.body.profile.birthDate, undefined);
});

test("a non-VIP viewer cannot see a VIP-only profile field", async () => {
  context = await createTestContext();
  const { member } = await seedPrivateProfile();

  const response = await member.get(`/api/v1/people/tg:${USERS.leader.id}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.profile.avatar, "https://assets.test/leader.jpg");
  assert.equal(response.body.profile.username, undefined);
  assert.equal(response.body.profile.phone, undefined);
});

test("active members of the same clan can see clan-only fields", async () => {
  context = await createTestContext();
  const { member } = await seedPrivateProfile();
  await createClan(context, {
    leaderUserKey: `tg:${USERS.leader.id}`,
    members: [
      { userKey: `tg:${USERS.leader.id}`, role: "leader" },
      { userKey: `tg:${USERS.member.id}`, role: "member" }
    ]
  });

  const response = await member.get(`/api/v1/people/tg:${USERS.leader.id}`);

  assert.equal(response.status, 200);
  assert.match(String(response.body.profile.birthDate), /^1994-04-17/);
  assert.equal(response.body.profile.phone, undefined);
});

test("profile owner sees every own field and privacy settings", async () => {
  context = await createTestContext();
  const { leader } = await seedPrivateProfile();

  const response = await leader.get("/api/v1/people/me");

  assert.equal(response.status, 200);
  assert.equal(response.body.profile.phone, "+375290000001");
  assert.equal(response.body.profile.username, "leader_private");
  assert.deepEqual(response.body.profile.privacy, {
    avatar: "public",
    username: "vip",
    phone: "private",
    birth_date: "clan"
  });
});

test("privacy API rejects unknown visibility modes", async () => {
  context = await createTestContext();
  const member = await loginUser(context, USERS.member);

  const response = await member
    .patch("/api/v1/people/me/privacy")
    .send({ phone: "friends" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "validation_error");
});

test("legacy People UI has no likes, thumbs, or mutual-unlock behavior", async () => {
  const files = [
    "site/beta4-social-core.js",
    "site/beta4-social-page.js",
    "site/bali-people-public-cards-beta4.js",
    "site/full-demo-people-upgrade-beta4.js",
    "site/full-demo-social-economy-beta4.js",
    "site/people-profile-stability-beta4.js",
    "site/demo-seed.js"
  ];
  const source = (await Promise.all(
    files.map(file => readFile(path.resolve(file), "utf8"))
  )).join("\n");

  assert.doesNotMatch(source, /data-person-thumb|toggleThumb|hasThumb|incomingThumbs/i);
  assert.doesNotMatch(source, /bali_social_swipes|mutual(?:Unlock)?|isConnection/i);
  assert.doesNotMatch(source, /viewerHasVip\?\.\(\)\s*\|\||if\s*\(\s*viewerHasVip\(\)\s*\)\s*return true/i);
});

test("forward migration contains protected chat schema, indexes, triggers, and RLS", async () => {
  const sql = await readFile(
    path.resolve("migrations/001_telegram_auth_clan_chat.up.sql"),
    "utf8"
  );
  for (const table of [
    "telegram_accounts",
    "user_sessions",
    "admin_sessions",
    "clan_memberships",
    "clan_chats",
    "clan_chat_messages",
    "clan_chat_polls",
    "clan_chat_events",
    "clan_chat_announcements",
    "clan_chat_permission_grants",
    "clan_chat_reports",
    "clan_chat_audit_log",
    "rate_limit_buckets"
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
  }
  assert.match(sql, /create index if not exists clan_chat_messages_chat_created_idx/i);
  assert.match(sql, /create trigger bali_create_clan_chat/i);
  assert.match(sql, /create trigger bali_audit_immutable/i);
  assert.match(sql, /'chat\.create'/i);
  assert.match(sql, /\bactor_telegram_id\b/i);
  assert.match(sql, /\bactor_user_key\b/i);
  assert.match(sql, /\bchat_id\b/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.telegram_accounts/i);
  assert.doesNotMatch(sql, /^\s*(?:begin|commit)\s*;/im);
});

test("rollback migration removes all added security and clan-chat objects", async () => {
  const sql = await readFile(
    path.resolve("migrations/001_telegram_auth_clan_chat.down.sql"),
    "utf8"
  );

  assert.match(sql, /drop trigger if exists bali_audit_immutable/i);
  assert.match(sql, /drop table if exists public\.clan_chat_messages/i);
  assert.match(sql, /drop table if exists public\.clan_memberships/i);
  assert.match(sql, /drop table if exists public\.admin_sessions/i);
  assert.match(sql, /drop table if exists public\.telegram_accounts/i);
  assert.match(sql, /drop column if exists birth_date/i);
  assert.doesNotMatch(sql, /^\s*(?:begin|commit)\s*;/im);
});

test("demo route remains available outside staging and production", async () => {
  context = await createTestContext({ environment: "development" });

  const response = await request(context.app).get("/demo");

  assert.equal(response.status, 200);
  assert.match(response.text, /BALI/i);
});

test("production does not expose the browser demo route", async () => {
  context = await createTestContext({ environment: "production" });

  const response = await request(context.app).get("/demo");

  assert.equal(response.status, 404);
});
