import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { SuperAgentTest } from "supertest";
import {
  USERS,
  createClan,
  createTestContext,
  loginUser,
  seedEvent,
  type TestContext
} from "./helpers.js";

interface ClanScenario {
  context: TestContext;
  clanId: string;
  chatId: string;
  leader: SuperAgentTest;
  member: SuperAgentTest;
  deputy: SuperAgentTest;
  moderator: SuperAgentTest;
  outsider: SuperAgentTest;
  former: SuperAgentTest;
}

let context: TestContext | undefined;
afterEach(async () => {
  await context?.db.end();
  context = undefined;
});

async function setup(): Promise<ClanScenario> {
  context = await createTestContext();
  const [leader, member, deputy, moderator, outsider, former] = await Promise.all([
    loginUser(context, USERS.leader),
    loginUser(context, USERS.member),
    loginUser(context, USERS.deputy),
    loginUser(context, USERS.moderator),
    loginUser(context, USERS.outsider),
    loginUser(context, USERS.former)
  ]);
  const clan = await createClan(context, {
    id: "clan-main",
    leaderUserKey: `tg:${USERS.leader.id}`,
    members: [
      { userKey: `tg:${USERS.leader.id}`, role: "leader" },
      { userKey: `tg:${USERS.member.id}`, role: "member" },
      { userKey: `tg:${USERS.deputy.id}`, role: "deputy" },
      { userKey: `tg:${USERS.moderator.id}`, role: "moderator" },
      { userKey: `tg:${USERS.former.id}`, role: "member", status: "left" }
    ]
  });
  return { context, ...clan, leader, member, deputy, moderator, outsider, former };
}

async function createPoll(s: ClanScenario, question = "Кто будет?") {
  return s.leader
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question, options: ["Буду", "Не буду"] });
}

test("an active clan member can read the clan chat", async () => {
  const s = await setup();
  const response = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.equal(response.status, 200);
  assert.equal(response.body.clan.id, s.clanId);
  assert.ok(response.body.permissions.includes("message.create"));
});

test("an active clan member can send a text message", async () => {
  const s = await setup();
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Всем привет!" });
  assert.equal(response.status, 201);
  assert.equal(response.body.message.body, "Всем привет!");
  assert.equal(response.body.message.author.id, `tg:${USERS.member.id}`);
});

test("an active clan member can reply to a message", async () => {
  const s = await setup();
  const parent = await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Собираемся в 23:00" });
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Буду", replyToId: parent.body.message.id });
  assert.equal(response.status, 201);
  assert.equal(response.body.message.reply.id, parent.body.message.id);
  const saved = await context!.db.query(
    `select parent_message_id from clan_chat_message_replies where message_id = $1`,
    [response.body.message.id]
  );
  assert.equal(String(saved.rows[0].parent_message_id), parent.body.message.id);
});

test("a member can delete an own message inside the configured period", async () => {
  const s = await setup();
  const created = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение для удаления" });
  const response = await s.member
    .delete(`/api/v1/clans/${s.clanId}/messages/${created.body.message.id}`)
    .send({});
  assert.equal(response.status, 204);
  const chat = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.equal(chat.body.messages[0].body, "Сообщение удалено автором");
});

test("a member cannot delete another member's message", async () => {
  const s = await setup();
  const created = await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение главного" });
  const response = await s.member
    .delete(`/api/v1/clans/${s.clanId}/messages/${created.body.message.id}`)
    .send({});
  assert.equal(response.status, 403);
});

test("an own message cannot be deleted after the configured period", async () => {
  const s = await setup();
  await context!.db.query(
    `update clan_chats set own_delete_window_seconds = 1 where id = $1`,
    [s.chatId]
  );
  const created = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Старое сообщение" });
  await context!.db.query(
    `update clan_chat_messages set created_at = now() - interval '10 seconds'
      where id = $1`,
    [created.body.message.id]
  );
  const response = await s.member
    .delete(`/api/v1/clans/${s.clanId}/messages/${created.body.message.id}`)
    .send({});
  assert.equal(response.status, 403);
});

test("an active clan member can vote in a poll", async () => {
  const s = await setup();
  const created = await createPoll(s);
  const chat = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  const optionId = chat.body.polls.find((row: any) => row.id === created.body.poll.id).options[0].id;
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/polls/${created.body.poll.id}/votes`)
    .send({ optionIds: [optionId] });
  assert.equal(response.status, 200);
  assert.equal(response.body.voted, true);
});

test("a poll vote never creates a confirmed event check-in", async () => {
  const s = await setup();
  const created = await createPoll(s);
  const chat = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  const optionId = chat.body.polls[0].options[0].id;
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/polls/${created.body.poll.id}/votes`)
    .send({ optionIds: [optionId] });
  assert.equal(response.status, 200);
  assert.equal(response.body.checkinCreated, false);
  assert.equal(JSON.stringify(response.body).includes("checked_in"), false);
});

