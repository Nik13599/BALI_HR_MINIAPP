import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import type { Queryable } from "../types.js";
import { enumValue, identifier, optionalText, uuid } from "../validation.js";
import { publishedLayoutBundle } from "./layouts.js";

const ATTENDANCE = ["going", "maybe", "not_going", "cancelled"] as const;
const INVITATION_RESPONSE = ["going", "maybe", "declined"] as const;

function eventIsFuture(row: any): boolean {
  if (["completed", "archived", "cancelled"].includes(String(row.runtime_status || ""))) return false;
  const fallback = row.event_date
    ? `${String(row.event_date).slice(0, 10)}T${String(row.event_time || "23:00").slice(0, 5)}:00`
    : "";
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : Number.NaN;
  const timestamp = row.ends_at
    ? new Date(row.ends_at).getTime()
    : Number.isNaN(startsAt)
      ? (fallback ? new Date(fallback).getTime() + 12 * 60 * 60 * 1000 : Number.NaN)
      : startsAt + 12 * 60 * 60 * 1000;
  return Number.isNaN(timestamp) || timestamp > Date.now();
}

async function eventRecord(db: Queryable, eventId: string): Promise<any> {
  const row = await one<any>(
    db,
    `select e.*, r.status as runtime_status, r.starts_at, r.ends_at, r.age_limit,
            r.dj, r.artists, r.metadata
       from public.events e
       left join public.event_runtime r on r.event_id = e.id
      where e.id = $1`,
    [eventId]
  );
  if (!row) throw new ApiError(404, "Event was not found", "not_found");
  return row;
}

async function queueNotification(
  db: Queryable,
  input: {
    userKey: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    idempotencyKey: string;
  }
): Promise<void> {
  await db.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [
      input.userKey,
      input.type,
      input.title,
      input.body,
      JSON.stringify(input.data || {}),
      input.idempotencyKey
    ]
  );
}

