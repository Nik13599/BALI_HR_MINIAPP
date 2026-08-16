import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import request from "supertest";
import { createTestContext, type TestContext } from "./helpers.js";

const root = process.cwd();
const read = (filename: string) => fs.readFile(path.join(root, filename), "utf8");
let context: TestContext | undefined;

afterEach(async () => {
  await context?.db.end();
  context = undefined;
});

for (const route of [
  "/api/v1/events",
  "/api/v1/people/me/export",
  "/api/v1/bookings/my",
  "/api/v1/economy/points",
  "/api/v1/economy/rewards",
  "/api/v1/economy/gifts",
  "/api/v1/economy/vip",
  "/api/v1/economy/shop",
  "/api/v1/game",
  "/api/v1/notifications",
  "/api/v1/social/connections"
]) {
  test(`production user API ${route} rejects an unverified browser`, async () => {
    context = await createTestContext();
    const response = await request(context.app).get(route);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "authentication_required");
  });
}

test("production asset upload rejects a public browser before parsing media", async () => {
  context = await createTestContext();
  const response = await request(context.app)
    .post("/api/v1/admin/content/uploads")
    .set("Content-Type", "image/png")
    .send(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "admin_authentication_required");
});

for (const route of [
  "/api/v1/admin/dashboard",
  "/api/v1/admin/crm/users",
  "/api/v1/admin/events",
  "/api/v1/admin/bookings",
  "/api/v1/admin/check-ins",
  "/api/v1/admin/layouts",
  "/api/v1/admin/economy",
  "/api/v1/admin/content",
  "/api/v1/admin/campaigns",
  "/api/v1/admin/moderation",
  "/api/v1/admin/platform-audit"
]) {
  test(`production administrator API ${route} rejects a public browser`, async () => {
    context = await createTestContext();
    const response = await request(context.app).get(route);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "admin_authentication_required");
  });
}

test("production routes serve the integrated full app and control center", async () => {
  context = await createTestContext({ environment: "production" });
  const [app, admin] = await Promise.all([
    request(context.app).get("/app"),
    request(context.app).get("/admin")
  ]);
  assert.equal(app.status, 200);
  assert.match(app.text, /production-loader\.js/);
  assert.match(app.text, /viewport-fit=cover/);
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.location, "/site/admin-production.html");
  const adminPage = await request(context.app).get(admin.headers.location);
  assert.equal(adminPage.status, 200);
  assert.match(adminPage.text, /admin-match3-game-beta4\.js/);
  assert.match(adminPage.text, /data-view="crown"/);
  assert.match(adminPage.text, /data-view="clans"/);
  assert.match(adminPage.text, /admin-beta4-production-sync\.js/);
});

