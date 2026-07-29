import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { SuperAgentTest } from "supertest";
import {
  USERS,
  createClan,
  createTestContext,
  loginUser,
  type TestContext
} from "./helpers.js";

interface Scenario {
  context: TestContext;
  clanId: string;
  chatId: string;
  leader: SuperAgentTest;
  member: SuperAgentTest;
  deputy: SuperAgentTest;
}

let context: TestContext | undefined;
afterEach(async () => {
  await context?.db.end();
  context = undefined;
});

async function setup(): Promise<Scenario> {
  context = await createTestContext();
  const [leader, member, deputy] = await Promise.all([
    loginUser(context, USERS.leader),
    loginUser(context, USERS.member),
    loginUser(context, USERS.deputy)
  ]);
  const clan = await createClan(context, {
    id: "clan-admin",
    leaderUserKey: `tg:${USERS.leader.id}`,
    members: [
      { userKey: `tg:${USERS.leader.id}`, role: "leader" },
      { userKey: `tg:${USERS.member.id}`, role: "member" },
      { userKey: `tg:${USERS.deputy.id}`, role: "deputy" }
    ]
  });
  return { context, ...clan, leader, member, deputy };
}

test("an administrator can list and inspect every clan chat", async () => {
  const s = await setup();
  const list = await s.context.adminAgent.get("/api/v1/admin/chats");
  assert.equal(list.status, 200);
  assert.equal(list.body.chats[0].clan_id, s.clanId);
  const details = await s.context.adminAgent.get(`/api/v1/admin/clans/${s.clanId}/chat`);
  assert.equal(details.status, 200);
  assert.equal(details.body.members.length, 3);
});

test("an administrator can create user and corporate clans and appoint a senior", async () => {
  context = await createTestContext();
  const leader = await loginUser(context, USERS.leader);
  const leaderUserKey = `tg:${USERS.leader.id}`;

  const userClan = await context.adminAgent
    .post("/api/v1/admin/clans")
    .send({
      name: "BALI USER CREW",
      clanType: "user",
      leaderUserKey,
      ratingPoints: 120,
      reason: "Создание пользовательского клана"
    });
  assert.equal(userClan.status, 201);
  assert.equal(userClan.body.clan.clan_type, "user");

  const corporateClan = await context.adminAgent
    .post("/api/v1/admin/clans")
    .send({
      name: "BALI CORPORATE TEAM",
      clanType: "corporate",
      leaderUserKey,
      ratingPoints: 80,
      reason: "Создание корпоративного клана"
    });
  assert.equal(corporateClan.status, 201);
  assert.equal(corporateClan.body.clan.clan_type, "corporate");

  const memberships = await leader.get("/api/v1/clans");
  assert.equal(memberships.status, 200);
  assert.deepEqual(
    memberships.body.clans.map((row: any) => row.clan_type).sort(),
    ["corporate", "user"]
  );
  assert.ok(memberships.body.clans.every((row: any) => row.role === "leader"));

  const users = await context.adminAgent.get("/api/v1/admin/users");
  assert.equal(users.status, 200);
  const candidate = users.body.users.find((row: any) => row.user_key === leaderUserKey);
  assert.equal(candidate.user_clan_name, "BALI USER CREW");
  assert.equal(candidate.corporate_clan_name, "BALI CORPORATE TEAM");

  const audit = await context.db.query(
    `select action from clan_chat_audit_log where action = 'clan.create' order by created_at`
  );
  assert.equal(audit.rowCount, 2);
});

test("one user cannot hold two active memberships in the same clan category", async () => {
  context = await createTestContext();
  await loginUser(context, USERS.leader);
  const leaderUserKey = `tg:${USERS.leader.id}`;

  const first = await context.adminAgent
    .post("/api/v1/admin/clans")
    .send({ name: "FIRST USER CLAN", clanType: "user", leaderUserKey });
  assert.equal(first.status, 201);

  const duplicate = await context.adminAgent
    .post("/api/v1/admin/clans")
    .send({ name: "SECOND USER CLAN", clanType: "user", leaderUserKey });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, "clan_category_membership_conflict");

  const corporate = await context.adminAgent
    .post("/api/v1/admin/clans")
    .send({ name: "ALLOWED CORPORATE CLAN", clanType: "corporate", leaderUserKey });
  assert.equal(corporate.status, 201);
});