test("an ordinary member cannot create a poll", async () => {
  const s = await setup();
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Опрос", options: ["Да", "Нет"] });
  assert.equal(response.status, 403);
});

test("a deputy without an explicit grant cannot create a poll", async () => {
  const s = await setup();
  const response = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Опрос заместителя", options: ["Да", "Нет"] });
  assert.equal(response.status, 403);
});

test("a moderator without an explicit grant cannot delete another message", async () => {
  const s = await setup();
  const created = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Обычное сообщение" });
  const response = await s.moderator
    .delete(`/api/v1/clans/${s.clanId}/messages/${created.body.message.id}`)
    .send({});
  assert.equal(response.status, 403);
});

test("the clan leader can create a poll", async () => {
  const s = await setup();
  const response = await createPoll(s, "Опрос главного");
  assert.equal(response.status, 201);
  assert.equal(response.body.poll.question, "Опрос главного");
  const audit = await context!.db.query(
    `select actor_user_key, actor_telegram_id, clan_id, chat_id
       from clan_chat_audit_log where action = 'poll.create'`
  );
  assert.equal(audit.rows[0].actor_user_key, `tg:${USERS.leader.id}`);
  assert.equal(String(audit.rows[0].actor_telegram_id), String(USERS.leader.id));
  assert.equal(audit.rows[0].clan_id, s.clanId);
  assert.equal(String(audit.rows[0].chat_id), s.chatId);
});

test("the clan leader can finish a poll", async () => {
  const s = await setup();
  const created = await createPoll(s);
  const response = await s.leader
    .post(`/api/v1/clans/${s.clanId}/polls/${created.body.poll.id}/finish`)
    .send({});
  assert.equal(response.status, 200);
  assert.equal(response.body.poll.status, "finished");
});

test("the clan leader can attach an existing official event", async () => {
  const s = await setup();
  const eventId = await seedEvent(context!);
  const response = await s.leader
    .post(`/api/v1/clans/${s.clanId}/events`)
    .send({ eventId });
  assert.equal(response.status, 201);
  assert.equal(response.body.attachment.event.id, eventId);
});

test("the clan leader cannot edit official event data through the clan API", async () => {
  const s = await setup();
  const eventId = await seedEvent(context!);
  const attached = await s.leader
    .post(`/api/v1/clans/${s.clanId}/events`)
    .send({ eventId });
  const response = await s.leader
    .patch(`/api/v1/clans/${s.clanId}/events/${attached.body.attachment.id}`)
    .send({ title: "Подменённое название" });
  assert.equal(response.status, 404);
  const event = await context!.db.query(`select title from events where id = $1`, [eventId]);
  assert.equal(event.rows[0].title, "Official BALI Night");
});

