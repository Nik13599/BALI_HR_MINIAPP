import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

class StorageMock {
  #values = new Map();
  getItem(key) { return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  clear() { this.#values.clear(); }
}

const localStorage = new StorageMock();
const listeners = new Map();
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Map,
  Set,
  localStorage,
  crypto:webcrypto,
  CustomEvent:class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  dispatchEvent(event) { (listeners.get(event.type) || []).forEach(listener => listener(event)); },
  addEventListener(type, listener) {
    const rows = listeners.get(type) || [];
    rows.push(listener);
    listeners.set(type, rows);
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("site/points-core.js", "utf8"), context, { filename:"site/points-core.js" });

let activeProfile = {
  id:"u-active",
  userKey:"u-active",
  ownerKey:"u-active",
  code:"U-ACTIVE",
  name:"Активный гость",
  visits:0,
  referrals:0,
  weeklyRank:0,
  createdAt:"2024-01-01T00:00:00.000Z",
  xp:0
};
context.BaliBeta4Game = {
  profile:() => activeProfile,
  saveProfile:(patch = {}) => (activeProfile = { ...activeProfile, ...patch }),
  identityKeys:(subject = activeProfile) => [subject.userKey, subject.id, subject.ownerKey, subject.code].filter(Boolean),
  addXp:(amount) => (activeProfile = { ...activeProfile, xp:Number(activeProfile.xp || 0) + Number(amount || 0) }),
  config:() => ({ plans:[] }),
  activateVip:() => ({})
};
vm.runInContext(fs.readFileSync("site/beta4-loyalty-core.js", "utf8"), context, { filename:"site/beta4-loyalty-core.js" });

const points = context.BaliPoints;
const loyalty = context.BaliBeta4Loyalty;
const allPermissions = loyalty.REWARD_POINT_PERMISSIONS;
const subject = (id, balance = 0, extra = {}) => {
  const row = { userKey:id, id, code:id.toUpperCase(), name:`Гость ${id}`, balance, ...extra };
  points.saveAccount(row);
  return row;
};
const reward = (id, patch = {}) => loyalty.upsertReward({
  id,
  title:`Награда ${id}`,
  description:"Тест",
  xp:0,
  conditionType:"manual",
  threshold:1,
  active:true,
  repeatable:false,
  awardPointsEnabled:true,
  pointsRewardAmount:100,
  awardPointsMode:"first",
  deductPointsOnRevoke:false,
  ...patch
}, { adminId:"test-admin", permissions:allPermissions });
const balance = id => Number(points.accounts()[id]?.balance || 0);

const zero = reward("zero", { pointsRewardAmount:0 });
const zeroResult = loyalty.grantReward(subject("u-zero"), zero, "admin_manual", { sourceId:"zero-1" });
assert.equal(zeroResult.ok, true, "0-point reward must still be granted");
assert.equal(zeroResult.grant.pointsStatus, "not_applicable");
assert.equal(balance("u-zero"), 0);

const disabled = reward("disabled", { awardPointsEnabled:false, pointsRewardAmount:500 });
const disabledResult = loyalty.grantReward(subject("u-disabled"), disabled, "admin_manual", { sourceId:"disabled-1" });
assert.equal(disabledResult.grant.pointsAwarded, 0, "disabled credit must not change balance");

const standard = reward("standard", { pointsRewardAmount:100 });
const standardResult = loyalty.grantReward(subject("u-standard"), standard, "admin_manual", { sourceId:"standard-1" });
assert.equal(balance("u-standard"), 100, "configured 100 points must be credited");
assert.equal(standardResult.grant.pointsAwarded, 100);

const requestedCoins = reward("coins", { pointsRewardAmount:75, pointsRewardType:"bali_coins" });
assert.equal(requestedCoins.pointsRewardType, "points", "single-wallet app must keep the existing points currency");
assert.equal(localStorage.getItem("bali_coins_accounts_v1"), null, "a duplicate BALI Coins wallet must not be created");

const once = reward("once");
const onceUser = subject("u-once");
assert.equal(loyalty.grantReward(onceUser, once, "auto_event", { sourceId:"event-1" }).ok, true);
const onceRetry = loyalty.grantReward(onceUser, once, "auto_event", { sourceId:"event-2" });
assert.equal(onceRetry.duplicate, true, "one-time reward must not be granted twice");
assert.equal(loyalty.grantsFor(onceUser).filter(row => row.rewardId === once.id).length, 1);

const idempotent = reward("idempotent", { repeatable:true, awardPointsMode:"each" });
const idemUser = subject("u-idem");
const firstEvent = loyalty.grantReward(idemUser, idempotent, "auto_event", { sourceId:"same-event" });
const retryEvent = loyalty.grantReward(idemUser, idempotent, "auto_event", { sourceId:"same-event" });
assert.equal(firstEvent.ok, true);
assert.equal(retryEvent.duplicate, true);
assert.equal(balance("u-idem"), 100, "retry of same event must not double-credit");

const repeatEach = reward("repeat-each", { repeatable:true, awardPointsMode:"each", pointsRewardAmount:60 });
const eachUser = subject("u-each");
loyalty.grantReward(eachUser, repeatEach, "auto_event", { sourceId:"event-a" });
loyalty.grantReward(eachUser, repeatEach, "auto_event", { sourceId:"event-b" });
assert.equal(balance("u-each"), 120, "repeatable each mode must credit every distinct occurrence");

const repeatFirst = reward("repeat-first", { repeatable:true, awardPointsMode:"first", pointsRewardAmount:80 });
const firstUser = subject("u-first");
loyalty.grantReward(firstUser, repeatFirst, "auto_event", { sourceId:"event-a" });
const secondOccurrence = loyalty.grantReward(firstUser, repeatFirst, "auto_event", { sourceId:"event-b" });
assert.equal(balance("u-first"), 80, "repeatable first mode must credit once");
assert.equal(secondOccurrence.grant.pointsStatus, "skipped_repeat");

const manual = reward("manual", { pointsRewardAmount:90 });
const manualResult = loyalty.grantReward(subject("u-manual"), manual, "admin_manual", { adminId:"test-admin", permissions:allPermissions });
assert.equal(manualResult.grant.pointsAwarded, 90, "manual award must use configured value");

const override = reward("override", { pointsRewardAmount:90 });
assert.equal(loyalty.previewGrant(subject("u-no-override"), override, { permissions:[], overridePoints:10 }).ok, false, "override must require explicit permission");
assert.equal(loyalty.upsertReward({ id:"negative", title:"Negative", pointsRewardAmount:-1 }, { permissions:allPermissions }).ok, false, "negative configuration must be rejected");
const overrideResult = loyalty.grantReward(subject("u-override"), override, "admin_manual", {
  adminId:"test-admin",
  permissions:allPermissions,
  overridePoints:25,
  overrideReason:"Тестовая корректировка"
});
assert.equal(overrideResult.grant.pointsAwarded, 25, "authorized override must replace configured value");
assert.equal(loyalty.audit({ action:"reward_points_override" }).some(row => row.userRewardId === overrideResult.grant.id), true);

const bulk = reward("bulk", { pointsRewardAmount:30 });
const bulkUsers = [subject("u-bulk-1"), subject("u-bulk-2"), subject("u-bulk-3")];
const bulkPreview = loyalty.previewBulk(bulkUsers, bulk);
assert.equal(bulkPreview.maxTotal, 90);
const bulkResult = loyalty.bulkGrant(bulkUsers, bulk, { batchId:"batch-fixed", adminId:"test-admin", permissions:allPermissions });
assert.equal(bulkResult.results.filter(row => row.ok).length, 3);
const bulkRetry = loyalty.bulkGrant(bulkUsers, bulk, { batchId:"batch-fixed", adminId:"test-admin", permissions:allPermissions });
assert.equal(bulkRetry.results.every(row => row.duplicate || row.skipped), true, "same bulk batch must be idempotent");

localStorage.setItem("bali_event_checkins_v1", JSON.stringify({ eventCheck:{ event_id:"event-auto", user_key:"u-event" } }));
const eventReward = reward("auto-event", { conditionType:"event", eventId:"event-auto", pointsRewardAmount:40 });
const eventUser = subject("u-event");
assert.equal(loyalty.evaluateRewards(eventUser).some(row => row.id === eventReward.id), true, "event condition must auto-award");
assert.equal(balance("u-event"), 40);

const rankingReward = reward("auto-ranking", { conditionType:"ranking", threshold:10, repeatable:true, awardPointsMode:"each", pointsRewardAmount:55 });
const rankingUser = subject("u-ranking", 0, { weeklyRank:4, rankingWeekId:"2026-W30" });
assert.equal(loyalty.evaluateRewards(rankingUser).some(row => row.id === rankingReward.id), true, "ranking condition must auto-award");

const referralReward = reward("auto-referral", { conditionType:"referrals", threshold:3, repeatable:true, awardPointsMode:"first", pointsRewardAmount:65 });
const referralUser = subject("u-referral", 0, { referrals:3 });
assert.equal(loyalty.evaluateRewards(referralUser).some(row => row.id === referralReward.id), true, "referral condition must auto-award");

const keepPoints = reward("revoke-keep", { pointsRewardAmount:70, deductPointsOnRevoke:false });
const keepGrant = loyalty.grantReward(subject("u-keep"), keepPoints, "admin_manual", { sourceId:"keep" }).grant;
loyalty.revokeReward(keepGrant.id, { adminId:"test-admin", permissions:allPermissions });
assert.equal(balance("u-keep"), 70, "revoke defaults to keeping credited points");

const deductPoints = reward("revoke-deduct", { pointsRewardAmount:70, deductPointsOnRevoke:true });
const deductGrant = loyalty.grantReward(subject("u-deduct"), deductPoints, "admin_manual", { sourceId:"deduct" }).grant;
const deductResult = loyalty.revokeReward(deductGrant.id, { adminId:"test-admin", permissions:allPermissions });
assert.equal(deductResult.ok, true);
assert.equal(balance("u-deduct"), 0, "configured revoke must use existing deduction rules");

const partialPoints = reward("revoke-partial", { pointsRewardAmount:100, deductPointsOnRevoke:true });
const partialGrant = loyalty.grantReward(subject("u-partial"), partialPoints, "admin_manual", { sourceId:"partial" }).grant;
points.adjustAccount({ userKey:"u-partial" }, -60, "Покупка перед отзывом");
const partialResult = loyalty.revokeReward(partialGrant.id, { adminId:"test-admin", permissions:allPermissions });
assert.equal(partialResult.deduction.partial, true, "insufficient balance must follow existing clamp-to-zero policy");
assert.equal(balance("u-partial"), 0);

const rewardLedgerRow = points.ledger().find(row => row.metadata?.userRewardId === standardResult.grant.id);
assert.ok(rewardLedgerRow, "points history must link to user_reward");
assert.equal(rewardLedgerRow.metadata.rewardId, standard.id);
assert.equal(typeof rewardLedgerRow.balanceBefore, "number");
assert.equal(typeof rewardLedgerRow.balanceAfter, "number");

const auditRow = loyalty.audit().find(row => row.userRewardId === standardResult.grant.id && row.action === "reward_points_credited");
assert.ok(auditRow, "structured audit must record automatic credit");
assert.equal(auditRow.transactionId, rewardLedgerRow.id);

const beforeNoDouble = balance("u-idem");
loyalty.grantReward(idemUser, idempotent, "auto_event", { sourceId:"same-event" });
assert.equal(balance("u-idem"), beforeNoDouble, "repeated processing must never double-credit");

assert.equal(fs.readFileSync("site/beta4-loyalty-core.js", "utf8").includes("BaliBeta4Match"), false, "reward-points service must not modify or couple to Match-3");
const adminSource = fs.readFileSync("site/admin-custom-rewards-beta4.js", "utf8");
assert.ok(adminSource.includes('name="pointsRewardAmount"') && adminSource.includes("previewBulk") && adminSource.includes("data-revoke-reward"), "admin must expose configuration, bulk preview, and revoke");
const userSource = fs.readFileSync("site/beta4-loyalty-ui-stable.js", "utf8");
assert.ok(userSource.includes("Получено ${number(grant.pointsAwarded)} баллов") && userSource.includes("За получение:"), "user reward cards must show future and credited amounts");
const migration = fs.readFileSync("site/supabase-v14-reward-points-migration.sql", "utf8");
assert.ok(migration.includes("award_reward_with_points") && migration.includes("revoke_reward_with_points") && migration.includes("idempotency_key text not null unique"), "server migration must enforce transactional idempotency");

console.log("Reward points smoke test passed: 21 acceptance scenarios");