test("an administrator can update clan rating and the public order changes", async () => {
  const s = await setup();
  const updated = await s.context.adminAgent
    .put(`/api/v1/admin/clans/${s.clanId}/rating`)
    .send({ ratingPoints: 9876, reason: "Результат недельного сезона" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.clan.rating_points, 9876);

  const ranking = await s.member.get("/api/v1/clans/ranking");
  assert.equal(ranking.status, 200);
  assert.equal(ranking.body.clans[0].ratingPoints, 9876);

  const audit = await s.context.db.query(
    `select action, reason from clan_chat_audit_log where action = 'clan.rating.update'`
  );
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].reason, "Результат недельного сезона");
});

test("an administrator can search messages inside one clan chat", async () => {
  const s = await setup();
  await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Уникальная фраза для поиска" });
  await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Другое сообщение" });
  const response = await s.context.adminAgent
    .get(`/api/v1/admin/clans/${s.clanId}/messages`)
    .query({ search: "уникальная фраза" });
  assert.equal(response.status, 200);
  assert.equal(response.body.messages.length, 1);
  assert.match(response.body.messages[0].body, /Уникальная/);
});

test("an administrator can delete a message and the action is audited", async () => {
  const s = await setup();
  const created = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение под модерацию" });
  const deleted = await s.context.adminAgent
    .delete(`/api/v1/admin/clans/${s.clanId}/messages/${created.body.message.id}`)
    .send({ reason: "Нарушение правил" });
  assert.equal(deleted.status, 204);
  const audit = await context!.db.query(
    `select * from clan_chat_audit_log where action = 'message.delete'`
  );
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].actor_type, "admin");
});

test("an administrator can grant exactly one permission", async () => {
  const s = await setup();
  const response = await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/grants`)
    .send({
      userKey: `tg:${USERS.deputy.id}`,
      permissionKey: "poll.create",
      reason: "Временный организатор опросов"
    });
  assert.equal(response.status, 201);
  assert.equal(response.body.grant.permission_key, "poll.create");
  const chat = await s.deputy.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.ok(chat.body.permissions.includes("poll.create"));
  assert.equal(chat.body.permissions.includes("event.attach"), false);
});

test("revoking a permission immediately removes access", async () => {
  const s = await setup();
  const grant = await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/grants`)
    .send({
      userKey: `tg:${USERS.deputy.id}`,
      permissionKey: "poll.create",
      reason: "Тест отзыва"
    });
  const before = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "До отзыва", options: ["Да", "Нет"] });
  assert.equal(before.status, 201);
  const revoke = await s.context.adminAgent
    .delete(`/api/v1/admin/clans/${s.clanId}/grants/${grant.body.grant.id}`)
    .send({ reason: "Разрешение больше не нужно" });
  assert.equal(revoke.status, 204);
  const after = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "После отзыва", options: ["Да", "Нет"] });
  assert.equal(after.status, 403);
});

test("an expired delegated permission is denied", async () => {
  const s = await setup();
  await context!.db.query(
    `insert into clan_chat_permission_grants(
       clan_id, user_key, permission_key, effect, reason, expires_at
     ) values ($1,$2,'poll.create','allow','Истекло',now() - interval '1 second')`,
    [s.clanId, `tg:${USERS.deputy.id}`]
  );
  const response = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Просроченный grant", options: ["Да", "Нет"] });
  assert.equal(response.status, 403);
});

