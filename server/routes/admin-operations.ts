import { Router } from "express";
import { writeAdminAudit } from "../audit.js";
import { many, one, transaction } from "../db.js";
import { mutatePoints } from "../economy.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { sha256 } from "../security.js";
import type { Queryable } from "../types.js";
import { optionalText, requiredText, uuid } from "../validation.js";

function idempotencyKey(req: any): string {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}

export function createAdminOperationsRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/check-ins", asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "").trim();
    const rows = await many<any>(
      db,
      `select checkin.*, user_row.name, user_row.username,
              booking.booking_reference, event.title as event_title
         from public.event_checkins checkin
         join public.app_users user_row on user_row.user_key = checkin.user_key
         join public.events event on event.id = checkin.event_id
         left join public.booking_records booking on booking.id = checkin.booking_id
        where ($1 = '' or checkin.event_id = $1)
        order by checkin.checked_in_at desc
        limit 500`,
      [eventId]
    );
    res.json({ checkIns: rows });
  }));

  router.post("/check-ins", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1000);
    const key = idempotencyKey(req);
    const reason = optionalText(req.body?.reason, 1000);
    let result: { checkIn: any; replayed: boolean; points: any };
    try {
      result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select checkin.* from public.event_checkins checkin
          where checkin.idempotency_key = $1`,
        [key]
      );
      if (replay) return { checkIn: replay, replayed: true, points: null };
      const qr = await one<any>(
        client,
        `select qr.*, booking.event_id, booking.status as booking_status,
                booking.clan_id, booking.booking_reference
           from public.booking_qr_tokens qr
           join public.booking_records booking on booking.id = qr.booking_id
          where qr.token_hash = $1
          for update of qr`,
        [sha256(token)]
      );
      if (!qr) throw new ApiError(404, "QR code was not recognized", "qr_not_found");
      if (qr.revoked_at) throw new ApiError(409, "QR code has been revoked", "qr_revoked");
      if (qr.redeemed_at) throw new ApiError(409, "QR code has already been used", "qr_already_used");
      if (new Date(qr.expires_at).getTime() <= Date.now()) {
        throw new ApiError(409, "QR code has expired", "qr_expired");
      }
      if (!["confirmed", "pending", "new"].includes(qr.booking_status)) {
        throw new ApiError(409, "Booking cannot be checked in", "booking_checkin_unavailable");
      }
      const checkIn = await one<any>(
        client,
        `insert into public.event_checkins(
           event_id, user_key, booking_id, idempotency_key,
           qr_subject_type, qr_subject_id, checked_in_by_admin_id, metadata
         ) values ($1,$2,$3,$4,'booking',$3,$5,$6::jsonb)
         returning *`,
        [
          qr.event_id,
          qr.user_key,
          qr.booking_id,
          key,
          req.adminPrincipal!.adminId,
          JSON.stringify({ bookingReference: qr.booking_reference, reason })
        ]
      );
      await client.query(
        `update public.booking_qr_tokens
            set redeemed_at = now(), redeemed_by_admin_id = $2, updated_at = now()
          where id = $1`,
        [qr.id, req.adminPrincipal!.adminId]
      );
      await client.query(
        `update public.booking_records
            set status = 'checked_in', checked_in_at = now(), updated_at = now()
          where id = $1`,
        [qr.booking_id]
      );
      await client.query(
        `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, after_value
         ) values ($1,$2,'checked_in','checkin',$3,$4,$5::jsonb)`,
        [
          qr.booking_id,
          qr.booking_status,
          req.adminPrincipal!.adminId,
          reason,
          JSON.stringify(checkIn)
        ]
      );
      const settings = await one<any>(
        client,
        `select checkin_points, clan_activity_points
           from public.economy_settings where singleton = true`
      );
      const points = Number(settings?.checkin_points || 0) > 0
        ? await mutatePoints(client, {
            userKey: qr.user_key,
            amount: Number(settings.checkin_points),
            operationType: "credit",
            sourceType: "event_checkin",
            sourceId: String(checkIn!.id),
            reason: "BALI event check-in",
            administratorId: req.adminPrincipal!.adminId,
            idempotencyKey: `checkin-points:${qr.event_id}:${qr.user_key}`
          })
        : null;
      if (qr.clan_id && Number(settings?.clan_activity_points || 0) > 0) {
        await client.query(
          `insert into public.clan_points_ledger(
             clan_id, user_key, points, source_type, source_id,
             idempotency_key, reason
           ) values ($1,$2,$3,'event_checkin',$4,$5,$6)
           on conflict (idempotency_key) do nothing`,
          [
            qr.clan_id,
            qr.user_key,
            Number(settings.clan_activity_points),
            String(checkIn!.id),
            `checkin-clan-points:${qr.event_id}:${qr.user_key}`,
            "BALI event check-in"
          ]
        );
        await client.query(
          `update public.clans
              set rating_points = rating_points + $2, updated_at = now()
            where id = $1
              and exists (
                select 1 from public.clan_points_ledger
                 where idempotency_key = $3 and source_id = $4
              )`,
          [
            qr.clan_id,
            Number(settings.clan_activity_points),
            `checkin-clan-points:${qr.event_id}:${qr.user_key}`,
            String(checkIn!.id)
          ]
        );
      }
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, status,
           idempotency_key
         ) values ($1,'event_checkin','Check-in подтверждён',$2,$3::jsonb,'queued',$4)
         on conflict (idempotency_key) do nothing`,
        [
          qr.user_key,
          points ? `Начислено ${settings.checkin_points} BALI Points.` : "Добро пожаловать в BALI.",
          JSON.stringify({ eventId: qr.event_id, bookingId: qr.booking_id }),
          `checkin-notification:${qr.event_id}:${qr.user_key}`
        ]
      );
        return { checkIn, replayed: false, points };
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const duplicate = await one<any>(
          db,
          `select checkin.*
             from public.event_checkins checkin
             join public.booking_qr_tokens qr on qr.booking_id = checkin.booking_id
            where qr.token_hash = $1
            limit 1`,
          [sha256(token)]
        );
        if (duplicate) {
          throw new ApiError(409, "This guest has already checked in", "checkin_already_exists");
        }
      }
      throw error;
    }
    await writeAdminAudit(db, req, {
      action: "booking.checkin",
      targetType: "event_checkin",
      targetId: String(result.checkIn!.id),
      reason,
      after: result.checkIn
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/redemptions/gifts", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1000);
    const reason = optionalText(req.body?.reason, 1000);
    const gift = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.gifts where qr_token_hash = $1 for update`,
        [sha256(token)]
      );
      if (!before) throw new ApiError(404, "Gift QR was not recognized", "qr_not_found");
      if (before.status === "redeemed") return before;
      if (!["pending", "delivered"].includes(before.status)) {
        throw new ApiError(409, "Gift cannot be redeemed", "gift_redemption_unavailable");
      }
      if (before.expires_at && new Date(before.expires_at).getTime() <= Date.now()) {
        throw new ApiError(409, "Gift has expired", "gift_expired");
      }
      return one<any>(
        client,
        `update public.gifts
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [before.id, req.adminPrincipal!.adminId]
      );
    });
    await writeAdminAudit(db, req, {
      action: "gift.redeem",
      targetType: "gift",
      targetId: String(gift!.id),
      reason,
      after: gift
    });
    res.json({ gift });
  }));

  router.post("/redemptions/shop", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1000);
    const reason = optionalText(req.body?.reason, 1000);
    const order = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select shop_order.*
           from public.shop_orders shop_order
          where shop_order.qr_token_hash = $1
            and exists (
              select 1
                from public.shop_order_items order_item
               where order_item.order_id = shop_order.id
                 and order_item.requires_redemption = true
            )
          for update`,
        [sha256(token)]
      );
      if (!before) throw new ApiError(404, "Shop QR was not recognized", "qr_not_found");
      if (before.status === "redeemed") return before;
      if (!["paid", "fulfilled"].includes(before.status)) {
        throw new ApiError(409, "Order cannot be redeemed", "shop_redemption_unavailable");
      }
      return one<any>(
        client,
        `update public.shop_orders
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [before.id, req.adminPrincipal!.adminId]
      );
    });
    await writeAdminAudit(db, req, {
      action: "shop.redeem",
      targetType: "shop_order",
      targetId: String(order!.id),
      reason,
      after: order
    });
    res.json({ order });
  }));

  router.post("/redemptions/rewards/:rewardGrantId", asyncHandler(async (req, res) => {
    const rewardGrantId = uuid(req.params.rewardGrantId, "rewardGrantId");
    const reason = optionalText(req.body?.reason, 1000);
    const reward = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.user_rewards where id = $1 for update`,
        [rewardGrantId]
      );
      if (!before) throw new ApiError(404, "Reward was not found", "not_found");
      if (before.status === "redeemed") return before;
      if (before.status !== "active") {
        throw new ApiError(409, "Reward cannot be redeemed", "reward_redemption_unavailable");
      }
      if (before.expires_at && new Date(before.expires_at).getTime() <= Date.now()) {
        throw new ApiError(409, "Reward has expired", "reward_expired");
      }
      return one<any>(
        client,
        `update public.user_rewards
            set status = 'redeemed', redeemed_at = now()
          where id = $1 returning *`,
        [rewardGrantId]
      );
    });
    await writeAdminAudit(db, req, {
      action: "reward.redeem",
      targetType: "user_reward",
      targetId: rewardGrantId,
      reason,
      after: reward
    });
    res.json({ reward });
  }));

  return router;
}
