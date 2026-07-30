import { randomUUID } from "node:crypto";
import { Router } from "express";
import { writeAdminAudit } from "../audit.js";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  enumValue,
  identifier,
  isoDateOrNull,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";

const TRUST_STATUSES = ["trusted", "normal", "watch", "restricted"] as const;
const ACCOUNT_STATUSES = ["active", "blocked", "deleted"] as const;
const EVENT_STATUSES = [
  "draft", "published", "active", "completed", "archived", "cancelled"
] as const;
const MODERATION_STATUSES = ["open", "reviewing", "actioned", "dismissed", "closed"] as const;
const MODERATION_PRIORITIES = ["low", "normal", "high", "critical"] as const;

function dateOnly(value: unknown, field: string): string {
  const text = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
    throw new ApiError(400, `${field} must use YYYY-MM-DD`, "validation_error");
  }
  return text;
}

function timeOnly(value: unknown, field: string): string {
  const text = requiredText(value, field, 8);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) {
    throw new ApiError(400, `${field} must use HH:MM`, "validation_error");
  }
  return text;
}

async function crmCustomer(db: Queryable, userKey: string): Promise<any> {
  const customer = await one<any>(
    db,
    `select customer.*, user_row.name, user_row.username, user_row.avatar,
            user_row.account_status, user_row.blocked_at, user_row.last_seen_at,
            account.telegram_user_id,
            profile.status_text, profile.bio, profile.interests,
            profile.discoverable, consent.marketing_opt_in,
            points.balance, points.lifetime_earned, points.lifetime_spent
       from public.crm_customers customer
       join public.app_users user_row on user_row.user_key = customer.user_key
       left join public.telegram_accounts account on account.app_user_key = customer.user_key
       left join public.user_profiles profile on profile.user_key = customer.user_key
       left join public.user_consents consent on consent.user_key = customer.user_key
       left join public.point_accounts points on points.user_key = customer.user_key
      where customer.user_key = $1`,
    [userKey]
  );
  if (!customer) throw new ApiError(404, "CRM customer was not found", "not_found");
  return customer;
}

