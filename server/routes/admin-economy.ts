import { randomUUID } from "node:crypto";
import { Router } from "express";
import { writeAdminAudit } from "../audit.js";
import { many, one, transaction } from "../db.js";
import { mutatePoints } from "../economy.js";
import { ApiError, asyncHandler } from "../errors.js";
import { finalizeGameSeason } from "../game-prizes.js";
import { requireAdmin } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  boundedNumber,
  enumValue,
  identifier,
  isoDateOrNull,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";

const RARITIES = ["common", "rare", "epic", "legendary"] as const;
const GIFT_TYPES = ["virtual", "physical"] as const;
const SHOP_STATUSES = ["draft", "active", "sold_out", "archived"] as const;
const SEASON_STATUSES = ["scheduled", "active", "completed", "archived"] as const;

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ApiError(400, `${field} must be an object`, "validation_error");
  }
  return value as Record<string, unknown>;
}

function jsonArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new ApiError(400, `${field} must be an array`, "validation_error");
  return value;
}

async function targetRow(
  db: Queryable,
  table: string,
  id: string
): Promise<any> {
  const allowed = new Set([
    "reward_definitions", "gift_catalog", "vip_plans", "shop_items", "game_seasons"
  ]);
  if (!allowed.has(table)) throw new Error("Unsupported administrator catalog table");
  const row = await one<any>(db, `select * from public.${table} where id = $1`, [id]);
  if (!row) throw new ApiError(404, "Catalog item was not found", "not_found");
  return row;
}

