import { randomUUID } from "node:crypto";
import { Router } from "express";
import QRCode from "qrcode";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import { createSessionToken, sha256 } from "../security.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  identifier,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";

async function expireStaleHolds(db: Queryable): Promise<void> {
  await db.query(
    `update public.booking_holds
        set status = 'expired', updated_at = now()
      where status = 'active' and expires_at <= now()`
  );
}

async function bookingForUser(db: Queryable, bookingId: string, userKey: string): Promise<any> {
  const booking = await one<any>(
    db,
    `select booking.*, event.title as event_title, event.event_date, event.event_time,
            layout.name as layout_name, layout_table.table_number, layout_table.name as table_name
       from public.booking_records booking
       join public.events event on event.id = booking.event_id
       join public.hall_layouts layout on layout.id = booking.layout_id
       join public.layout_tables layout_table on layout_table.id = booking.table_id
      where booking.id = $1 and booking.user_key = $2`,
    [bookingId, userKey]
  );
  if (!booking) throw new ApiError(404, "Booking was not found", "not_found");
  return booking;
}

async function activeClanLeadership(
  db: Queryable,
  userKey: string,
  clanId: string
): Promise<any> {
  const membership = await one<any>(
    db,
    `select membership.*, clan.name as clan_name, clan.clan_type
       from public.clan_memberships membership
       join public.clans clan on clan.id = membership.clan_id
      where membership.user_key = $1
        and membership.clan_id = $2
        and membership.status = 'active'
        and membership.role = 'leader'
        and clan.status = 'active'`,
    [userKey, clanId]
  );
  if (!membership) {
    throw new ApiError(
      403,
      "Only the active clan leader can create a clan booking",
      "clan_leader_required"
    );
  }
  return membership;
}

async function assertTableEligibility(
  db: Queryable,
  table: any,
  userKey: string,
  clanId: string | null
): Promise<void> {
  if (!table.active || table.status === "unavailable") {
    throw new ApiError(409, "Table is unavailable", "table_unavailable");
  }
  if (table.status === "clan_only" || table.table_type === "clan") {
    if (!clanId) {
      throw new ApiError(403, "This table can be booked only by a clan leader", "clan_booking_required");
    }
    await activeClanLeadership(db, userKey, clanId);
  } else if (clanId) {
    await activeClanLeadership(db, userKey, clanId);
  }
  if (table.status === "vip_only" || table.table_type === "vip") {
    const vip = await one<any>(
      db,
      `select subscription.id
         from public.user_vip_subscriptions subscription
        where subscription.user_key = $1
          and subscription.status = 'active'
          and subscription.starts_at <= now()
          and subscription.ends_at > now()
        limit 1`,
      [userKey]
    );
    if (!vip) throw new ApiError(403, "An active VIP status is required for this table", "vip_required");
  }
}