test("an administrator can explicitly restrict a leader permission", async () => {
  const s = await setup();
  const deny = await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/grants`)
    .send({
      userKey: `tg:${USERS.leader.id}`,
      permissionKey: "poll.create",
      effect: "deny",
      reason: "Временное ограничение главного"
    });
  assert.equal(deny.status, 201);
  const response = await s.leader
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Запрещённый опрос", options: ["Да", "Нет"] });
  assert.equal(response.status, 403);
});

test("an administrator can transfer clan leadership", async () => {
  const s = await setup();
  const response = await s.context.adminAgent
    .put(`/api/v1/admin/clans/${s.clanId}/leader`)
    .send({
      userKey: `tg:${USERS.deputy.id}`,
      reason: "Решение администрации"
    });
  assert.equal(response.status, 200);
  const deputyPoll = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Опрос нового главного", options: ["Да", "Нет"] });
  assert.equal(deputyPoll.status, 201);
  const formerLeaderPoll = await s.leader
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Опрос бывшего главного", options: ["Да", "Нет"] });
  assert.equal(formerLeaderPoll.status, 403);
});

test("chat enable and read-only settings are controlled by admin and audited", async () => {
  const s = await setup();
  const response = await s.context.adminAgent
    .patch(`/api/v1/admin/clans/${s.clanId}/chat`)
    .send({
      enabled: true,
      readOnly: true,
      ownDeleteWindowSeconds: 120,
      settings: { slowModeSeconds: 10 },
      reason: "Подготовка объявления"
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.chat.read_only, true);
  const blocked = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Нельзя отправить" });
  assert.equal(blocked.status, 403);
  const audit = await context!.db.query(
    `select * from clan_chat_audit_log where action = 'chat.settings.update'`
  );
  assert.equal(audit.rowCount, 1);
});

test("an administrator can publish an official clan announcement in read-only mode", async () => {
  const s = await setup();
  await context!.db.query(`update clan_chats set read_only = true where id = $1`, [s.chatId]);
  const response = await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/announcements`)
    .send({ title: "Важно", body: "Сбор у входа в 22:45" });
  assert.equal(response.status, 201);
  assert.equal(response.body.announcement.official, true);
  const message = await context!.db.query(
    `select message_type from clan_chat_messages where chat_id = $1`,
    [s.chatId]
  );
  assert.equal(message.rows[0].message_type, "announcement");
});

test("an administrator can review a member report", async () => {
  const s = await setup();
  const message = await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение с жалобой" });
  const report = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages/${message.body.message.id}/reports`)
    .send({ reason: "Проверить содержание" });
  const response = await s.context.adminAgent
    .patch(`/api/v1/admin/reports/${report.body.report.id}`)
    .send({ status: "resolved", resolution: "Сообщение проверено" });
  assert.equal(response.status, 200);
  assert.equal(response.body.report.status, "resolved");
});

test("audit log can be filtered and exported as CSV", async () => {
  const s = await setup();
  await s.context.adminAgent
    .patch(`/api/v1/admin/clans/${s.clanId}/chat`)
    .send({ readOnly: true, reason: "CSV audit test" });
  const json = await s.context.adminAgent
    .get("/api/v1/admin/audit")
    .query({ clanId: s.clanId, action: "chat.settings.update" });
  assert.equal(json.status, 200);
  assert.equal(json.body.audit.length, 1);
  const exported = await s.context.adminAgent
    .get("/api/v1/admin/audit")
    .query({ clanId: s.clanId, format: "csv" });
  assert.equal(exported.status, 200);
  assert.match(exported.headers["content-type"], /text\/csv/);
  assert.match(exported.text, /chat\.settings\.update/);
});

test("rate-limit settings can be changed through the admin API", async () => {
  const s = await setup();
  const response = await s.context.adminAgent
    .put("/api/v1/admin/rate-limits/message.create")
    .send({ limitCount: 7, windowSeconds: 120, enabled: true });
  assert.equal(response.status, 200);
  assert.equal(response.body.setting.limit_count, 7);
  assert.equal(response.body.setting.window_seconds, 120);
  const audit = await context!.db.query(
    `select * from clan_chat_audit_log where action = 'rate_limit.update'`
  );
  assert.equal(audit.rowCount, 1);
});

test("all management actions write actor, permission and request id to audit", async () => {
  const s = await setup();
  await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/grants`)
    .set("x-request-id", "audit-request-123")
    .send({
      userKey: `tg:${USERS.deputy.id}`,
      permissionKey: "poll.create",
      reason: "Audit completeness"
    });
  const row = await context!.db.query(
    `select * from clan_chat_audit_log where action = 'permission.grant'`
  );
  assert.equal(row.rows[0].actor_type, "admin");
  assert.equal(row.rows[0].permission_key, "poll.create");
  assert.equal(row.rows[0].request_id, "audit-request-123");
  assert.equal(row.rows[0].reason, "Audit completeness");
});