export function createAdminEconomyRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/economy", asyncHandler(async (_req, res) => {
    const [
      settings,
      rewards,
      gifts,
      vipPlans,
      shopItems,
      gameSettings,
      seasons
    ] = await Promise.all([
      one<any>(db, `select * from public.economy_settings where singleton = true`),
      many<any>(db, `select * from public.reward_definitions order by updated_at desc`),
      many<any>(db, `select * from public.gift_catalog order by sort_order, name`),
      many<any>(db, `select * from public.vip_plans order by sort_order, points_cost`),
      many<any>(db, `select * from public.shop_items order by sort_order, name`),
      one<any>(db, `select * from public.game_settings where singleton = true`),
      many<any>(db, `select * from public.game_seasons order by starts_at desc`)
    ]);
    res.json({ settings, rewards, gifts, vipPlans, shopItems, gameSettings, seasons });
  }));

  router.patch("/economy/settings", asyncHandler(async (req, res) => {
    const before = await one<any>(db, `select * from public.economy_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Economy settings are missing", "economy_settings_missing");
    const settings = await one<any>(
      db,
      `update public.economy_settings
          set registration_points = $1, profile_completion_points = $2,
              checkin_points = $3, invited_friend_points = $4,
              clan_activity_points = $5, updated_by_admin_id = $6,
              updated_at = now()
        where singleton = true returning *`,
      [
        boundedInteger(req.body?.registrationPoints, Number(before.registration_points), 0, 1_000_000_000),
        boundedInteger(req.body?.profileCompletionPoints, Number(before.profile_completion_points), 0, 1_000_000_000),
        boundedInteger(req.body?.checkinPoints, Number(before.checkin_points), 0, 1_000_000_000),
        boundedInteger(req.body?.invitedFriendPoints, Number(before.invited_friend_points), 0, 1_000_000_000),
        boundedInteger(req.body?.clanActivityPoints, Number(before.clan_activity_points), 0, 1_000_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "economy.settings.update",
      targetType: "economy_settings",
      targetId: "singleton",
      reason: requiredText(req.body?.reason, "reason", 1000),
      before,
      after: settings
    });
    res.json({ settings });
  }));

  router.get("/points/ledger", asyncHandler(async (req, res) => {
    const userKey = req.query.userKey ? identifier(req.query.userKey, "userKey") : null;
    const ledger = await many<any>(
      db,
      `select ledger.*, user_row.name, user_row.username, admin.email as administrator_email
         from public.point_ledger ledger
         join public.app_users user_row on user_row.user_key = ledger.user_key
         left join public.admin_users admin on admin.id = ledger.administrator_id
        where ($1::text is null or ledger.user_key = $1)
        order by ledger.created_at desc limit 1000`,
      [userKey]
    );
    res.json({ ledger });
  }));

  router.post("/points/adjustments", asyncHandler(async (req, res) => {
    const userKey = identifier(req.body?.userKey, "userKey");
    const amount = boundedInteger(req.body?.amount, 0, -1_000_000_000, 1_000_000_000);
    if (!amount) throw new ApiError(400, "amount must not be zero", "validation_error");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const result = await mutatePoints(db, {
      userKey,
      amount,
      operationType: "adjustment",
      sourceType: "admin",
      sourceId: req.adminPrincipal!.adminId,
      reason,
      administratorId: req.adminPrincipal!.adminId,
      idempotencyKey: `admin-adjustment:${key}`
    });
    await writeAdminAudit(db, req, {
      action: "points.adjust",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.ledger
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/rewards", asyncHandler(async (req, res) => {
    const rewardId = req.body?.id ? identifier(req.body.id, "id") : `reward-${randomUUID()}`;
    const config = req.body?.conditionConfig === undefined
      ? {}
      : jsonObject(req.body.conditionConfig, "conditionConfig");
    const reward = await one<any>(
      db,
      `insert into public.reward_definitions(
         id, name, icon_url, description, points, xp, rarity, condition_type,
         condition_config, event_id, clan_id, valid_from, valid_until,
         repeatable, max_grants_per_user, active, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
       returning *`,
      [
        rewardId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.iconUrl, 2000),
        optionalText(req.body?.description, 2000),
        boundedInteger(req.body?.points, 0, 0, 1_000_000_000),
        boundedInteger(req.body?.xp, 0, 0, 1_000_000_000),
        enumValue(req.body?.rarity || "common", "rarity", RARITIES),
        requiredText(req.body?.conditionType || "manual", "conditionType", 100),
        JSON.stringify(config),
        req.body?.eventId ? identifier(req.body.eventId, "eventId") : null,
        req.body?.clanId ? identifier(req.body.clanId, "clanId") : null,
        isoDateOrNull(req.body?.validFrom),
        isoDateOrNull(req.body?.validUntil),
        booleanValue(req.body?.repeatable),
        boundedInteger(req.body?.maxGrantsPerUser, 1, 1, 1_000_000),
        booleanValue(req.body?.active, true),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "reward.create",
      targetType: "reward_definition",
      targetId: rewardId,
      after: reward
    });
    res.status(201).json({ reward });
  }));

  router.patch("/rewards/:rewardId", asyncHandler(async (req, res) => {
    const rewardId = identifier(req.params.rewardId, "rewardId");
    const before = await targetRow(db, "reward_definitions", rewardId);
    const config = req.body?.conditionConfig === undefined
      ? before.condition_config
      : jsonObject(req.body.conditionConfig, "conditionConfig");
    const reward = await one<any>(
      db,
      `update public.reward_definitions
          set name = $2, icon_url = $3, description = $4, points = $5, xp = $6,
              rarity = $7, condition_type = $8, condition_config = $9::jsonb,
              valid_from = $10, valid_until = $11, repeatable = $12,
              max_grants_per_user = $13, active = $14, updated_at = now()
        where id = $1 returning *`,
      [
        rewardId,
        req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.iconUrl === undefined ? before.icon_url : optionalText(req.body.iconUrl, 2000),
        req.body?.description === undefined ? before.description : optionalText(req.body.description, 2000),
        boundedInteger(req.body?.points, Number(before.points), 0, 1_000_000_000),
        boundedInteger(req.body?.xp, Number(before.xp), 0, 1_000_000_000),
        req.body?.rarity === undefined ? before.rarity : enumValue(req.body.rarity, "rarity", RARITIES),
        req.body?.conditionType === undefined
          ? before.condition_type
          : requiredText(req.body.conditionType, "conditionType", 100),
        JSON.stringify(config),
        req.body?.validFrom === undefined ? before.valid_from : isoDateOrNull(req.body.validFrom),
        req.body?.validUntil === undefined ? before.valid_until : isoDateOrNull(req.body.validUntil),
        req.body?.repeatable === undefined ? before.repeatable : booleanValue(req.body.repeatable),
        boundedInteger(req.body?.maxGrantsPerUser, Number(before.max_grants_per_user), 1, 1_000_000),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "reward.update",
      targetType: "reward_definition",
      targetId: rewardId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: reward
    });
    res.json({ reward });
  }));

  router.post("/rewards/:rewardId/grants", asyncHandler(async (req, res) => {
    const rewardId = identifier(req.params.rewardId, "rewardId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const reward = await targetRow(db, "reward_definitions", rewardId);
    const result = await transaction(db, async client => {
      const existing = await one<any>(
        client,
        `select * from public.user_rewards where idempotency_key = $1`,
        [`reward-grant:${key}`]
      );
      if (existing) return { grant: existing, replayed: true };
      const count = await one<any>(
        client,
        `select count(*)::integer as count from public.user_rewards
          where reward_id = $1 and user_key = $2 and status <> 'revoked'`,
        [rewardId, userKey]
      );
      if (!reward.repeatable && Number(count?.count || 0) > 0) {
        throw new ApiError(409, "This reward has already been granted", "reward_already_granted");
      }
      if (Number(count?.count || 0) >= Number(reward.max_grants_per_user)) {
        throw new ApiError(409, "Reward grant limit reached", "reward_grant_limit");
      }
      let pointTransactionId = null;
      if (Number(reward.points) > 0) {
        const pointResult = await mutatePoints(client, {
          userKey,
          amount: Number(reward.points),
          operationType: "credit",
          sourceType: "reward",
          sourceId: rewardId,
          reason: `Награда: ${reward.name}`,
          administratorId: req.adminPrincipal!.adminId,
          idempotencyKey: `reward-points:${key}`
        });
        pointTransactionId = pointResult.ledger.id;
      }
      const grant = await one<any>(
        client,
        `insert into public.user_rewards(
           reward_id, user_key, source_type, source_id, idempotency_key,
           granted_by_admin_id, metadata
         ) values ($1,$2,'admin',$3,$4,$5,$6::jsonb)
         returning *`,
        [
          rewardId,
          userKey,
          req.adminPrincipal!.adminId,
          `reward-grant:${key}`,
          req.adminPrincipal!.adminId,
          JSON.stringify({ pointTransactionId })
        ]
      );
      await client.query(
        `update public.game_profiles
            set xp = xp + $2, updated_at = now()
          where user_key = $1`,
        [userKey, Number(reward.xp || 0)]
      );
      return { grant, replayed: false };
    });
    await writeAdminAudit(db, req, {
      action: "reward.grant",
      targetType: "app_user",
      targetId: userKey,
      reason: requiredText(req.body?.reason, "reason", 1000),
      after: result.grant
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/gifts/catalog", asyncHandler(async (req, res) => {
    const itemId = req.body?.id ? identifier(req.body.id, "id") : `gift-${randomUUID()}`;
    const gift = await one<any>(
      db,
      `insert into public.gift_catalog(
         id, name, description, image_url, gift_type, points_cost,
         validity_days, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [
        itemId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.description, 2000),
        optionalText(req.body?.imageUrl, 2000),
        enumValue(req.body?.giftType || "virtual", "giftType", GIFT_TYPES),
        boundedInteger(req.body?.pointsCost, 0, 0, 1_000_000_000),
        req.body?.validityDays === null
          ? null
          : boundedInteger(req.body?.validityDays, 365, 1, 3650),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "gift.catalog.create",
      targetType: "gift_catalog",
      targetId: itemId,
      after: gift
    });
    res.status(201).json({ gift });
  }));

  router.patch("/gifts/catalog/:itemId", asyncHandler(async (req, res) => {
    const itemId = identifier(req.params.itemId, "itemId");
    const before = await targetRow(db, "gift_catalog", itemId);
    const gift = await one<any>(
      db,
      `update public.gift_catalog
          set name = $2, description = $3, image_url = $4, gift_type = $5,
              points_cost = $6, validity_days = $7, active = $8,
              sort_order = $9, updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.description === undefined ? before.description : optionalText(req.body.description, 2000),
        req.body?.imageUrl === undefined ? before.image_url : optionalText(req.body.imageUrl, 2000),
        req.body?.giftType === undefined
          ? before.gift_type
          : enumValue(req.body.giftType, "giftType", GIFT_TYPES),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1_000_000_000),
        req.body?.validityDays === undefined
          ? before.validity_days
          : req.body.validityDays === null
            ? null
            : boundedInteger(req.body.validityDays, 365, 1, 3650),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "gift.catalog.update",
      targetType: "gift_catalog",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: gift
    });
    res.json({ gift });
  }));

  router.post("/gifts/grants", asyncHandler(async (req, res) => {
    const catalogItemId = identifier(req.body?.catalogItemId, "catalogItemId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const message = optionalText(req.body?.message, 500);
    let result: { gift: any; replayed: boolean };
    try {
      result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.gifts where idempotency_key = $1`,
        [`admin-gift:${key}`]
      );
      if (replay) {
        if (replay.recipient_user_key !== userKey || replay.catalog_item_id !== catalogItemId) {
          throw new ApiError(409, "Idempotency key was used for another gift", "idempotency_conflict");
        }
        return { gift: replay, replayed: true };
      }
      const [catalog, recipient] = await Promise.all([
        one<any>(client, `select * from public.gift_catalog where id = $1`, [catalogItemId]),
        one<any>(
          client,
          `select user_key from public.app_users where user_key = $1 and account_status = 'active'`,
          [userKey]
        )
      ]);
      if (!catalog) throw new ApiError(404, "Gift catalog item was not found", "not_found");
      if (!recipient) throw new ApiError(404, "Active recipient was not found", "not_found");
      const gift = await one<any>(
        client,
        `insert into public.gifts(
           catalog_item_id, sender_user_key, recipient_user_key, points_cost,
           message, status, qr_token_hash, expires_at, idempotency_key
         ) values (
           $1,null,$2,0,$3,'delivered',null,
           case when $4::integer is null then null else now() + make_interval(days => $4) end,
           $5
         ) returning *`,
        [catalogItemId, userKey, message, catalog.validity_days, `admin-gift:${key}`]
      );
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'gift_received','Подарок от BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
        [
          userKey,
          message || `Вам выдан подарок «${catalog.name}».`,
          JSON.stringify({ giftId: gift!.id, catalogItemId }),
          `admin-gift-notification:${key}`
        ]
      );
        return { gift, replayed: false };
      });
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
      const replay = await one<any>(
        db,
        `select * from public.gifts where idempotency_key = $1`,
        [`admin-gift:${key}`]
      );
      if (!replay || replay.recipient_user_key !== userKey || replay.catalog_item_id !== catalogItemId) {
        throw new ApiError(409, "Idempotency key was used for another gift", "idempotency_conflict");
      }
      result = { gift: replay, replayed: true };
    }
    await writeAdminAudit(db, req, {
      action: "gift.grant",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.gift
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/vip/plans", asyncHandler(async (req, res) => {
    const planId = req.body?.id ? identifier(req.body.id, "id") : `vip-${randomUUID()}`;
    const vipPlan = await one<any>(
      db,
      `insert into public.vip_plans(
         id, name, points_cost, duration_days, benefits, points_multiplier,
         extra_game_lives, event_access, shop_access, booking_priority,
         profile_frame_url, badge_url, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15)
       returning *`,
      [
        planId,
        requiredText(req.body?.name, "name", 160),
        boundedInteger(req.body?.pointsCost, 0, 0, 1_000_000_000),
        boundedInteger(req.body?.durationDays, 30, 1, 3650),
        JSON.stringify(jsonArray(req.body?.benefits || [], "benefits")),
        boundedNumber(req.body?.pointsMultiplier, 1, 1, 100),
        boundedInteger(req.body?.extraGameLives, 0, 0, 1000),
        JSON.stringify(jsonArray(req.body?.eventAccess || [], "eventAccess")),
        JSON.stringify(jsonArray(req.body?.shopAccess || [], "shopAccess")),
        boundedInteger(req.body?.bookingPriority, 0, -1000, 1000),
        optionalText(req.body?.profileFrameUrl, 2000),
        optionalText(req.body?.badgeUrl, 2000),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "vip.plan.create",
      targetType: "vip_plan",
      targetId: planId,
      after: vipPlan
    });
    res.status(201).json({ vipPlan });
  }));

  router.patch("/vip/plans/:planId", asyncHandler(async (req, res) => {
    const planId = identifier(req.params.planId, "planId");
    const before = await targetRow(db, "vip_plans", planId);
    const vipPlan = await one<any>(
      db,
      `update public.vip_plans
          set name = $2, points_cost = $3, duration_days = $4, benefits = $5::jsonb,
              points_multiplier = $6, extra_game_lives = $7,
              event_access = $8::jsonb, shop_access = $9::jsonb,
              booking_priority = $10, profile_frame_url = $11,
              badge_url = $12, active = $13, sort_order = $14, updated_at = now()
        where id = $1 returning *`,
      [
        planId,
        req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 160),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1_000_000_000),
        boundedInteger(req.body?.durationDays, Number(before.duration_days), 1, 3650),
        JSON.stringify(req.body?.benefits === undefined ? before.benefits : jsonArray(req.body.benefits, "benefits")),
        boundedNumber(req.body?.pointsMultiplier, Number(before.points_multiplier), 1, 100),
        boundedInteger(req.body?.extraGameLives, Number(before.extra_game_lives), 0, 1000),
        JSON.stringify(req.body?.eventAccess === undefined ? before.event_access : jsonArray(req.body.eventAccess, "eventAccess")),
        JSON.stringify(req.body?.shopAccess === undefined ? before.shop_access : jsonArray(req.body.shopAccess, "shopAccess")),
        boundedInteger(req.body?.bookingPriority, Number(before.booking_priority), -1000, 1000),
        req.body?.profileFrameUrl === undefined
          ? before.profile_frame_url
          : optionalText(req.body.profileFrameUrl, 2000),
        req.body?.badgeUrl === undefined ? before.badge_url : optionalText(req.body.badgeUrl, 2000),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "vip.plan.update",
      targetType: "vip_plan",
      targetId: planId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: vipPlan
    });
    res.json({ vipPlan });
  }));

  router.post("/vip/grants", asyncHandler(async (req, res) => {
    const planId = identifier(req.body?.planId, "planId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    let result: { subscription: any; replayed: boolean };
    try {
      result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.user_vip_subscriptions where idempotency_key = $1`,
        [`admin-vip:${key}`]
      );
      if (replay) {
        if (replay.user_key !== userKey || replay.plan_id !== planId) {
          throw new ApiError(409, "Idempotency key was used for another VIP grant", "idempotency_conflict");
        }
        return { subscription: replay, replayed: true };
      }
      const [plan, user, current] = await Promise.all([
        one<any>(client, `select * from public.vip_plans where id = $1`, [planId]),
        one<any>(
          client,
          `select user_key from public.app_users where user_key = $1 and account_status = 'active'`,
          [userKey]
        ),
        one<any>(
          client,
          `select ends_at from public.user_vip_subscriptions
            where user_key = $1 and status in ('active','scheduled') and ends_at > now()
            order by ends_at desc limit 1 for update`,
          [userKey]
        )
      ]);
      if (!plan) throw new ApiError(404, "VIP plan was not found", "not_found");
      if (!user) throw new ApiError(404, "Active user was not found", "not_found");
      const durationDays = boundedInteger(
        req.body?.durationDays,
        Number(plan.duration_days),
        1,
        3650
      );
      const startsAt = current ? new Date(current.ends_at) : new Date();
      const endsAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
      const subscription = await one<any>(
        client,
        `insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, starts_at, ends_at, status,
           issued_by_admin_id, idempotency_key
         ) values ($1,$2,'admin',$3,$4,$5,$6,$7)
         returning *`,
        [
          userKey,
          planId,
          startsAt.toISOString(),
          endsAt.toISOString(),
          startsAt.getTime() > Date.now() ? "scheduled" : "active",
          req.adminPrincipal!.adminId,
          `admin-vip:${key}`
        ]
      );
      await client.query(
        `update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1`,
        [userKey, endsAt.toISOString()]
      );
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'vip_granted','VIP от BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
        [
          userKey,
          `Вам выдан VIP «${plan.name}» на ${durationDays} дн.`,
          JSON.stringify({ subscriptionId: subscription!.id, planId, endsAt: endsAt.toISOString() }),
          `admin-vip-notification:${key}`
        ]
      );
        return { subscription, replayed: false };
      });
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
      const replay = await one<any>(
        db,
        `select * from public.user_vip_subscriptions where idempotency_key = $1`,
        [`admin-vip:${key}`]
      );
      if (!replay || replay.user_key !== userKey || replay.plan_id !== planId) {
        throw new ApiError(409, "Idempotency key was used for another VIP grant", "idempotency_conflict");
      }
      result = { subscription: replay, replayed: true };
    }
    await writeAdminAudit(db, req, {
      action: "vip.grant",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.subscription
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/vip/subscriptions/:subscriptionId/revoke", asyncHandler(async (req, res) => {
    const subscriptionId = uuid(req.params.subscriptionId, "subscriptionId");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const result = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.user_vip_subscriptions where id = $1 for update`,
        [subscriptionId]
      );
      if (!before) throw new ApiError(404, "VIP subscription was not found", "not_found");
      if (before.status === "revoked") return { before, subscription: before, replayed: true };
      const subscription = await one<any>(
        client,
        `update public.user_vip_subscriptions
            set status = 'revoked', revoked_by_admin_id = $2, revoked_at = now(),
                revocation_reason = $3, updated_at = now()
          where id = $1 returning *`,
        [subscriptionId, req.adminPrincipal!.adminId, reason]
      );
      const remaining = await one<any>(
        client,
        `select max(ends_at) as vip_expires_at
           from public.user_vip_subscriptions
          where user_key = $1 and id <> $2
            and status in ('active','scheduled') and ends_at > now()`,
        [before.user_key, subscriptionId]
      );
      await client.query(
        `update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1`,
        [before.user_key, remaining?.vip_expires_at || null]
      );
      return { before, subscription, replayed: false };
    });
    if (!result.replayed) {
      await writeAdminAudit(db, req, {
        action: "vip.revoke",
        targetType: "user_vip_subscription",
        targetId: subscriptionId,
        reason,
        before: result.before,
        after: result.subscription
      });
    }
    res.json({ subscription: result.subscription, replayed: result.replayed });
  }));

  router.post("/shop/items", asyncHandler(async (req, res) => {
    const itemId = req.body?.id ? identifier(req.body.id, "id") : `shop-${randomUUID()}`;
    const metadata = req.body?.metadata === undefined ? {} : jsonObject(req.body.metadata, "metadata");
    const shopItem = await one<any>(
      db,
      `insert into public.shop_items(
         id, name, description, image_url, category, points_cost, stock,
         valid_from, valid_until, status, per_user_limit, requires_redemption,
         sort_order, metadata, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       returning *`,
      [
        itemId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.description, 2000),
        optionalText(req.body?.imageUrl, 2000),
        requiredText(req.body?.category || "other", "category", 100),
        boundedInteger(req.body?.pointsCost, 0, 0, 1_000_000_000),
        req.body?.stock === null ? null : boundedInteger(req.body?.stock, 0, 0, 1_000_000_000),
        isoDateOrNull(req.body?.validFrom),
        isoDateOrNull(req.body?.validUntil),
        enumValue(req.body?.status || "draft", "status", SHOP_STATUSES),
        req.body?.perUserLimit === null
          ? null
          : boundedInteger(req.body?.perUserLimit, 1, 1, 1_000_000),
        booleanValue(req.body?.requiresRedemption),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        JSON.stringify(metadata),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "shop.item.create",
      targetType: "shop_item",
      targetId: itemId,
      after: shopItem
    });
    res.status(201).json({ shopItem });
  }));

  router.patch("/shop/items/:itemId", asyncHandler(async (req, res) => {
    const itemId = identifier(req.params.itemId, "itemId");
    const before = await targetRow(db, "shop_items", itemId);
    const metadata = req.body?.metadata === undefined
      ? before.metadata
      : jsonObject(req.body.metadata, "metadata");
    const shopItem = await one<any>(
      db,
      `update public.shop_items
          set name = $2, description = $3, image_url = $4, category = $5,
              points_cost = $6, stock = $7, valid_from = $8, valid_until = $9,
              status = $10, per_user_limit = $11, requires_redemption = $12,
              sort_order = $13, metadata = $14::jsonb, updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.description === undefined ? before.description : optionalText(req.body.description, 2000),
        req.body?.imageUrl === undefined ? before.image_url : optionalText(req.body.imageUrl, 2000),
        req.body?.category === undefined ? before.category : requiredText(req.body.category, "category", 100),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1_000_000_000),
        req.body?.stock === undefined
          ? before.stock
          : req.body.stock === null ? null : boundedInteger(req.body.stock, 0, 0, 1_000_000_000),
        req.body?.validFrom === undefined ? before.valid_from : isoDateOrNull(req.body.validFrom),
        req.body?.validUntil === undefined ? before.valid_until : isoDateOrNull(req.body.validUntil),
        req.body?.status === undefined
          ? before.status
          : enumValue(req.body.status, "status", SHOP_STATUSES),
        req.body?.perUserLimit === undefined
          ? before.per_user_limit
          : req.body.perUserLimit === null
            ? null
            : boundedInteger(req.body.perUserLimit, 1, 1, 1_000_000),
        req.body?.requiresRedemption === undefined
          ? before.requires_redemption
          : booleanValue(req.body.requiresRedemption),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000),
        JSON.stringify(metadata)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "shop.item.update",
      targetType: "shop_item",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: shopItem
    });
    res.json({ shopItem });
  }));

  router.patch("/game/settings", asyncHandler(async (req, res) => {
    const before = await one<any>(db, `select * from public.game_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
    const resetSymbols = booleanValue(req.body?.resetSymbols);
    const resetPrizes = booleanValue(req.body?.resetPrizes);
    const settings = await one<any>(
      db,
      `update public.game_settings
          set base_lives = $1, continue_points_cost = $2, ranking_period_days = $3,
              max_score_per_second = $4, symbols = $5::jsonb,
              default_prizes = $6::jsonb, updated_by_admin_id = $7, updated_at = now()
        where singleton = true returning *`,
      [
        boundedInteger(req.body?.baseLives, Number(before.base_lives), 1, 100),
        boundedInteger(req.body?.continuePointsCost, Number(before.continue_points_cost), 0, 1_000_000_000),
        boundedInteger(req.body?.rankingPeriodDays, Number(before.ranking_period_days), 1, 366),
        boundedNumber(req.body?.maxScorePerSecond, Number(before.max_score_per_second), 1, 1_000_000),
        JSON.stringify(resetSymbols
          ? before.original_symbols
          : req.body?.symbols === undefined ? before.symbols : jsonArray(req.body.symbols, "symbols")),
        JSON.stringify(resetPrizes
          ? before.original_prizes
          : req.body?.defaultPrizes === undefined
            ? before.default_prizes
          : jsonArray(req.body.defaultPrizes, "defaultPrizes")),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "game.settings.update",
      targetType: "game_settings",
      targetId: "singleton",
      reason: requiredText(req.body?.reason, "reason", 1000),
      before,
      after: settings
    });
    res.json({ settings });
  }));

  router.post("/game/seasons", asyncHandler(async (req, res) => {
    const startsAt = isoDateOrNull(req.body?.startsAt);
    const endsAt = isoDateOrNull(req.body?.endsAt);
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      throw new ApiError(400, "A valid season date range is required", "validation_error");
    }
    const overlap = await one<any>(
      db,
      `select id, name from public.game_seasons
        where status in ('scheduled','active')
          and starts_at < $2 and $1 < ends_at
        limit 1`,
      [startsAt, endsAt]
    );
    if (overlap) {
      throw new ApiError(
        409,
        "Game season overlaps another open season",
        "game_season_overlap",
        { seasonId: overlap.id, seasonName: overlap.name }
      );
    }
    const season = await one<any>(
      db,
      `insert into public.game_seasons(
         name, starts_at, ends_at, status, rewards, created_by_admin_id
       ) values ($1,$2,$3,$4,$5::jsonb,$6)
       returning *`,
      [
        requiredText(req.body?.name, "name", 160),
        startsAt,
        endsAt,
        enumValue(req.body?.status || "scheduled", "status", SEASON_STATUSES),
        JSON.stringify(jsonArray(req.body?.rewards || [], "rewards")),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "game.season.create",
      targetType: "game_season",
      targetId: season!.id,
      after: season
    });
    res.status(201).json({ season });
  }));

  router.post("/game/seasons/:seasonId/finalize", asyncHandler(async (req, res) => {
    const seasonId = uuid(req.params.seasonId, "seasonId");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const result = await finalizeGameSeason(db, seasonId, req.adminPrincipal!.adminId);
    await writeAdminAudit(db, req, {
      action: "game.season.finalize",
      targetType: "game_season",
      targetId: seasonId,
      reason,
      after: result
    });
    res.json(result);
  }));

  router.post("/game/sessions/:sessionId/exclude", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const before = await one<any>(
      db,
      `select * from public.game_sessions where id = $1`,
      [sessionId]
    );
    if (!before) throw new ApiError(404, "Game session was not found", "not_found");
    const session = await one<any>(
      db,
      `update public.game_sessions
          set status = 'excluded', suspicious = true,
              excluded_by_admin_id = $2, exclusion_reason = $3, updated_at = now()
        where id = $1 returning *`,
      [sessionId, req.adminPrincipal!.adminId, reason]
    );
    await writeAdminAudit(db, req, {
      action: "game.session.exclude",
      targetType: "game_session",
      targetId: sessionId,
      reason,
      before,
      after: session
    });
    res.json({ session });
  }));

  return router;
}