export function createBookingsRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/my", asyncHandler(async (req, res) => {
    const bookings = await many<any>(
      db,
      `select booking.*, event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at,
              layout.name as layout_name,
              layout_table.table_number, layout_table.name as table_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
         join public.hall_layouts layout on layout.id = booking.layout_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
        where booking.user_key = $1
        order by booking.created_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ bookings });
  }));

  router.post("/holds", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "booking.hold", requestSubject(req));
    const eventId = identifier(req.body?.eventId, "eventId");
    const tableId = identifier(req.body?.tableId, "tableId");
    const clanId = req.body?.clanId ? identifier(req.body.clanId, "clanId") : null;
    await expireStaleHolds(db);
    const result = await transaction(db, async client => {
      const existing = await one<any>(
        client,
        `select * from public.booking_holds
          where user_key = $1 and status = 'active'
          for update`,
        [req.userPrincipal!.userKey]
      );
      if (existing) {
        if (existing.event_id === eventId && existing.table_id === tableId) {
          const refreshed = await one<any>(
            client,
            `update public.booking_holds hold
                set expires_at = now() + make_interval(secs => settings.hold_seconds),
                    updated_at = now()
               from public.booking_settings settings
              where hold.id = $1 and settings.singleton = true
              returning hold.*`,
            [existing.id]
          );
          return { hold: refreshed, refreshed: true };
        }
        throw new ApiError(
          409,
          "Release the current table hold before selecting another table",
          "active_hold_exists",
          { holdId: existing.id, eventId: existing.event_id, tableId: existing.table_id }
        );
      }
      const row = await one<any>(
        client,
        `select layout_table.*, assignment.layout_id as assigned_layout_id
           from public.event_layout_assignments assignment
           join public.hall_layouts layout
             on layout.id = assignment.layout_id and layout.status = 'published'
           join public.layout_tables layout_table
             on layout_table.layout_id = assignment.layout_id
          where assignment.event_id = $1 and layout_table.id = $2
          for update of layout_table`,
        [eventId, tableId]
      );
      if (!row) throw new ApiError(404, "Table is not part of the event's published layout", "table_not_found");
      await assertTableEligibility(client, row, req.userPrincipal!.userKey, clanId);
      const occupied = await one<any>(
        client,
        `select id, status
           from public.booking_records
          where event_id = $1 and table_id = $2
            and status in ('held','new','pending','confirmed','checked_in')
          limit 1`,
        [eventId, tableId]
      );
      if (occupied) throw new ApiError(409, "Table is already booked", "table_already_booked");
      const competingHold = await one<any>(
        client,
        `select id, expires_at
           from public.booking_holds
          where event_id = $1 and table_id = $2
            and status = 'active' and expires_at > now()
          limit 1`,
        [eventId, tableId]
      );
      if (competingHold) {
        throw new ApiError(409, "Table is temporarily held by another user", "table_temporarily_held", {
          retryAt: competingHold.expires_at
        });
      }
      const hold = await one<any>(
        client,
        `insert into public.booking_holds(
           event_id, layout_id, table_id, user_key, clan_id, session_id, expires_at
         )
         select $1,$2,$3,$4,$5,$6,
                now() + make_interval(secs => settings.hold_seconds)
           from public.booking_settings settings
          where settings.singleton = true
         returning *`,
        [
          eventId,
          row.assigned_layout_id,
          tableId,
          req.userPrincipal!.userKey,
          clanId,
          req.userPrincipal!.sessionId
        ]
      );
      if (!hold) throw new ApiError(500, "Booking settings are missing", "booking_settings_missing");
      return { hold, refreshed: false };
    });
    res.status(result.refreshed ? 200 : 201).json(result);
  }));

  router.delete("/holds/:holdId", asyncHandler(async (req, res) => {
    const holdId = uuid(req.params.holdId, "holdId");
    const hold = await one<any>(
      db,
      `update public.booking_holds
          set status = 'released', released_at = now(), updated_at = now()
        where id = $1 and user_key = $2 and status = 'active'
        returning *`,
      [holdId, req.userPrincipal!.userKey]
    );
    if (!hold) throw new ApiError(404, "Active table hold was not found", "not_found");
    res.status(204).end();
  }));

  router.post("/", asyncHandler(async (req, res) => {
    const headerKey = String(req.get("idempotency-key") || "").trim();
    const idempotencyKey = requiredText(
      headerKey || req.body?.idempotencyKey,
      "idempotencyKey",
      160
    );
    const holdId = uuid(req.body?.holdId, "holdId");
    const customerName = requiredText(req.body?.customerName, "customerName", 160);
    const phone = requiredText(req.body?.phone, "phone", 40);
    const guests = boundedInteger(req.body?.guests, 1, 1, 100);
    const comment = optionalText(req.body?.comment, 2000);
    const consentAccepted = booleanValue(req.body?.consentAccepted);
    if (!consentAccepted) {
      throw new ApiError(400, "Booking consent must be accepted", "booking_consent_required");
    }
    const existing = await one<any>(
      db,
      `select * from public.booking_records
        where idempotency_key = $1 and user_key = $2`,
      [idempotencyKey, req.userPrincipal!.userKey]
    );
    if (existing) return res.json({ booking: existing, replayed: true });

    try {
      const booking = await transaction(db, async client => {
        await expireStaleHolds(client);
        const hold = await one<any>(
          client,
          `select hold.*, layout_table.capacity, layout_table.minimum_deposit,
                  layout_table.status as table_status, layout_table.table_type,
                  assignment.layout_id as current_layout_id,
                  settings.auto_confirm
             from public.booking_holds hold
             join public.layout_tables layout_table on layout_table.id = hold.table_id
             join public.event_layout_assignments assignment on assignment.event_id = hold.event_id
             join public.booking_settings settings on settings.singleton = true
            where hold.id = $1 and hold.user_key = $2
            for update of hold`,
          [holdId, req.userPrincipal!.userKey]
        );
        if (!hold) throw new ApiError(404, "Table hold was not found", "not_found");
        if (hold.status !== "active" || new Date(hold.expires_at).getTime() <= Date.now()) {
          throw new ApiError(409, "Table hold has expired", "hold_expired");
        }
        if (hold.layout_id !== hold.current_layout_id) {
          throw new ApiError(409, "Event layout changed; select a table again", "event_layout_changed");
        }
        if (guests > Number(hold.capacity)) {
          throw new ApiError(
            400,
            `This table supports no more than ${hold.capacity} guests`,
            "table_capacity_exceeded"
          );
        }
        await assertTableEligibility(
          client,
          hold,
          req.userPrincipal!.userKey,
          hold.clan_id || null
        );
        const customer = await one<any>(
          client,
          `insert into public.crm_customers(
             user_key, phone, first_name, last_activity_at
           ) values ($1,$2,$3,now())
           on conflict (user_key) do update
             set phone = excluded.phone,
                 first_name = excluded.first_name,
                 last_activity_at = now(),
                 updated_at = now()
           returning *`,
          [req.userPrincipal!.userKey, phone, customerName]
        );
        const bookingId = `booking-${randomUUID()}`;
        const reference = `BALI-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        const nextStatus = hold.auto_confirm ? "confirmed" : "pending";
        const created = await one<any>(
          client,
          `insert into public.booking_records(
             id, booking_reference, idempotency_key, event_id, layout_id, table_id,
             hold_id, user_key, crm_customer_id, clan_id, booking_kind,
             customer_name, phone, guests, deposit, comment, status,
             consent_accepted, confirmed_at
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,true,
             case when $17 = 'confirmed' then now() else null end
           )
           returning *`,
          [
            bookingId,
            reference,
            idempotencyKey,
            hold.event_id,
            hold.layout_id,
            hold.table_id,
            hold.id,
            req.userPrincipal!.userKey,
            customer!.id,
            hold.clan_id,
            hold.clan_id ? "clan" : "personal",
            customerName,
            phone,
            guests,
            hold.minimum_deposit,
            comment,
            nextStatus
          ]
        );
        await client.query(
          `update public.booking_holds
              set status = 'converted', converted_at = now(), updated_at = now()
            where id = $1`,
          [hold.id]
        );
        await client.query(
          `insert into public.booking_status_history(
             booking_id, previous_status, next_status, actor_type, actor_id, after_value
           ) values ($1,'held',$2,'user',$3,$4::jsonb)`,
          [created!.id, nextStatus, req.userPrincipal!.userKey, JSON.stringify(created)]
        );
        await client.query(
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'booking_created',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,
          [
            req.userPrincipal!.userKey,
            "Бронирование создано",
            `Номер бронирования: ${created!.booking_reference}`,
            JSON.stringify({ bookingId: created!.id, eventId: created!.event_id }),
            `booking-created:${created!.id}`
          ]
        );
        return created;
      });
      res.status(201).json({ booking, replayed: false });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await one<any>(
          db,
          `select * from public.booking_records
            where idempotency_key = $1 and user_key = $2`,
          [idempotencyKey, req.userPrincipal!.userKey]
        );
        if (replay) return res.json({ booking: replay, replayed: true });
        throw new ApiError(409, "Table was booked by another request", "table_already_booked");
      }
      throw error;
    }
  }));

  router.get("/:bookingId", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const booking = await bookingForUser(db, bookingId, req.userPrincipal!.userKey);
    res.json({ booking });
  }));

  router.post("/:bookingId/qr", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const rawToken = createSessionToken();
    const qr = await transaction(db, async client => {
      const booking = await one<any>(
        client,
        `select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,
        [bookingId, req.userPrincipal!.userKey]
      );
      if (!booking) throw new ApiError(404, "Booking was not found", "not_found");
      if (!["confirmed", "pending", "new"].includes(booking.status)) {
        throw new ApiError(409, "A QR code is unavailable for this booking", "booking_qr_unavailable");
      }
      const runtime = await one<any>(
        client,
        `select ends_at from public.event_runtime where event_id = $1`,
        [booking.event_id]
      );
      const fallbackExpiry = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const eventExpiry = runtime?.ends_at && new Date(runtime.ends_at).getTime() > Date.now()
        ? new Date(runtime.ends_at).toISOString()
        : fallbackExpiry;
      return one<any>(
        client,
        `insert into public.booking_qr_tokens(
           booking_id, user_key, token_hash, expires_at
         ) values ($1,$2,$3,$4)
         on conflict (booking_id) do update
           set token_hash = excluded.token_hash,
               expires_at = excluded.expires_at,
               redeemed_at = null,
               redeemed_by_admin_id = null,
               revoked_at = null,
               updated_at = now()
         returning id, booking_id, expires_at, created_at, updated_at`,
        [bookingId, req.userPrincipal!.userKey, sha256(rawToken), eventExpiry]
      );
    });
    const qrDataUrl = await QRCode.toDataURL(rawToken, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
      color: { dark: "#080a08", light: "#ffffff" }
    });
    res.json({ qr, token: rawToken, qrDataUrl });
  }));

  router.post("/:bookingId/cancel", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const reason = optionalText(req.body?.reason, 1000);
    const booking = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,
        [bookingId, req.userPrincipal!.userKey]
      );
      if (!before) throw new ApiError(404, "Booking was not found", "not_found");
      if (!["new", "pending", "confirmed"].includes(before.status)) {
        throw new ApiError(409, "Booking cannot be cancelled in its current state", "booking_not_cancellable");
      }
      const updated = await one<any>(
        client,
        `update public.booking_records
            set status = 'cancelled', cancelled_at = now(),
                cancelled_by = $2, updated_at = now()
          where id = $1
          returning *`,
        [bookingId, req.userPrincipal!.userKey]
      );
      await client.query(
        `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,'cancelled','user',$3,$4,$5::jsonb,$6::jsonb)`,
        [
          bookingId,
          before.status,
          req.userPrincipal!.userKey,
          reason,
          JSON.stringify(before),
          JSON.stringify(updated)
        ]
      );
      return updated;
    });
    res.json({ booking });
  }));

  return router;
}
