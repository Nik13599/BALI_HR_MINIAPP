import { Router } from "express";
import QRCode from "qrcode";
import { many, one, transaction } from "../db.js";
import { mutatePoints } from "../economy.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import { createSessionToken, sha256 } from "../security.js";
import type { Queryable } from "../types.js";
import {
  boundedInteger,
  identifier,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";

function idempotencyKey(req: any): string {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}

async function notify(
  db: Queryable,
  userKey: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  key: string
): Promise<void> {
  await db.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [userKey, type, title, body, JSON.stringify(data), key]
  );
}

function qrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 640,
    color: { dark: "#080a08", light: "#ffffff" }
  });
}

export function createEconomyRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/points", asyncHandler(async (req, res) => {
    const [account, ledger] = await Promise.all([
      one<any>(
        db,
        `select * from public.point_accounts where user_key = $1`,
        [req.userPrincipal!.userKey]
      ),
      many<any>(
        db,
        `select * from public.point_ledger
          where user_key = $1 order by created_at desc limit 100`,
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ account: account || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 }, ledger });
  }));

  router.get("/rewards", asyncHandler(async (req, res) => {
    const [catalog, mine] = await Promise.all([
      many<any>(
        db,
        `select * from public.reward_definitions
          where active = true
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
          order by rarity, name`
      ),
      many<any>(
        db,
        `select user_reward.*, reward.name, reward.icon_url, reward.description,
                reward.rarity, reward.points, reward.xp
           from public.user_rewards user_reward
           join public.reward_definitions reward on reward.id = user_reward.reward_id
          where user_reward.user_key = $1
          order by user_reward.granted_at desc`,
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ catalog, rewards: mine });
  }));

  router.get("/gifts", asyncHandler(async (req, res) => {
    const [catalog, received, sent] = await Promise.all([
      many<any>(
        db,
        `select * from public.gift_catalog where active = true order by sort_order, name`
      ),
      many<any>(
        db,
        `select gift.*, catalog.name, catalog.description, catalog.image_url,
                sender.name as sender_name, sender.avatar as sender_avatar
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           left join public.app_users sender on sender.user_key = gift.sender_user_key
          where gift.recipient_user_key = $1
          order by gift.created_at desc`,
        [req.userPrincipal!.userKey]
      ),
      many<any>(
        db,
        `select gift.*, catalog.name, catalog.image_url,
                recipient.name as recipient_name
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           join public.app_users recipient on recipient.user_key = gift.recipient_user_key
          where gift.sender_user_key = $1
          order by gift.created_at desc`,
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ catalog, received, sent });
  }));

  router.post("/gifts", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "gift.create", requestSubject(req));
    const key = idempotencyKey(req);
    const catalogItemId = identifier(req.body?.catalogItemId, "catalogItemId");
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    const senderUserKey = req.userPrincipal!.userKey;
    if (senderUserKey === recipientUserKey) {
      throw new ApiError(400, "A user cannot send a gift to themselves", "validation_error");
    }
    const existing = await one<any>(
      db,
      `select * from public.gifts
        where idempotency_key = $1 and sender_user_key = $2`,
      [key, senderUserKey]
    );
    if (existing) return res.json({ gift: existing, replayed: true });
    const qrToken = createSessionToken();
    try {
      const gift = await transaction(db, async client => {
        const [catalog, recipient, blocked] = await Promise.all([
          one<any>(
            client,
            `select * from public.gift_catalog where id = $1 and active = true for update`,
            [catalogItemId]
          ),
          one<any>(
            client,
            `select user_row.user_key, user_row.name,
                    coalesce(profile.allow_gifts, true) as allow_gifts
               from public.app_users user_row
               left join public.user_profiles profile on profile.user_key = user_row.user_key
              where user_row.user_key = $1 and user_row.account_status = 'active'`,
            [recipientUserKey]
          ),
          one<any>(
            client,
            `select 1 from public.user_blocks
              where (blocker_user_key = $1 and blocked_user_key = $2)
                 or (blocker_user_key = $2 and blocked_user_key = $1)
              limit 1`,
            [senderUserKey, recipientUserKey]
          )
        ]);
        if (!catalog) throw new ApiError(404, "Gift was not found", "not_found");
        if (!recipient || !recipient.allow_gifts || blocked) {
          throw new ApiError(403, "This user cannot receive gifts from you", "gift_unavailable");
        }
        const points = Number(catalog.points_cost || 0);
        const pointResult = points > 0
          ? await mutatePoints(client, {
              userKey: senderUserKey,
              amount: -points,
              operationType: "debit",
              sourceType: "gift",
              sourceId: catalogItemId,
              reason: `Подарок: ${catalog.name}`,
              idempotencyKey: `gift-points:${key}`
            })
          : null;
        return one<any>(
          client,
          `insert into public.gifts(
             catalog_item_id, sender_user_key, recipient_user_key, points_cost,
             point_transaction_id, message, status, qr_token_hash, expires_at,
             idempotency_key
           ) values (
             $1,$2,$3,$4,$5,$6,'delivered',$7,
             case when $8::integer is null then null else now() + make_interval(days => $8) end,
             $9
           )
           returning *`,
          [
            catalogItemId,
            senderUserKey,
            recipientUserKey,
            points,
            pointResult?.ledger?.id || null,
            message,
            catalog.gift_type === "physical" ? sha256(qrToken) : null,
            catalog.validity_days,
            key
          ]
        );
      });
      await notify(
        db,
        recipientUserKey,
        "gift_received",
        "Новый подарок",
        `${req.userPrincipal!.name} отправил вам подарок.`,
        { giftId: gift!.id },
        `gift-received:${gift!.id}`
      );
      res.status(201).json({ gift, replayed: false });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await one<any>(
          db,
          `select * from public.gifts where idempotency_key = $1 and sender_user_key = $2`,
          [key, senderUserKey]
        );
        if (replay) return res.json({ gift: replay, replayed: true });
      }
      throw error;
    }
  }));

  router.post("/gifts/:giftId/qr", asyncHandler(async (req, res) => {
    const giftId = uuid(req.params.giftId, "giftId");
    const token = createSessionToken();
    const gift = await one<any>(
      db,
      `update public.gifts gift
          set qr_token_hash = $3, updated_at = now()
         from public.gift_catalog catalog
        where gift.id = $1
          and gift.recipient_user_key = $2
          and gift.catalog_item_id = catalog.id
          and catalog.gift_type = 'physical'
          and gift.status = 'delivered'
          and (gift.expires_at is null or gift.expires_at > now())
        returning gift.id, gift.status, gift.expires_at, catalog.name`,
      [giftId, req.userPrincipal!.userKey, sha256(token)]
    );
    if (!gift) throw new ApiError(409, "This gift cannot be redeemed", "gift_redemption_unavailable");
    res.json({ gift, token, qrDataUrl: await qrDataUrl(token) });
  }));

  router.get("/vip", asyncHandler(async (req, res) => {
    const [plans, subscriptions] = await Promise.all([
      many<any>(db, `select * from public.vip_plans where active = true order by sort_order, points_cost`),
      many<any>(
        db,
        `select subscription.*, plan.name, plan.benefits, plan.badge_url,
                plan.profile_frame_url, plan.points_multiplier, plan.extra_game_lives
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1
          order by subscription.ends_at desc`,
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ plans, subscriptions });
  }));

  router.post("/vip/purchase", asyncHandler(async (req, res) => {
    const key = idempotencyKey(req);
    const planId = identifier(req.body?.planId, "planId");
    const userKey = req.userPrincipal!.userKey;
    const existing = await one<any>(
      db,
      `select * from public.user_vip_subscriptions
        where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ subscription: existing, replayed: true });
    let subscription: any;
    try {
      subscription = await transaction(db, async client => {
      const plan = await one<any>(
        client,
        `select * from public.vip_plans where id = $1 and active = true for update`,
        [planId]
      );
      if (!plan) throw new ApiError(404, "VIP plan was not found", "not_found");
      const current = await one<any>(
        client,
        `select * from public.user_vip_subscriptions
          where user_key = $1 and status = 'active' and ends_at > now()
          order by ends_at desc limit 1 for update`,
        [userKey]
      );
      const startsAt = current && new Date(current.ends_at).getTime() > Date.now()
        ? new Date(current.ends_at)
        : new Date();
      const endsAt = new Date(startsAt.getTime() + Number(plan.duration_days) * 86_400_000);
      const points = Number(plan.points_cost || 0);
      const pointResult = points > 0
        ? await mutatePoints(client, {
            userKey,
            amount: -points,
            operationType: "debit",
            sourceType: "vip",
            sourceId: planId,
            reason: `VIP: ${plan.name}`,
            idempotencyKey: `vip-points:${key}`
          })
        : null;
      const created = await one<any>(
        client,
        `insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, point_transaction_id, starts_at,
           ends_at, status, idempotency_key
         ) values ($1,$2,'purchase',$3,$4,$5,$6,$7)
         returning *`,
        [
          userKey,
          planId,
          pointResult?.ledger?.id || null,
          startsAt.toISOString(),
          endsAt.toISOString(),
          startsAt.getTime() > Date.now() ? "scheduled" : "active",
          key
        ]
      );
      await client.query(
        `update public.app_users set vip_expires_at = $2, updated_at = now()
          where user_key = $1`,
        [userKey, endsAt.toISOString()]
      );
        return created;
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await one<any>(
          db,
          `select * from public.user_vip_subscriptions
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ subscription: replay, replayed: true });
      }
      throw error;
    }
    res.status(201).json({ subscription, replayed: false });
  }));

  router.get("/shop", asyncHandler(async (req, res) => {
    const [items, orders] = await Promise.all([
      many<any>(
        db,
        `select * from public.shop_items
          where status = 'active'
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
            and (stock is null or stock > 0)
          order by sort_order, name`
      ),
      many<any>(
        db,
        `select shop_order.*,
                coalesce(json_agg(order_item order by order_item.created_at)
                  filter (where order_item.id is not null), '[]'::json) as items
           from public.shop_orders shop_order
           left join public.shop_order_items order_item on order_item.order_id = shop_order.id
          where shop_order.user_key = $1
          group by shop_order.id
          order by shop_order.created_at desc`,
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ items, orders });
  }));

  router.post("/shop/orders", asyncHandler(async (req, res) => {
    const key = idempotencyKey(req);
    const userKey = req.userPrincipal!.userKey;
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!rawItems.length || rawItems.length > 20) {
      throw new ApiError(400, "Order must contain 1-20 items", "validation_error");
    }
    const requested: Array<{ itemId: string; quantity: number }> = rawItems.map((row: any) => ({
      itemId: identifier(row?.itemId, "itemId"),
      quantity: boundedInteger(row?.quantity, 1, 1, 100)
    }));
    if (new Set(requested.map(row => row.itemId)).size !== requested.length) {
      throw new ApiError(400, "Each shop item must occur only once", "validation_error");
    }
    const existing = await one<any>(
      db,
      `select * from public.shop_orders where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ order: existing, replayed: true });
    const qrToken = createSessionToken();
    let result: { order: any; requiresRedemption: boolean };
    try {
      result = await transaction(db, async client => {
      const items: any[] = [];
      let total = 0;
      for (const requestedItem of requested) {
        const item = await one<any>(
          client,
          `select * from public.shop_items
            where id = $1 and status = 'active'
              and (valid_from is null or valid_from <= now())
              and (valid_until is null or valid_until > now())
            for update`,
          [requestedItem.itemId]
        );
        if (!item) throw new ApiError(404, `Shop item ${requestedItem.itemId} is unavailable`, "shop_item_unavailable");
        if (item.stock !== null && Number(item.stock) < requestedItem.quantity) {
          throw new ApiError(409, `Not enough stock for ${item.name}`, "shop_stock_insufficient");
        }
        if (item.per_user_limit !== null) {
          const purchased = await one<any>(
            client,
            `select coalesce(sum(order_item.quantity), 0)::integer as quantity
               from public.shop_order_items order_item
               join public.shop_orders shop_order on shop_order.id = order_item.order_id
              where shop_order.user_key = $1 and order_item.item_id = $2
                and shop_order.status not in ('cancelled','refunded')`,
            [userKey, item.id]
          );
          if (Number(purchased?.quantity || 0) + requestedItem.quantity > Number(item.per_user_limit)) {
            throw new ApiError(409, `Purchase limit reached for ${item.name}`, "shop_user_limit");
          }
        }
        total += Number(item.points_cost) * requestedItem.quantity;
        items.push({ ...item, quantity: requestedItem.quantity });
      }
      const pointResult = total > 0
        ? await mutatePoints(client, {
            userKey,
            amount: -total,
            operationType: "debit",
            sourceType: "shop",
            sourceId: key,
            reason: "Заказ BALI Shop",
            idempotencyKey: `shop-points:${key}`
          })
        : null;
      const created = await one<any>(
        client,
        `insert into public.shop_orders(
           user_key, total_points, point_transaction_id, status,
           qr_token_hash, idempotency_key
         ) values ($1,$2,$3,'paid',$4,$5)
         returning *`,
        [userKey, total, pointResult?.ledger?.id || null, sha256(qrToken), key]
      );
      for (const item of items) {
        await client.query(
          `insert into public.shop_order_items(
             order_id, item_id, item_name, unit_points, quantity, requires_redemption
           ) values ($1,$2,$3,$4,$5,$6)`,
          [
            created!.id,
            item.id,
            item.name,
            item.points_cost,
            item.quantity,
            Boolean(item.requires_redemption)
          ]
        );
        if (item.stock !== null) {
          await client.query(
            `update public.shop_items
                set stock = stock - $2,
                    status = case when stock - $2 <= 0 then 'sold_out' else status end,
                    updated_at = now()
              where id = $1`,
            [item.id, item.quantity]
          );
        }
      }
        return {
          order: created,
          requiresRedemption: items.some(item => Boolean(item.requires_redemption))
        };
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await one<any>(
          db,
          `select * from public.shop_orders
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ order: replay, replayed: true });
      }
      throw error;
    }
    res.status(201).json({
      order: result.order,
      qrToken: result.requiresRedemption ? qrToken : undefined,
      qrDataUrl: result.requiresRedemption ? await qrDataUrl(qrToken) : undefined,
      replayed: false
    });
  }));

  router.post("/shop/orders/:orderId/qr", asyncHandler(async (req, res) => {
    const orderId = uuid(req.params.orderId, "orderId");
    const token = createSessionToken();
    const order = await one<any>(
      db,
      `update public.shop_orders shop_order
          set qr_token_hash = $3, updated_at = now()
        where shop_order.id = $1
          and shop_order.user_key = $2
          and shop_order.status = 'paid'
          and exists (
            select 1
              from public.shop_order_items order_item
             where order_item.order_id = shop_order.id
               and order_item.requires_redemption = true
          )
        returning shop_order.id, shop_order.total_points, shop_order.status,
                  shop_order.created_at, shop_order.updated_at`,
      [orderId, req.userPrincipal!.userKey, sha256(token)]
    );
    if (!order) throw new ApiError(409, "This order cannot be redeemed", "shop_redemption_unavailable");
    res.json({ order, token, qrDataUrl: await qrDataUrl(token) });
  }));

  return router;
}