export function createEventsRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select e.id, e.title, e.event_date, e.event_time, e.description, e.image_url,
              e.active, e.sort_order,
              coalesce(r.status, case when e.active then 'published' else 'draft' end) as status,
              r.starts_at, r.ends_at, r.age_limit, r.dj, r.artists, r.metadata,
              attendance.status as my_attendance_status,
              coalesce(counts.going_count, 0)::integer as going_count,
              coalesce(counts.maybe_count, 0)::integer as maybe_count,
              coalesce(checkins.checked_in_count, 0)::integer as checked_in_count
         from public.events e
         left join public.event_runtime r on r.event_id = e.id
         left join public.event_attendance attendance
           on attendance.event_id = e.id and attendance.user_key = $1
         left join (
           select event_id,
                  count(*) filter (where status = 'going') as going_count,
                  count(*) filter (where status = 'maybe') as maybe_count
             from public.event_attendance
            group by event_id
         ) counts on counts.event_id = e.id
         left join (
           select event_id, count(*)::integer as checked_in_count
             from public.event_checkins
            group by event_id
         ) checkins on checkins.event_id = e.id
        where e.active = true
          and coalesce(r.status, 'published') in ('published', 'active', 'completed')
        order by coalesce(r.starts_at, e.event_date::timestamptz), e.sort_order, e.title`,
      [req.userPrincipal!.userKey]
    );
    res.json({ events: rows });
  }));

  router.get("/invitations/me", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select invitation.*, sender.name as sender_name, sender.avatar as sender_avatar,
              event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at
         from public.event_invitations invitation
         join public.app_users sender on sender.user_key = invitation.sender_user_key
         join public.events event on event.id = invitation.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where invitation.recipient_user_key = $1
        order by case when invitation.status = 'pending' then 0 else 1 end,
                 invitation.created_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ invitations: rows });
  }));

  router.patch("/invitations/:invitationId", asyncHandler(async (req, res) => {
    const invitationId = uuid(req.params.invitationId, "invitationId");
    const status = enumValue(req.body?.status, "status", INVITATION_RESPONSE);
    const result = await transaction(db, async client => {
      const invitation = await one<any>(
        client,
        `select invitation.*, event.title as event_title
           from public.event_invitations invitation
           join public.events event on event.id = invitation.event_id
          where invitation.id = $1 and invitation.recipient_user_key = $2
          for update`,
        [invitationId, req.userPrincipal!.userKey]
      );
      if (!invitation) throw new ApiError(404, "Invitation was not found", "not_found");
      if (invitation.status !== "pending") {
        throw new ApiError(409, "Invitation has already been answered", "invitation_already_answered");
      }
      const updated = await one<any>(
        client,
        `update public.event_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1
          returning *`,
        [invitationId, status]
      );
      if (status === "going" || status === "maybe") {
        await client.query(
          `insert into public.event_attendance(
             event_id, user_key, status, source_type, source_id
           ) values ($1,$2,$3,'invitation',$4)
           on conflict (event_id, user_key) do update
             set status = excluded.status,
                 source_type = excluded.source_type,
                 source_id = excluded.source_id,
                 responded_at = now(),
                 updated_at = now()`,
          [invitation.event_id, req.userPrincipal!.userKey, status, invitationId]
        );
      }
      await queueNotification(client, {
        userKey: invitation.sender_user_key,
        type: "event_invitation_response",
        title: "Ответ на приглашение",
        body: `${req.userPrincipal!.name} ответил на приглашение: ${status === "going" ? "Иду" : status === "maybe" ? "Возможно" : "Отклонено"}.`,
        data: { invitationId, eventId: invitation.event_id, status },
        idempotencyKey: `event-invitation-response:${invitationId}`
      });
      return updated;
    });
    res.json({ invitation: result });
  }));

  router.get("/:eventId/layout", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    await eventRecord(db, eventId);
    const assignment = await one<any>(
      db,
      `select assignment.*, layout.status as layout_status
         from public.event_layout_assignments assignment
         join public.hall_layouts layout on layout.id = assignment.layout_id
        where assignment.event_id = $1`,
      [eventId]
    );
    if (!assignment) throw new ApiError(404, "Event layout was not assigned", "event_layout_not_found");
    const bundle = await publishedLayoutBundle(db, assignment.layout_id, true);
    const availability = await many<any>(
      db,
      `select layout_table.id,
              case
                when booking.id is not null then
                  case when booking.status in ('new','pending') then 'pending' else 'booked' end
                when hold.id is not null and hold.user_key = $2 then 'selected'
                when hold.id is not null then 'held'
                when layout_table.status = 'unavailable' then 'unavailable'
                when layout_table.status = 'vip_only' then 'vip'
                when layout_table.status = 'clan_only' then 'clan'
                else 'available'
              end as availability_status,
              hold.expires_at as hold_expires_at,
              case when hold.user_key = $2 then hold.id else null end as my_hold_id
         from public.layout_tables layout_table
         left join public.booking_records booking
           on booking.event_id = $1
          and booking.table_id = layout_table.id
          and booking.status in ('held','new','pending','confirmed','checked_in')
         left join public.booking_holds hold
           on hold.event_id = $1
          and hold.table_id = layout_table.id
          and hold.status = 'active'
          and hold.expires_at > now()
        where layout_table.layout_id = $3 and layout_table.active = true`,
      [eventId, req.userPrincipal!.userKey, assignment.layout_id]
    );
    const availabilityById = new Map(availability.map(row => [row.id, row]));
    res.json({
      eventId,
      assignment,
      layout: bundle.layout,
      elements: bundle.elements,
      tables: bundle.tables.map(table => ({
        ...table,
        ...(availabilityById.get(table.id) || { availability_status: "available" })
      }))
    });
  }));

  router.get("/:eventId", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const event = await eventRecord(db, eventId);
    const [attendance, clans, checkins] = await Promise.all([
      many<any>(
        db,
        `select attendance.status, attendance.updated_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_attendance attendance
           join public.app_users user_row on user_row.user_key = attendance.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where attendance.event_id = $1
            and attendance.status in ('going', 'maybe')
            and coalesce(profile.discoverable, true) = true
          order by attendance.updated_at desc`,
        [eventId]
      ),
      many<any>(
        db,
        `select distinct clan.id, clan.name, clan.clan_type,
                count(clan_attendance.user_key)::integer as participant_count
           from public.clan_event_attendance clan_attendance
           join public.clans clan on clan.id = clan_attendance.clan_id
          where clan_attendance.event_id = $1
            and clan_attendance.status in ('going', 'maybe')
          group by clan.id, clan.name, clan.clan_type
          order by participant_count desc, clan.name`,
        [eventId]
      ),
      many<any>(
        db,
        `select checkin.checked_in_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_checkins checkin
           join public.app_users user_row on user_row.user_key = checkin.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where checkin.event_id = $1
            and coalesce(profile.discoverable, true) = true
          order by checkin.checked_in_at desc`,
        [eventId]
      )
    ]);
    res.json({ event, participants: attendance, checkedIn: checkins, clans });
  }));

  router.put("/:eventId/attendance", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const status = enumValue(req.body?.status, "status", ATTENDANCE);
    const event = await eventRecord(db, eventId);
    if (!eventIsFuture(event) && status !== "cancelled") {
      throw new ApiError(409, "Attendance can be changed only for an active future event", "event_not_active");
    }
    const attendance = await one<any>(
      db,
      `insert into public.event_attendance(event_id, user_key, status, source_type)
       values ($1,$2,$3,'self')
       on conflict (event_id, user_key) do update
         set status = excluded.status,
             source_type = 'self',
             responded_at = now(),
             updated_at = now()
       returning *`,
      [eventId, req.userPrincipal!.userKey, status]
    );
    res.json({ attendance });
  }));

  router.post("/:eventId/invitations", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "event_invitation.create", requestSubject(req));
    const eventId = identifier(req.params.eventId, "eventId");
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    if (recipientUserKey === req.userPrincipal!.userKey) {
      throw new ApiError(400, "A user cannot invite themselves", "validation_error");
    }
    const event = await eventRecord(db, eventId);
    if (!eventIsFuture(event)) {
      throw new ApiError(409, "Only active future events can be invited to", "event_not_active");
    }
    const recipient = await one<any>(
      db,
      `select user_row.user_key, user_row.name,
              coalesce(profile.allow_event_invites, true) as allow_event_invites,
              exists(
                select 1 from public.user_blocks block
                 where (block.blocker_user_key = $1 and block.blocked_user_key = user_row.user_key)
                    or (block.blocker_user_key = user_row.user_key and block.blocked_user_key = $1)
              ) as blocked
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $2 and user_row.account_status = 'active'`,
      [req.userPrincipal!.userKey, recipientUserKey]
    );
    if (!recipient) throw new ApiError(404, "Recipient was not found", "not_found");
    if (recipient.blocked) throw new ApiError(403, "Invitation is unavailable because one of the users blocked the other", "user_blocked");
    if (!recipient.allow_event_invites) throw new ApiError(403, "Recipient disabled event invitations", "event_invitations_disabled");
    try {
      const invitation = await transaction(db, async client => {
        const created = await one<any>(
          client,
          `insert into public.event_invitations(
             event_id, sender_user_key, recipient_user_key, message
           ) values ($1,$2,$3,$4)
           returning *`,
          [eventId, req.userPrincipal!.userKey, recipientUserKey, message]
        );
        await queueNotification(client, {
          userKey: recipientUserKey,
          type: "event_invitation",
          title: "Приглашение на мероприятие",
          body: `${req.userPrincipal!.name} приглашает вас на «${event.title}».`,
          data: { invitationId: created!.id, eventId },
          idempotencyKey: `event-invitation:${created!.id}`
        });
        return created;
      });
      res.status(201).json({ invitation });
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new ApiError(409, "An unanswered invitation already exists", "invitation_already_pending");
      }
      throw error;
    }
  }));

  router.post("/:eventId/archive-invitations", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    await eventRecord(db, eventId);
    const result = await db.query(
      `update public.event_invitations
          set status = 'archived', archived_at = now(), updated_at = now()
        where event_id = $1
          and (sender_user_key = $2 or recipient_user_key = $2)
          and status <> 'archived'`,
      [eventId, req.userPrincipal!.userKey]
    );
    res.json({ archived: result.rowCount || 0 });
  }));

  return router;
}