test("production responses apply restrictive browser security headers", async () => {
  context = await createTestContext({ environment: "production" });
  const response = await request(context.app).get("/app");
  assert.match(response.headers["content-security-policy"], /default-src 'self'/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.equal(response.headers["x-bali-environment"], "production");
  assert.match(response.headers["cache-control"], /no-store/);
});

test("API responses disable browser and intermediary caches", async () => {
  context = await createTestContext();
  const response = await request(context.app).get("/api/v1/health");
  assert.match(response.headers["cache-control"], /no-store/);
  assert.equal(response.headers.pragma, "no-cache");
});

test("production client contains no localStorage authority", async () => {
  const client = await read("site/production-client.js");
  assert.doesNotMatch(client, /\blocalStorage\b/);
  assert.match(client, /databaseEnabled:\s*true/);
  assert.match(client, /mode:\s*"production"/);
});

test("production loader uses server adapters and excludes demo authorities", async () => {
  const loader = await read("site/production-loader.js");
  for (const required of [
    "production-client.js",
    "production-booking-qr.js",
    "production-profile-economy.js",
    "production-social-ui.js"
  ]) {
    assert.match(loader, new RegExp(required.replaceAll(".", "\\.")));
  }
  for (const forbidden of [
    "bali-clans-demo-core-beta4.js",
    "fast-event-visuals-beta4.js",
    "event-performer-cards-beta4.js",
    "beta4-menu-categories.js"
  ]) {
    assert.doesNotMatch(loader, new RegExp(forbidden.replaceAll(".", "\\.")));
  }
});

test("production profile status and biography are persisted through the People API", async () => {
  const client = await read("site/production-client.js");
  assert.match(client, /statusText:\s*patchValue\.statusText/);
  assert.match(client, /bio:\s*patchValue\.bio/);
});

test("account export and deletion are server-backed and reversible only from backup", async () => {
  const [people, migration] = await Promise.all([
    read("server/routes/people.ts"),
    read("migrations/014_account_deletion_requests.up.sql")
  ]);
  assert.match(people, /router\.get\("\/me\/export"/);
  assert.match(people, /router\.delete\("\/me"/);
  assert.match(people, /clan_leadership_transfer_required/);
  assert.match(people, /account_status = 'deleted'/);
  assert.match(migration, /account_deletion_requests/);
});

test("manual Telegram identity review prevents automatic CRM merges", async () => {
  const [auth, crm, preflight] = await Promise.all([
    read("server/routes/auth.ts"),
    read("server/routes/admin-crm.ts"),
    read("scripts/preflight.ts")
  ]);
  assert.match(auth, /identity_merge_review_required/);
  assert.match(crm, /\/crm\/merge-reviews/);
  assert.match(crm, /crm\.merge_review\./);
  assert.match(preflight, /pending_manual_merge_reviews/);
});

test("content defaults define the five required app navigation entries", async () => {
  const migration = await read("migrations/012_content_defaults.up.sql");
  for (const item of ["home", "events", "dating", "crown", "profile"]) {
    assert.match(migration, new RegExp(`'app',\\s*'${item}'`));
  }
  assert.match(migration, /recommended_width/);
  assert.match(migration, /original_symbols/);
  assert.match(migration, /original_prizes/);
});

test("production economy renders scannable QR images instead of plaintext-only tokens", async () => {
  const [economy, bookings, profile] = await Promise.all([
    read("server/routes/economy.ts"),
    read("server/routes/bookings.ts"),
    read("site/production-profile-economy.js")
  ]);
  assert.match(economy, /QRCode\.toDataURL/);
  assert.match(bookings, /QRCode\.toDataURL/);
  assert.match(profile, /qrDataUrl/);
});

test("every match-3 level and move is validated by one server game session", async () => {
  const [adapter, ui, route, migration] = await Promise.all([
    read("site/production-match3-infinite.js"),
    read("site/match3-game-ui-beta4.js"),
    read("server/routes/game.ts"),
    read("migrations/017_infinite_match3_levels.up.sql")
  ]);
  assert.match(adapter, /\/api\/v1\/game\/sessions/);
  assert.match(adapter, /\/moves/);
  assert.match(ui, /api\.playMove/);
  assert.match(route, /game_move_sequence_mismatch/);
  assert.match(route, /client_finish_payload/);
  assert.match(migration, /unique \(game_session_id, sequence\)/);
});

test("weekly match-3 seasons are automatic and issue configured Top-10 prizes", async () => {
  const [game, prizes, migration, client] = await Promise.all([
    read("server/routes/game.ts"),
    read("server/game-prizes.ts"),
    read("migrations/016_automatic_game_seasons.up.sql"),
    read("site/production-client.js")
  ]);
  assert.match(game, /ensureCurrentSeason/);
  assert.match(game, /finalizeEndedGameSeasons/);
  assert.match(prizes, /limit 10/);
  assert.match(prizes, /mutatePoints/);
  assert.match(prizes, /user_rewards/);
  assert.match(prizes, /user_vip_subscriptions/);
  assert.match(prizes, /status = 'issued'/);
  assert.match(migration, /match3-weekly-top1/);
  assert.match(migration, /match3-weekly-vip/);
  assert.match(client, /\/api\/v1\/game\/prizes/);
  assert.doesNotMatch(client, /myRewards:\s*\(\)\s*=>\s*\[\]/);
});

test("every versioned migration has a rollback pair", async () => {
  const names = await fs.readdir(path.join(root, "migrations"));
  const up = names.filter(name => name.endsWith(".up.sql")).sort();
  const down = new Set(names.filter(name => name.endsWith(".down.sql")));
  assert.ok(up.length >= 10);
  for (const filename of up) {
    assert.ok(down.has(filename.replace(/\.up\.sql$/, ".down.sql")), filename);
  }
});

test("migration files leave transaction ownership to the runner", async () => {
  const names = (await fs.readdir(path.join(root, "migrations")))
    .filter(name => name.endsWith(".sql"));
  for (const filename of names) {
    const sql = await read(path.join("migrations", filename));
    assert.doesNotMatch(sql, /^\s*(begin|commit|rollback)\s*;/im, filename);
  }
});

test("booking migration prevents concurrent active reservations for one table", async () => {
  const sql = await read("migrations/005_layouts_bookings.up.sql");
  assert.match(sql, /booking_holds_one_active_table_idx/);
  assert.match(sql, /booking_records_one_active_table_idx/);
  assert.match(sql, /where status in \('held', 'new', 'pending', 'confirmed', 'checked_in'\)/i);
});

test("clan migration enforces one active membership per category", async () => {
  const sql = await read("migrations/003_clan_categories.up.sql");
  assert.match(sql, /clan_memberships_one_active_category/);
  assert.match(sql, /where status = 'active'/);
});

test("administrator audit history is immutable", async () => {
  const sql = await read("migrations/007_notifications_audit.up.sql");
  assert.match(sql, /admin_audit_log is immutable/);
  assert.match(sql, /before update or delete on public\.admin_audit_log/i);
});

test("QR migration stores hashes and never plaintext tokens", async () => {
  const sql = await read("migrations/010_qr_operations.up.sql");
  assert.match(sql, /token_hash text not null unique/);
  assert.doesNotMatch(sql, /\btoken text\b/);
  const route = await read("server/routes/admin-operations.ts");
  assert.match(route, /sha256\(token\)/);
});

test("economy operations are idempotent and ledger-backed", async () => {
  const migration = await read("migrations/006_economy_game.up.sql");
  const economy = await read("server/economy.ts");
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /check \(balance_after = balance_before \+ amount\)/);
  assert.match(economy, /for update/);
});

test("physical redemption is snapshotted and QR tokens are not exposed to gift senders", async () => {
  const [route, migration] = await Promise.all([
    read("server/routes/economy.ts"),
    read("migrations/013_order_redemption_snapshot.up.sql")
  ]);
  assert.doesNotMatch(route, /json\(\{\s*gift,\s*qrToken/);
  assert.match(route, /requires_redemption/);
  assert.match(migration, /requires_redemption boolean not null/);
});

test("social and high-value mutations have configurable server rate limits", async () => {
  const migration = await read("migrations/015_social_rate_limits.up.sql");
  for (const bucket of [
    "connection.create",
    "invitation.create",
    "event_invitation.create",
    "direct_message.create",
    "gift.create",
    "booking.hold",
    "game.session"
  ]) {
    assert.match(migration, new RegExp(bucket.replaceAll(".", "\\.")));
  }
});

test("administrator economy actions are wired from CRM to audited server routes", async () => {
  const [routes, ui] = await Promise.all([
    read("server/routes/admin-economy.ts"),
    read("site/admin-platform-ui.js")
  ]);
  for (const route of [
    "/gifts/grants",
    "/vip/grants",
    "/vip/subscriptions/:subscriptionId/revoke"
  ]) {
    assert.match(routes, new RegExp(route.replaceAll("/", "\\/").replace(":subscriptionId", "\\:subscriptionId")));
  }
  assert.match(routes, /action: "gift\.grant"/);
  assert.match(routes, /action: "vip\.grant"/);
  assert.match(routes, /action: "vip\.revoke"/);
  assert.match(ui, /platformCrmReward/);
  assert.match(ui, /platformCrmGift/);
  assert.match(ui, /platformCrmVip/);
  assert.match(ui, /platformCrmClan/);
});

test("clan invitations and administrator membership assignment are integrated", async () => {
  const [clans, admin, ui] = await Promise.all([
    read("server/routes/clans.ts"),
    read("server/routes/admin.ts"),
    read("site/bali-people-clans-beta4.js")
  ]);
  assert.match(clans, /\/invitations\/me/);
  assert.match(clans, /\/:clanId\/invitations/);
  assert.match(clans, /clan_category_membership_conflict/);
  assert.match(admin, /\/clans\/:clanId\/members/);
  assert.match(ui, /clanInvitationForm/);
  assert.match(ui, /data-clan-invitation/);
});

test("campaigns require preview and explicit confirmation", async () => {
  const route = await read("server/routes/admin-content.ts");
  assert.match(route, /'previewed'/);
  assert.match(route, /\/campaigns\/:campaignId\/confirm/);
  assert.match(route, /outbox_jobs/);
});

test("backup and rollback tools require explicit production inputs", async () => {
  const [backup, rollback] = await Promise.all([
    read("scripts/backup.ts"),
    read("scripts/rollback.ts")
  ]);
  assert.match(backup, /DATABASE_URL is required/);
  assert.match(backup, /pg_restore/);
  assert.match(backup, /BALI_UPLOAD_DIR/);
  assert.match(backup, /uploadFiles/);
  assert.match(rollback, /CONFIRM_ROLLBACK/);
  assert.match(rollback, /ROLLBACK_TO/);
});

test("production workflow runs migration, security, demo and build checks", async () => {
  const workflow = await read(".github/workflows/production-checks.yml");
  assert.match(workflow, /npm run migrations:check/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
});