test("one explicit poll.create grant does not grant event.attach", async () => {
  const s = await setup();
  const grant = await s.context.adminAgent
    .post(`/api/v1/admin/clans/${s.clanId}/grants`)
    .send({
      userKey: `tg:${USERS.deputy.id}`,
      permissionKey: "poll.create",
      reason: "Только создание опросов"
    });
  assert.equal(grant.status, 201);
  const poll = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/polls`)
    .send({ question: "Разрешённый опрос", options: ["Да", "Нет"] });
  assert.equal(poll.status, 201);
  const eventId = await seedEvent(context!);
  const attach = await s.deputy
    .post(`/api/v1/clans/${s.clanId}/events`)
    .send({ eventId });
  assert.equal(attach.status, 403);
});

test("a user from another clan cannot read the chat", async () => {
  const s = await setup();
  const response = await s.outsider.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.equal(response.status, 403);
});

test("a former clan member cannot read chat history", async () => {
  const s = await setup();
  await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Закрытая история" });
  const response = await s.former.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.equal(response.status, 403);
  assert.doesNotMatch(response.text, /Закрытая история/);
});

test("a restricted member cannot write", async () => {
  const s = await setup();
  await context!.db.query(
    `insert into clan_chat_restrictions(
       chat_id, user_key, can_write, reason, created_by_type, created_by_id
     ) values ($1,$2,false,'spam','admin','test-admin')`,
    [s.chatId, `tg:${USERS.member.id}`]
  );
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение под ограничением" });
  assert.equal(response.status, 403);
});

test("ordinary members cannot write in read-only mode", async () => {
  const s = await setup();
  await context!.db.query(`update clan_chats set read_only = true where id = $1`, [s.chatId]);
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение в read-only" });
  assert.equal(response.status, 403);
});

test("message pagination returns a bounded page and cursor", async () => {
  const s = await setup();
  for (let index = 0; index < 4; index += 1) {
    await s.member
      .post(`/api/v1/clans/${s.clanId}/messages`)
      .send({ body: `Сообщение ${index + 1}` });
  }
  const first = await s.member
    .get(`/api/v1/clans/${s.clanId}/messages`)
    .query({ limit: 2 });
  assert.equal(first.status, 200);
  assert.equal(first.body.messages.length, 2);
  assert.equal(first.body.pagination.hasMore, true);
  const second = await s.member
    .get(`/api/v1/clans/${s.clanId}/messages`)
    .query({ limit: 2, before: first.body.pagination.nextBefore });
  assert.equal(second.status, 200);
  assert.equal(second.body.messages.length, 2);
});

test("unread counters are independent for two clan chats", async () => {
  const s = await setup();
  const second = await createClan(context!, {
    id: "clan-second",
    name: "Second clan",
    leaderUserKey: `tg:${USERS.leader.id}`,
    members: [
      { userKey: `tg:${USERS.leader.id}`, role: "leader" },
      { userKey: `tg:${USERS.member.id}`, role: "member" }
    ]
  });
  await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Первый чат" });
  await s.leader
    .post(`/api/v1/clans/${second.clanId}/messages`)
    .send({ body: "Второй чат" });
  const before = await s.member.get("/api/v1/clans");
  assert.equal(before.body.clans.find((row: any) => row.id === s.clanId).unread_count, 1);
  assert.equal(before.body.clans.find((row: any) => row.id === second.clanId).unread_count, 1);
  const firstChat = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  await s.member
    .post(`/api/v1/clans/${s.clanId}/read`)
    .send({ messageId: firstChat.body.messages[0].id });
  const after = await s.member.get("/api/v1/clans");
  assert.equal(after.body.clans.find((row: any) => row.id === s.clanId).unread_count, 0);
  assert.equal(after.body.clans.find((row: any) => row.id === second.clanId).unread_count, 1);
});

test("notification preferences are private to the current clan member", async () => {
  const s = await setup();
  const mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const updated = await s.member
    .put(`/api/v1/clans/${s.clanId}/notifications`)
    .send({ mutedUntil, announcementsOnly: true });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.preference.announcements_only, true);
  const bundle = await s.member.get(`/api/v1/clans/${s.clanId}/chat`);
  assert.equal(bundle.body.notificationPreference.announcements_only, true);
  assert.match(String(bundle.body.notificationPreference.muted_until), /^\d{4}-/);
});

test("a member can report a message", async () => {
  const s = await setup();
  const message = await s.leader
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Сообщение для жалобы" });
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages/${message.body.message.id}/reports`)
    .send({ reason: "Нарушение правил чата" });
  assert.equal(response.status, 201);
  assert.equal(response.body.report.status, "new");
});

test("configured message rate limits return HTTP 429", async () => {
  const s = await setup();
  await context!.db.query(
    `update rate_limit_settings set limit_count = 1 where bucket = 'message.create'`
  );
  const first = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Первое" });
  const second = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Второе" });
  assert.equal(first.status, 201);
  assert.equal(second.status, 429);
  assert.equal(second.body.error.code, "rate_limit_exceeded");
  assert.ok(Number(second.headers["retry-after"]) >= 1);
});

test("repeated-message limits use the normalized message body", async () => {
  const s = await setup();
  await context!.db.query(
    `update rate_limit_settings set limit_count = 1 where bucket = 'message.repeat'`
  );
  const first = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Повторяющийся текст" });
  const second = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "  ПОВТОРЯЮЩИЙСЯ   ТЕКСТ  " });
  assert.equal(first.status, 201);
  assert.equal(second.status, 429);
});

test("mention limits account for every mention in one message", async () => {
  const s = await setup();
  await context!.db.query(
    `update rate_limit_settings set limit_count = 1 where bucket = 'message.mentions'`
  );
  const response = await s.member
    .post(`/api/v1/clans/${s.clanId}/messages`)
    .send({ body: "Встречаемся с @leader и @moderator" });
  assert.equal(response.status, 429);
  assert.equal(response.body.error.details.bucket, "message.mentions");
});

test("deputy and moderator roles expose only ordinary member permissions", async () => {
  const s = await setup();
  const deputy = await s.deputy.get(`/api/v1/clans/${s.clanId}/chat`);
  const moderator = await s.moderator.get(`/api/v1/clans/${s.clanId}/chat`);
  for (const response of [deputy, moderator]) {
    assert.equal(response.status, 200);
    assert.ok(response.body.permissions.includes("poll.vote"));
    assert.equal(response.body.permissions.includes("poll.create"), false);
    assert.equal(response.body.permissions.includes("message.delete_any"), false);
  }
});
