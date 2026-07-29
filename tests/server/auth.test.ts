import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import request from "supertest";
import {
  BOT_TOKEN,
  USERS,
  createTestContext,
  loginUser,
  signInitData,
  type TestContext
} from "./helpers.js";

let context: TestContext | undefined;
afterEach(async () => {
  await context?.db.end();
  context = undefined;
});

test("production shell outside Telegram does not create a session", async () => {
  context = await createTestContext({ environment: "production", secureCookies: false });
  const response = await request(context.app).get("/app");
  assert.equal(response.status, 200);
  assert.match(response.text, /Откройте приложение через Telegram/);
  assert.equal(response.headers["set-cookie"], undefined);
});

test("protected API rejects a request without a verified session", async () => {
  context = await createTestContext();
  const response = await request(context.app).get("/api/v1/clans");
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "authentication_required");
});

test("invalid Telegram initData is rejected", async () => {
  context = await createTestContext();
  const response = await request(context.app)
    .post("/api/v1/auth/telegram")
    .send({ initData: "auth_date=1&user=%7B%7D&hash=00" });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "telegram_auth_failed");
});

test("Telegram initData signed with another bot token is rejected", async () => {
  context = await createTestContext();
  const response = await request(context.app)
    .post("/api/v1/auth/telegram")
    .send({ initData: signInitData(USERS.member, { botToken: `${BOT_TOKEN}-wrong` }) });
  assert.equal(response.status, 401);
});

test("expired Telegram initData is rejected", async () => {
  context = await createTestContext();
  const response = await request(context.app)
    .post("/api/v1/auth/telegram")
    .send({
      initData: signInitData(USERS.member, {
        authDate: Math.floor(Date.now() / 1000) - 3600
      })
    });
  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /expired/i);
});

test("tampering with Telegram user id invalidates the signature", async () => {
  context = await createTestContext();
  const params = new URLSearchParams(signInitData(USERS.member));
  params.set("user", JSON.stringify({ ...USERS.member, id: USERS.leader.id }));
  const response = await request(context.app)
    .post("/api/v1/auth/telegram")
    .send({ initData: params.toString() });
  assert.equal(response.status, 401);
});

test("an extra body user id cannot select another account", async () => {
  context = await createTestContext();
  const agent = request.agent(context.app);
  const login = await agent
    .post("/api/v1/auth/telegram")
    .send({
      initData: signInitData(USERS.member),
      userId: USERS.leader.id,
      telegramUserId: USERS.leader.id
    });
  assert.equal(login.status, 201);
  assert.equal(login.body.user.id, `tg:${USERS.member.id}`);
  const session = await agent.get("/api/v1/auth/session");
  assert.equal(session.body.user.id, `tg:${USERS.member.id}`);
});

test("an authenticated user sees only the account bound to the session", async () => {
  context = await createTestContext();
  const member = await loginUser(context, USERS.member);
  await loginUser(context, USERS.leader);
  const response = await member
    .get("/api/v1/auth/session")
    .query({ userId: `tg:${USERS.leader.id}` });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, `tg:${USERS.member.id}`);
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(String(USERS.leader.id)));
});

test("a user session cannot open administrator APIs", async () => {
  context = await createTestContext();
  const member = await loginUser(context, USERS.member);
  const response = await member.get("/api/v1/admin/chats");
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "admin_authentication_required");
});

test("an administrator session cannot replace Telegram user authentication", async () => {
  context = await createTestContext();
  const response = await context.adminAgent.get("/api/v1/clans");
  assert.equal(response.status, 401);
});

test("a blocked BALI account cannot create a new Telegram session", async () => {
  context = await createTestContext();
  const first = await loginUser(context, USERS.member);
  await first.post("/api/v1/auth/logout");
  await context.db.query(
    `update app_users set account_status = 'blocked', blocked_at = now()
      where user_key = $1`,
    [`tg:${USERS.member.id}`]
  );
  const response = await request(context.app)
    .post("/api/v1/auth/telegram")
    .send({ initData: signInitData(USERS.member) });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "account_blocked");
});

test("invalid administrator credentials do not create an admin session", async () => {
  context = await createTestContext();
  const response = await request(context.app)
    .post("/api/v1/auth/admin/login")
    .send({ email: "admin@bali.test", password: "wrong-password" });
  assert.equal(response.status, 401);
  assert.equal(response.headers["set-cookie"], undefined);
});