export function createAdminCrmRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/dashboard", asyncHandler(async (_req, res) => {
    const [
      users,
      upcomingEvents,
      activeBookings,
      todayCheckIns,
      openModeration,
      points,
      campaigns
    ] = await Promise.all([
      one<any>(db, `select count(*)::integer as value from public.app_users where account_status = 'active'`),
      one<any>(
        db,
        `select count(*)::integer as value
           from public.event_runtime
          where status in ('published','active') and coalesce(ends_at, starts_at, now()) >= now()`
      ),
      one<any>(
        db,
        `select count(*)::integer as value
           from public.booking_records
          where status in ('new','pending','confirmed','checked_in')`
      ),
      one<any>(
        db,
        `select count(*)::integer as value
           from public.event_checkins
          where checked_in_at >= date_trunc('day', now())`
      ),
      one<any>(
        db,
        `select count(*)::integer as value
           from public.moderation_cases
          where status in ('open','reviewing')`
      ),
      one<any>(
        db,
        `select coalesce(sum(balance),0)::bigint as balance,
                coalesce(sum(lifetime_earned),0)::bigint as earned,
                coalesce(sum(lifetime_spent),0)::bigint as spent
           from public.point_accounts`
      ),
      one<any>(
        db,
        `select count(*) filter (where status in ('confirmed','sending'))::integer as active,
                count(*) filter (where status = 'completed')::integer as completed
           from public.crm_campaigns`
      )
    ]);
    res.json({
      metrics: {
        activeUsers: Number(users?.value || 0),
        upcomingEvents: Number(upcomingEvents?.value || 0),
        activeBookings: Number(activeBookings?.value || 0),
        todayCheckIns: Number(todayCheckIns?.value || 0),
        openModeration: Number(openModeration?.value || 0),
        pointsBalance: Number(points?.balance || 0),
        pointsEarned: Number(points?.earned || 0),
        pointsSpent: Number(points?.spent || 0),
        activeCampaigns: Number(campaigns?.active || 0),
        completedCampaigns: Number(campaigns?.completed || 0)
      }
    });
  }));

  router.get("/crm/merge-reviews", asyncHandler(async (req, res) => {
    const status = enumValue(
      req.query.status || "pending",
      "status",
      ["pending", "linked", "ignored"] as const
    );
    const reviews = await many<any>(
      db,
      `select review.*, candidate.name as candidate_name,
              candidate.username as candidate_username
         from public.data_merge_review review
         left join public.app_users candidate
           on candidate.user_key = review.candidate_user_key
        where review.status = $1
        order by review.created_at`,
      [status]
    );
    res.json({ reviews });
  }));

  router.patch("/crm/merge-reviews/:reviewId", asyncHandler(async (req, res) => {
    const reviewId = uuid(req.params.reviewId, "reviewId");
    const status = enumValue(req.body?.status, "status", ["linked", "ignored"] as const);
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const result = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.data_merge_review where id = $1 for update`,
        [reviewId]
      );
      if (!before) throw new ApiError(404, "Merge review was not found", "not_found");
      if (before.status !== "pending") {
        throw new ApiError(409, "Merge review has already been resolved", "merge_review_resolved");
      }
      if (before.entity_type !== "telegram_identity" || !before.candidate_user_key) {
        throw new ApiError(409, "This merge type requires a dedicated migration", "merge_type_unsupported");
      }
      const telegramId = requiredText(before.legacy_id, "telegramId", 32);
      if (!/^\d+$/.test(telegramId)) {
        throw new ApiError(409, "Telegram ID in review is invalid", "merge_identity_invalid");
      }
      if (status === "linked") {
        const conflicting = await one<any>(
          client,
          `select * from public.telegram_accounts
            where telegram_user_id = $1 or app_user_key = $2
            for update`,
          [telegramId, before.candidate_user_key]
        );
        if (conflicting && (
          String(conflicting.telegram_user_id) !== telegramId
          || conflicting.app_user_key !== before.candidate_user_key
        )) {
          throw new ApiError(409, "Telegram identity is already bound to another account", "identity_binding_conflict");
        }
        const telegram = before.payload?.signedTelegramUser || {};
        await client.query(
          `insert into public.telegram_accounts(
             app_user_key, telegram_user_id, username, first_name, last_name,
             language_code, photo_url, is_premium, first_verified_at, last_verified_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
           on conflict (telegram_user_id) do update
             set username = excluded.username,
                 first_name = excluded.first_name,
                 last_name = excluded.last_name,
                 language_code = excluded.language_code,
                 photo_url = excluded.photo_url,
                 is_premium = excluded.is_premium,
                 last_verified_at = now(),
                 updated_at = now()`,
          [
            before.candidate_user_key,
            telegramId,
            String(telegram.username || ""),
            String(telegram.first_name || ""),
            String(telegram.last_name || ""),
            String(telegram.language_code || ""),
            String(telegram.photo_url || ""),
            Boolean(telegram.is_premium)
          ]
        );
      } else {
        await client.query(
          `update public.app_users
              set telegram_id = null, updated_at = now()
            where user_key = $1 and telegram_id = $2`,
          [before.candidate_user_key, telegramId]
        );
      }
      const review = await one<any>(
        client,
        `update public.data_merge_review
            set status = $2, reviewed_by_admin_id = $3,
                reviewed_at = now(),
                payload = payload || $4::jsonb
          where id = $1 returning *`,
        [
          reviewId,
          status,
          req.adminPrincipal!.adminId,
          JSON.stringify({ resolutionReason: reason })
        ]
      );
      return { before, review };
    });
    await writeAdminAudit(db, req, {
      action: `crm.merge_review.${status}`,
      targetType: "data_merge_review",
      targetId: reviewId,
      reason,
      before: result.before,
      after: result.review
    });
    res.json({ review: result.review });
  }));

  router.get("/crm/users", asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim().slice(0, 200);
    const trustStatus = req.query.trustStatus
      ? enumValue(req.query.trustStatus, "trustStatus", TRUST_STATUSES)
      : "";
    const accountStatus = req.query.accountStatus
      ? enumValue(req.query.accountStatus, "accountStatus", ACCOUNT_STATUSES)
      : "";
    const limit = boundedInteger(req.query.limit, 200, 1, 500);
    const users = await many<any>(
      db,
      `select customer.id as customer_id, customer.user_key, customer.phone,
              customer.first_name, customer.last_name, customer.birth_date,
              customer.trust_status, customer.marketing_opt_in,
              customer.first_seen_at, customer.last_activity_at, customer.app_opens,
              user_row.name, user_row.username, user_row.avatar,
              user_row.account_status, account.telegram_user_id,
              coalesce(points.balance, 0)::bigint as points_balance,
              coalesce(bookings.booking_count, 0)::integer as booking_count,
              bookings.last_booking_at,
              vip.ends_at as vip_ends_at,
              personal_clan.name as personal_clan_name,
              corporate_clan.name as corporate_clan_name
         from public.crm_customers customer
         join public.app_users user_row on user_row.user_key = customer.user_key
         left join public.telegram_accounts account on account.app_user_key = customer.user_key
         left join public.point_accounts points on points.user_key = customer.user_key
         left join (
           select user_key, count(*) as booking_count, max(created_at) as last_booking_at
             from public.booking_records group by user_key
         ) bookings on bookings.user_key = customer.user_key
         left join lateral (
           select ends_at from public.user_vip_subscriptions
            where user_key = customer.user_key and status = 'active' and ends_at > now()
            order by ends_at desc limit 1
         ) vip on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'user'
            limit 1
         ) personal_clan on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'corporate'
            limit 1
         ) corporate_clan on true
        where ($1 = '' or lower(user_row.name) like '%' || lower($1) || '%'
          or lower(user_row.username) like '%' || lower($1) || '%'
          or lower(customer.phone) like '%' || lower($1) || '%'
          or account.telegram_user_id::text = $1)
          and ($2 = '' or customer.trust_status = $2)
          and ($3 = '' or user_row.account_status = $3)
        order by customer.last_activity_at desc, customer.user_key
        limit $4`,
      [search, trustStatus, accountStatus, limit]
    );
    res.json({ users });
  }));

  router.get("/crm/users/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const customer = await crmCustomer(db, userKey);
    const [
      tags,
      notes,
      bookings,
      points,
      rewards,
      gifts,
      vip,
      orders,
      clans,
      checkIns
    ] = await Promise.all([
      many<any>(
        db,
        `select tag.* from public.crm_tags tag
          join public.crm_customer_tags link on link.tag_id = tag.id
         where link.customer_id = $1 order by tag.name`,
        [customer.id]
      ),
      many<any>(
        db,
        `select note.*, admin.email as admin_email
           from public.crm_notes note
           left join public.admin_users admin on admin.id = note.created_by_admin_id
          where note.customer_id = $1 order by note.created_at desc limit 200`,
        [customer.id]
      ),
      many<any>(
        db,
        `select booking.*, event.title as event_title, table_row.table_number
           from public.booking_records booking
           join public.events event on event.id = booking.event_id
           join public.layout_tables table_row on table_row.id = booking.table_id
          where booking.user_key = $1 order by booking.created_at desc`,
        [userKey]
      ),
      many<any>(db, `select * from public.point_ledger where user_key = $1 order by created_at desc limit 300`, [userKey]),
      many<any>(
        db,
        `select grant_row.*, reward.name, reward.icon_url
           from public.user_rewards grant_row
           join public.reward_definitions reward on reward.id = grant_row.reward_id
          where grant_row.user_key = $1 order by grant_row.granted_at desc`,
        [userKey]
      ),
      many<any>(
        db,
        `select gift.*, catalog.name, catalog.image_url
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
          where gift.recipient_user_key = $1 or gift.sender_user_key = $1
          order by gift.created_at desc`,
        [userKey]
      ),
      many<any>(
        db,
        `select subscription.*, plan.name
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1 order by subscription.ends_at desc`,
        [userKey]
      ),
      many<any>(
        db,
        `select shop_order.* from public.shop_orders shop_order
          where shop_order.user_key = $1 order by shop_order.created_at desc`,
        [userKey]
      ),
      many<any>(
        db,
        `select clan.id, clan.name, clan.clan_type, membership.role, membership.status
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1 order by membership.joined_at desc`,
        [userKey]
      ),
      many<any>(
        db,
        `select checkin.*, event.title as event_title
           from public.event_checkins checkin
           join public.events event on event.id = checkin.event_id
          where checkin.user_key = $1 order by checkin.checked_in_at desc`,
        [userKey]
      )
    ]);
    res.json({
      customer,
      tags,
      notes,
      bookings,
      pointLedger: points,
      rewards,
      gifts,
      vip,
      orders,
      clans,
      checkIns
    });
  }));

  router.patch("/crm/users/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const before = await crmCustomer(db, userKey);
    const trustStatus = req.body?.trustStatus === undefined
      ? before.trust_status
      : enumValue(req.body.trustStatus, "trustStatus", TRUST_STATUSES);
    const accountStatus = req.body?.accountStatus === undefined
      ? before.account_status
      : enumValue(req.body.accountStatus, "accountStatus", ACCOUNT_STATUSES);
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const after = await transaction(db, async client => {
      await client.query(
        `update public.crm_customers
            set trust_status = $2,
                marketing_opt_in = $3,
                phone = $4,
                updated_at = now()
          where user_key = $1`,
        [
          userKey,
          trustStatus,
          req.body?.marketingOptIn === undefined
            ? before.marketing_opt_in
            : booleanValue(req.body.marketingOptIn),
          req.body?.phone === undefined ? before.phone : optionalText(req.body.phone, 40)
        ]
      );
      await client.query(
        `update public.app_users
            set account_status = $2,
                blocked_at = case when $2 = 'blocked' then coalesce(blocked_at, now()) else null end,
                updated_at = now()
          where user_key = $1`,
        [userKey, accountStatus]
      );
      if (accountStatus !== "active") {
        await client.query(
          `update public.user_sessions set revoked_at = coalesce(revoked_at, now())
            where app_user_key = $1`,
          [userKey]
        );
      }
      return crmCustomer(client, userKey);
    });
    await writeAdminAudit(db, req, {
      action: "crm.customer.update",
      targetType: "crm_customer",
      targetId: userKey,
      reason,
      before,
      after
    });
    res.json({ customer: after });
  }));

  router.post("/crm/users/:userKey/notes", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const customer = await crmCustomer(db, userKey);
    const note = await one<any>(
      db,
      `insert into public.crm_notes(customer_id, body, created_by_admin_id)
       values ($1,$2,$3) returning *`,
      [customer.id, requiredText(req.body?.body, "body", 4000), req.adminPrincipal!.adminId]
    );
    await writeAdminAudit(db, req, {
      action: "crm.note.create",
      targetType: "crm_note",
      targetId: String(note!.id),
      after: note
    });
    res.status(201).json({ note });
  }));

  router.post("/crm/tags", asyncHandler(async (req, res) => {
    const name = requiredText(req.body?.name, "name", 100);
    const color = requiredText(req.body?.color || "#c8ff3d", "color", 20);
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      throw new ApiError(400, "color must be a six-digit hex value", "validation_error");
    }
    const tag = await one<any>(
      db,
      `insert into public.crm_tags(name, color, created_by_admin_id)
       values ($1,$2,$3)
       on conflict (name) do update set color = excluded.color
       returning *`,
      [name, color, req.adminPrincipal!.adminId]
    );
    await writeAdminAudit(db, req, {
      action: "crm.tag.upsert",
      targetType: "crm_tag",
      targetId: String(tag!.id),
      after: tag
    });
    res.status(201).json({ tag });
  }));

  router.post("/crm/users/:userKey/tags/:tagId", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const tagId = uuid(req.params.tagId, "tagId");
    const customer = await crmCustomer(db, userKey);
    await db.query(
      `insert into public.crm_customer_tags(customer_id, tag_id, assigned_by_admin_id)
       values ($1,$2,$3) on conflict do nothing`,
      [customer.id, tagId, req.adminPrincipal!.adminId]
    );
    await writeAdminAudit(db, req, {
      action: "crm.tag.assign",
      targetType: "crm_customer",
      targetId: userKey,
      after: { tagId }
    });
    res.status(204).end();
  }));

  router.delete("/crm/users/:userKey/tags/:tagId", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const tagId = uuid(req.params.tagId, "tagId");
    const customer = await crmCustomer(db, userKey);
    await db.query(
      `delete from public.crm_customer_tags where customer_id = $1 and tag_id = $2`,
      [customer.id, tagId]
    );
    await writeAdminAudit(db, req, {
      action: "crm.tag.remove",
      targetType: "crm_customer",
      targetId: userKey,
      before: { tagId }
    });
    res.status(204).end();
  }));

  router.get("/events", asyncHandler(async (_req, res) => {
    const events = await many<any>(
      db,
      `select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata,
              assignment.layout_id, layout.name as layout_name,
              coalesce(attendance.going_count,0)::integer as going_count,
              coalesce(bookings.booking_count,0)::integer as booking_count,
              coalesce(checkins.checkin_count,0)::integer as checkin_count
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
         left join public.event_layout_assignments assignment on assignment.event_id = event.id
         left join public.hall_layouts layout on layout.id = assignment.layout_id
         left join (
           select event_id, count(*) filter (where status = 'going') as going_count
             from public.event_attendance group by event_id
         ) attendance on attendance.event_id = event.id
         left join (
           select event_id, count(*) as booking_count from public.booking_records
            where status not in ('cancelled','expired') group by event_id
         ) bookings on bookings.event_id = event.id
         left join (
           select event_id, count(*) as checkin_count from public.event_checkins group by event_id
         ) checkins on checkins.event_id = event.id
        order by coalesce(runtime.starts_at, event.event_date::timestamptz) desc`
    );
    res.json({ events });
  }));

  router.post("/events", asyncHandler(async (req, res) => {
    const eventId = req.body?.id
      ? identifier(req.body.id, "id")
      : `event-${randomUUID()}`;
    const eventDate = dateOnly(req.body?.eventDate, "eventDate");
    const eventTime = timeOnly(req.body?.eventTime || "23:00", "eventTime");
    const status = enumValue(req.body?.status || "draft", "status", EVENT_STATUSES);
    const startsAt = isoDateOrNull(req.body?.startsAt) || new Date(`${eventDate}T${eventTime}`).toISOString();
    const endsAt = isoDateOrNull(req.body?.endsAt);
    const created = await transaction(db, async client => {
      const event = await one<any>(
        client,
        `insert into public.events(
           id, title, event_date, event_time, description,
           image_url, active, sort_order
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,
        [
          eventId,
          requiredText(req.body?.title, "title", 200),
          eventDate,
          eventTime,
          optionalText(req.body?.description, 6000),
          optionalText(req.body?.imageUrl, 4000),
          !["draft", "archived", "cancelled"].includes(status),
          boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000)
        ]
      );
      const runtime = await one<any>(
        client,
        `insert into public.event_runtime(
           event_id, status, starts_at, ends_at, age_limit, dj,
           artists, metadata, published_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,
           case when $2 in ('published','active') then now() else null end
         ) returning *`,
        [
          eventId,
          status,
          startsAt,
          endsAt,
          boundedInteger(req.body?.ageLimit, 18, 18, 99),
          optionalText(req.body?.dj, 300),
          JSON.stringify(Array.isArray(req.body?.artists) ? req.body.artists.slice(0, 100) : []),
          JSON.stringify(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {})
        ]
      );
      return { event, runtime };
    });
    await writeAdminAudit(db, req, {
      action: "event.create",
      targetType: "event",
      targetId: eventId,
      after: created
    });
    res.status(201).json(created);
  }));

  router.patch("/events/:eventId", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const before = await one<any>(
      db,
      `select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
        where event.id = $1`,
      [eventId]
    );
    if (!before) throw new ApiError(404, "Event was not found", "not_found");
    const status = req.body?.status === undefined
      ? before.status
      : enumValue(req.body.status, "status", EVENT_STATUSES);
    const updated = await transaction(db, async client => {
      const event = await one<any>(
        client,
        `update public.events
            set title = $2, event_date = $3, event_time = $4,
                description = $5, image_url = $6, active = $7, sort_order = $8
          where id = $1 returning *`,
        [
          eventId,
          req.body?.title === undefined ? before.title : requiredText(req.body.title, "title", 200),
          req.body?.eventDate === undefined ? before.event_date : dateOnly(req.body.eventDate, "eventDate"),
          req.body?.eventTime === undefined ? before.event_time : timeOnly(req.body.eventTime, "eventTime"),
          req.body?.description === undefined ? before.description : optionalText(req.body.description, 6000),
          req.body?.imageUrl === undefined ? before.image_url : optionalText(req.body.imageUrl, 4000),
          !["draft", "archived", "cancelled"].includes(status),
          boundedInteger(req.body?.sortOrder, Number(before.sort_order || 0), -1_000_000, 1_000_000)
        ]
      );
      const runtime = await one<any>(
        client,
        `update public.event_runtime
            set status = $2, starts_at = $3, ends_at = $4, age_limit = $5,
                dj = $6, artists = $7::jsonb, metadata = $8::jsonb,
                published_at = case
                  when $2 in ('published','active') then coalesce(published_at, now())
                  else published_at end,
                completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else null end,
                archived_at = case when $2 = 'archived' then coalesce(archived_at, now()) else null end,
                updated_at = now()
          where event_id = $1 returning *`,
        [
          eventId,
          status,
          req.body?.startsAt === undefined ? before.starts_at : isoDateOrNull(req.body.startsAt),
          req.body?.endsAt === undefined ? before.ends_at : isoDateOrNull(req.body.endsAt),
          boundedInteger(req.body?.ageLimit, Number(before.age_limit || 18), 18, 99),
          req.body?.dj === undefined ? before.dj : optionalText(req.body.dj, 300),
          JSON.stringify(req.body?.artists === undefined
            ? before.artists
            : Array.isArray(req.body.artists) ? req.body.artists.slice(0, 100) : []),
          JSON.stringify(req.body?.metadata === undefined
            ? before.metadata
            : req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {})
        ]
      );
      return { event, runtime };
    });
    await writeAdminAudit(db, req, {
      action: "event.update",
      targetType: "event",
      targetId: eventId,
      reason: requiredText(req.body?.reason, "reason", 1000),
      before,
      after: updated
    });
    res.json(updated);
  }));

  router.get("/moderation", asyncHandler(async (req, res) => {
    const status = req.query.status
      ? enumValue(req.query.status, "status", MODERATION_STATUSES)
      : "";
    const cases = await many<any>(
      db,
      `select moderation.*, user_row.name as reported_user_name,
              admin.email as assigned_admin_email
         from public.moderation_cases moderation
         left join public.app_users user_row on user_row.user_key = moderation.reported_user_key
         left join public.admin_users admin on admin.id = moderation.assigned_admin_id
        where ($1 = '' or moderation.status = $1)
        order by case moderation.priority
          when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
          moderation.created_at`,
      [status]
    );
    res.json({ cases });
  }));

  router.patch("/moderation/:caseId", asyncHandler(async (req, res) => {
    const caseId = uuid(req.params.caseId, "caseId");
    const before = await one<any>(db, `select * from public.moderation_cases where id = $1`, [caseId]);
    if (!before) throw new ApiError(404, "Moderation case was not found", "not_found");
    const status = req.body?.status === undefined
      ? before.status
      : enumValue(req.body.status, "status", MODERATION_STATUSES);
    const priority = req.body?.priority === undefined
      ? before.priority
      : enumValue(req.body.priority, "priority", MODERATION_PRIORITIES);
    const resolution = req.body?.resolution === undefined
      ? before.resolution
      : optionalText(req.body.resolution, 4000);
    if (["actioned", "dismissed", "closed"].includes(status) && !resolution) {
      throw new ApiError(400, "A resolution is required to close a moderation case", "validation_error");
    }
    const after = await one<any>(
      db,
      `update public.moderation_cases
          set status = $2, priority = $3, resolution = $4,
              assigned_admin_id = $5,
              closed_at = case when $2 in ('actioned','dismissed','closed') then now() else null end,
              updated_at = now()
        where id = $1 returning *`,
      [caseId, status, priority, resolution, req.adminPrincipal!.adminId]
    );
    await writeAdminAudit(db, req, {
      action: "moderation.case.update",
      targetType: "moderation_case",
      targetId: caseId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after
    });
    res.json({ case: after });
  }));

  router.get("/platform-audit", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 500, 1, 2000);
    const action = String(req.query.action || "").trim().slice(0, 200);
    const audit = await many<any>(
      db,
      `select * from public.admin_audit_log
        where ($1 = '' or action = $1)
        order by created_at desc limit $2`,
      [action, limit]
    );
    res.json({ audit });
  }));

  return router;
}
