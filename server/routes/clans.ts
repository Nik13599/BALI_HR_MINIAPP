import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import {
  actorTypeForDecision,
  decidePermission,
  effectivePermissionKeys,
  requireClanPermission
} from "../permissions.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  identifier,
  isoDateOrNull,
  optionalText,
  requiredText,
  uniqueStrings,
  uuid
} from "../validation.js";
import { writeAudit } from "../audit.js";
import { visibleProfiles } from "../privacy.js";
import { sha256 } from "../security.js";

function chatId(req: any): string {
  const id = req.permissionDecision?.chat?.chat_id;
  if (!id) throw new ApiError(403, "Clan chat is unavailable", "chat_unavailable");
  return String(id);
}

function deletedText(row: any): string {
  if (!row.deleted_at) return row.body;
  if (row.deleted_by_type === "admin") return "Сообщение удалено администратором BALI";
  if (["leader", "delegate"].includes(row.deleted_by_type)) return "Сообщение удалено руководителем клана";
  return "Сообщение удалено автором";
}

function serializeMessage(row: any) {
  return {
    id: row.id,
    body: deletedText(row),
    messageType: row.message_type,
    author: row.author_user_key ? {
      id: row.author_user_key,
      name: row.author_name || "Участник BALI"
    } : null,
    reply: row.reply_to_message_id ? {
      id: row.reply_to_message_id,
      body: row.reply_deleted_at ? "Сообщение удалено" : row.reply_body,
      authorName: row.reply_author_name || "Участник BALI"
    } : null,
    deleted: Boolean(row.deleted_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listMessages(db: Queryable, id: string, before: string | null, limit: number) {
  const rows = await many<any>(
    db,
    `select m.*, u.name as author_name,
            parent.body as reply_body, parent.deleted_at as reply_deleted_at,
            parent_user.name as reply_author_name
       from public.clan_chat_messages m
       left join public.app_users u on u.user_key = m.author_user_key
       left join public.clan_chat_messages parent on parent.id = m.reply_to_message_id
       left join public.app_users parent_user on parent_user.user_key = parent.author_user_key
      where m.chat_id = $1
        and ($2::timestamptz is null or m.created_at < $2::timestamptz)
      order by m.created_at desc, m.id desc
      limit $3`,
    [id, before, limit]
  );
  return rows.reverse().map(serializeMessage);
}

async function pollBundle(db: Queryable, id: string, userKey: string) {
  const polls = await many<any>(
    db,
    `select * from public.clan_chat_polls
      where chat_id = $1 and status <> 'deleted'
      order by created_at desc limit 30`,
    [id]
  );
  if (!polls.length) return [];
  const result = [];
  for (const poll of polls) {
    const options = await many<any>(
      db,
      `select o.id, o.label, o.sort_order, count(v.id)::integer as votes
         from public.clan_chat_poll_options o
         left join public.clan_chat_poll_votes v on v.option_id = o.id
        where o.poll_id = $1
        group by o.id, o.label, o.sort_order
        order by o.sort_order`,
      [poll.id]
    );
    const mine = await many<any>(
      db,
      `select option_id from public.clan_chat_poll_votes
        where poll_id = $1 and voter_user_key = $2`,
      [poll.id, userKey]
    );
    result.push({
      ...poll,
      options,
      myOptionIds: mine.map(row => row.option_id),
      responseCreatesCheckin: false
    });
  }
  return result;
}

async function ensureTargetInChat(db: Queryable, type: string, targetId: string, id: string): Promise<void> {
  const tables: Record<string, string> = {
    message: "clan_chat_messages",
    poll: "clan_chat_polls",
    event: "clan_chat_events",
    announcement: "clan_chat_announcements"
  };
  const table = tables[type];
  if (!table) throw new ApiError(400, "Unsupported pin target", "validation_error");
  const target = await one<any>(db, `select id from public.${table} where id = $1 and chat_id = $2`, [targetId, id]);
  if (!target) throw new ApiError(404, "Pin target was not found", "not_found");
}

export function createClanRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select c.id, c.name, c.clan_type, m.role, ch.id as chat_id, ch.enabled, ch.read_only
         from public.clan_memberships m
         join public.clans c on c.id = m.clan_id and c.status = 'active'
         join public.clan_chats ch on ch.clan_id = c.id
        where m.user_key = $1 and m.status = 'active'
        order by c.name`,
      [req.userPrincipal!.userKey]
    );
    const counts = rows.length
      ? await many<any>(
          db,
          `select message.chat_id, count(*)::integer as unread_count
             from public.clan_chat_messages message
             left join public.clan_chat_read_states read_state
               on read_state.chat_id = message.chat_id and read_state.user_key = $1
            where message.chat_id in (${rows.map((_, index) => `$${index + 2}`).join(",")})
              and message.deleted_at is null
              and message.created_at > coalesce(
                read_state.last_read_at,
                '1970-01-01T00:00:00Z'::timestamptz
              )
              and (message.author_user_key is null or message.author_user_key <> $1)
            group by message.chat_id`,
          [req.userPrincipal!.userKey, ...rows.map(row => row.chat_id)]
        )
      : [];
    const countsByChat = new Map(
      counts.map(row => [String(row.chat_id), Number(row.unread_count || 0)])
    );
    const clans = rows.map(row => ({
      ...row,
      unread_count: countsByChat.get(String(row.chat_id)) || 0
    }));
    res.json({ clans });
  }));

  router.get("/ranking", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select c.id, c.name, c.clan_type, c.rating_points,
              leader.name as leader_name,
              coalesce(members.member_count, 0)::integer as member_count,
              case when mine.clan_id is null then false else true end as is_member
         from public.clans c
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select distinct clan_id
             from public.clan_memberships
            where user_key = $1 and status = 'active'
         ) mine on mine.clan_id = c.id
        where c.status = 'active'
        order by c.clan_type, c.rating_points desc, coalesce(members.member_count, 0) desc, c.name asc`,
      [req.userPrincipal!.userKey]
    );
    const positions = { user: 0, corporate: 0 };
    const clans = rows.map(row => {
      const clanType = row.clan_type === "corporate" ? "corporate" : "user";
      positions[clanType] += 1;
      return {
        id: row.id,
        name: row.name,
        clanType,
        leaderName: row.leader_name || "",
        ratingPoints: Number(row.rating_points || 0),
        memberCount: Number(row.member_count || 0),
        isMember: Boolean(row.is_member),
        position: positions[clanType]
      };
    });
    res.json({
      clans,
      categories: {
        user: clans.filter(row => row.clanType === "user"),
        corporate: clans.filter(row => row.clanType === "corporate")
      }
    });
  }));

  router.get("/invitations/me", asyncHandler(async (req, res) => {
    const invitations = await many<any>(
      db,
      `select invitation.*, clan.name as clan_name, clan.clan_type,
              inviter.name as inviter_name
         from public.clan_invitations invitation
         join public.clans clan on clan.id = invitation.clan_id
         join public.app_users inviter on inviter.user_key = invitation.inviter_user_key
        where invitation.invitee_user_key = $1
          and invitation.status = 'pending'
          and (invitation.expires_at is null or invitation.expires_at > now())
        order by invitation.created_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ invitations });
  }));

  router.patch("/invitations/:invitationId", asyncHandler(async (req, res) => {
    const invitationId = uuid(req.params.invitationId, "invitationId");
    const status = req.body?.status === "accepted"
      ? "accepted"
      : req.body?.status === "declined" ? "declined" : "";
    if (!status) throw new ApiError(400, "status must be accepted or declined", "validation_error");
    const result = await transaction(db, async client => {
      const invitation = await one<any>(
        client,
        `select invitation.*, clan.clan_type, clan.status as clan_status
           from public.clan_invitations invitation
           join public.clans clan on clan.id = invitation.clan_id
          where invitation.id = $1 and invitation.invitee_user_key = $2
          for update`,
        [invitationId, req.userPrincipal!.userKey]
      );
      if (!invitation) throw new ApiError(404, "Clan invitation was not found", "not_found");
      if (invitation.status !== "pending") {
        throw new ApiError(409, "Clan invitation has already been answered", "clan_invitation_answered");
      }
      if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
        await client.query(
          `update public.clan_invitations set status = 'expired', updated_at = now() where id = $1`,
          [invitationId]
        );
        throw new ApiError(409, "Clan invitation has expired", "clan_invitation_expired");
      }
      if (invitation.clan_status !== "active") {
        throw new ApiError(409, "Clan is not active", "clan_unavailable");
      }
      if (status === "accepted") {
        const conflict = await one<any>(
          client,
          `select clan.id, clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = $1
              and membership.status = 'active'
              and membership.clan_type = $2
            limit 1`,
          [req.userPrincipal!.userKey, invitation.clan_type]
        );
        if (conflict) {
          throw new ApiError(
            409,
            "You already belong to a clan in this category",
            "clan_category_membership_conflict",
            { clanId: conflict.id, clanName: conflict.name, clanType: invitation.clan_type }
          );
        }
        await client.query(
          `insert into public.clan_memberships(
             clan_id, user_key, clan_type, role, status
           ) values ($1,$2,$3,'member','active')`,
          [invitation.clan_id, req.userPrincipal!.userKey, invitation.clan_type]
        );
      }
      const updated = await one<any>(
        client,
        `update public.clan_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1 returning *`,
        [invitationId, status]
      );
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'clan_invitation_response',$2,$3,$4::jsonb,$5)
         on conflict (idempotency_key) do nothing`,
        [
          invitation.inviter_user_key,
          status === "accepted" ? "Приглашение в клан принято" : "Приглашение в клан отклонено",
          `${req.userPrincipal!.name}: ${status === "accepted" ? "вступил в клан" : "отклонил приглашение"}.`,
          JSON.stringify({ invitationId, clanId: invitation.clan_id, status }),
          `clan-invitation-response:${invitationId}`
        ]
      );
      return updated;
    });
    res.json({ invitation: result });
  }));

  router.post("/:clanId/invitations", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "invitation.create", requestSubject(req, req.params.clanId));
    const inviteeUserKey = identifier(req.body?.inviteeUserKey, "inviteeUserKey");
    const message = optionalText(req.body?.message, 500);
    if (inviteeUserKey === req.userPrincipal!.userKey) {
      throw new ApiError(400, "A leader cannot invite themselves", "validation_error");
    }
    const clan = await one<any>(
      db,
      `select clan.*, membership.role
         from public.clans clan
         join public.clan_memberships membership on membership.clan_id = clan.id
        where clan.id = $1
          and membership.user_key = $2
          and membership.status = 'active'`,
      [req.params.clanId, req.userPrincipal!.userKey]
    );
    if (!clan || clan.status !== "active") {
      throw new ApiError(404, "Active clan was not found", "not_found");
    }
    if (clan.role !== "leader") {
      throw new ApiError(403, "Only the clan leader can invite members", "permission_denied");
    }
    const [invitee, conflict] = await Promise.all([
      one<any>(
        db,
        `select user_key, name from public.app_users
          where user_key = $1 and account_status = 'active'`,
        [inviteeUserKey]
      ),
      one<any>(
        db,
        `select clan.id, clan.name
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1
            and membership.status = 'active'
            and membership.clan_type = $2
          limit 1`,
        [inviteeUserKey, clan.clan_type]
      )
    ]);
    if (!invitee) throw new ApiError(404, "Invitee was not found", "not_found");
    if (conflict) {
      throw new ApiError(
        409,
        "This user already belongs to a clan in the same category",
        "clan_category_membership_conflict",
        { clanId: conflict.id, clanName: conflict.name, clanType: clan.clan_type }
      );
    }
    try {
      const invitation = await transaction(db, async client => {
        const created = await one<any>(
          client,
          `insert into public.clan_invitations(
             clan_id, inviter_user_key, invitee_user_key, message, expires_at
           ) values ($1,$2,$3,$4,now() + interval '7 days')
           returning *`,
          [clan.id, req.userPrincipal!.userKey, inviteeUserKey, message]
        );
        await client.query(
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'clan_invitation',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,
          [
            inviteeUserKey,
            "Приглашение в клан",
            `${req.userPrincipal!.name} приглашает вас в «${clan.name}».`,
            JSON.stringify({ invitationId: created!.id, clanId: clan.id }),
            `clan-invitation:${created!.id}`
          ]
        );
        return created;
      });
      res.status(201).json({ invitation });
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new ApiError(409, "A pending invitation already exists", "clan_invitation_pending");
      }
      throw error;
    }
  }));

  router.get("/:clanId/chat", requireClanPermission(db, "chat.read"), asyncHandler(async (req, res) => {
    const id = chatId(req);
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const before = req.query.before ? isoDateOrNull(req.query.before) : null;
    const [messages, polls, events, announcements, pins, notificationPreference, permissions] = await Promise.all([
      listMessages(db, id, before, limit),
      pollBundle(db, id, req.userPrincipal!.userKey),
      many<any>(
        db,
        `select ce.id, ce.is_primary, ce.created_at,
                e.id as event_id, e.title, e.event_date, e.event_time,
                e.description, e.image_url, e.active
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1
          order by ce.is_primary desc, e.event_date asc, e.event_time asc`,
        [id]
      ),
      many<any>(
        db,
        `select * from public.clan_chat_announcements
          where chat_id = $1 order by published_at desc limit 20`,
        [id]
      ),
      many<any>(
        db,
        `select * from public.clan_chat_pins
          where chat_id = $1 order by created_at desc`,
        [id]
      ),
      one<any>(
        db,
        `select muted_until, announcements_only
           from public.clan_chat_notification_preferences
          where chat_id = $1 and user_key = $2`,
        [id, req.userPrincipal!.userKey]
      ),
      effectivePermissionKeys(db, req.userPrincipal!, req.params.clanId)
    ]);
    res.json({
      clan: {
        id: req.permissionDecision!.membership!.clan_id,
        name: req.permissionDecision!.membership!.clan_name,
        clanType: req.permissionDecision!.membership!.clan_type,
        role: req.permissionDecision!.membership!.role
      },
      chat: {
        id,
        enabled: req.permissionDecision!.chat!.enabled,
        readOnly: req.permissionDecision!.chat!.read_only,
        ownDeleteWindowSeconds: req.permissionDecision!.chat!.own_delete_window_seconds,
        settings: req.permissionDecision!.chat!.settings
      },
      permissions,
      messages,
      pagination: { hasMore: messages.length === limit, nextBefore: messages[0]?.createdAt || null },
      polls,
      events,
      announcements,
      pins,
      notificationPreference: notificationPreference || {
        muted_until: null,
        announcements_only: false
      }
    });
  }));

  router.get("/:clanId/messages", requireClanPermission(db, "message.read"), asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const before = req.query.before ? isoDateOrNull(req.query.before) : null;
    const messages = await listMessages(db, chatId(req), before, limit);
    res.json({
      messages,
      pagination: { hasMore: messages.length === limit, nextBefore: messages[0]?.createdAt || null }
    });
  }));

  router.get("/:clanId/members", requireClanPermission(db, "chat.read"), asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select user_key, role from public.clan_memberships
        where clan_id = $1 and status = 'active'
        order by case when role = 'leader' then 0 else 1 end, joined_at`,
      [req.params.clanId]
    );
    const profiles = await visibleProfiles(
      db,
      req.userPrincipal!.userKey,
      rows.map(row => row.user_key)
    );
    const profileByKey = new Map(profiles.map(profile => [String(profile.id), profile]));
    const members = rows
      .filter(row => profileByKey.has(row.user_key))
      .map(row => ({ role: row.role, profile: profileByKey.get(row.user_key) }));
    res.json({ members });
  }));

  router.get("/:clanId/events/available", requireClanPermission(db, "event.read"), asyncHandler(async (_req, res) => {
    const events = await many<any>(
      db,
      `select id, title, event_date, event_time, description, image_url
         from public.events
        where active = true and event_date >= current_date
        order by event_date, event_time limit 100`
    );
    res.json({ events });
  }));

  router.post("/:clanId/messages", requireClanPermission(db, "message.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "message.create", requestSubject(req, req.params.clanId));
    const body = requiredText(req.body?.body, "body", 4000);
    const replyToId = req.body?.replyToId ? uuid(req.body.replyToId, "replyToId") : null;
    const id = chatId(req);
    if (replyToId) {
      const replyPermission = await decidePermission(db, req.userPrincipal!, req.params.clanId, "message.reply");
      if (!replyPermission.allowed) throw new ApiError(403, "Reply is not permitted", "permission_denied");
      const parent = await one<any>(
        db,
        `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [replyToId, id]
      );
      if (!parent) throw new ApiError(404, "Reply target was not found", "not_found");
    }
    const links = body.match(/https?:\/\/\S+/gi) || [];
    if (links.length) {
      await enforceRateLimit(db, req, "message.links", requestSubject(req, req.params.clanId), links.length);
    }
    const mentions = body.match(/@[\p{L}\p{N}_]{2,32}/gu) || [];
    if (mentions.length) {
      await enforceRateLimit(db, req, "message.mentions", requestSubject(req, req.params.clanId), mentions.length);
    }
    const repeatedBodyKey = sha256(body.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim()).slice(0, 24);
    await enforceRateLimit(
      db,
      req,
      "message.repeat",
      requestSubject(req, `${req.params.clanId}:${repeatedBodyKey}`)
    );
    const message = await transaction(db, async client => {
      const row = await one<any>(
        client,
        `insert into public.clan_chat_messages(
           chat_id, author_user_key, body, reply_to_message_id
         ) values ($1,$2,$3,$4)
         returning *`,
        [id, req.userPrincipal!.userKey, body, replyToId]
      );
      if (replyToId) {
        await client.query(
          `insert into public.clan_chat_message_replies(message_id, parent_message_id)
           values ($1,$2)`,
          [row!.id, replyToId]
        );
      }
      return row!;
    });
    res.status(201).json({ message: serializeMessage({ ...message, author_name: req.userPrincipal!.name }) });
  }));

  router.delete("/:clanId/messages/:messageId", asyncHandler(async (req, res) => {
    const ownDecision = await decidePermission(db, req.userPrincipal!, req.params.clanId, "message.delete_own");
    if (!ownDecision.membership?.chat_id) throw new ApiError(403, "Clan access is denied", "permission_denied");
    const messageId = uuid(req.params.messageId, "messageId");
    const message = await one<any>(
      db,
      `select * from public.clan_chat_messages where id = $1 and chat_id = $2`,
      [messageId, ownDecision.membership.chat_id]
    );
    if (!message) throw new ApiError(404, "Message was not found", "not_found");
    if (message.deleted_at) return res.status(204).end();

    const isOwn = message.author_user_key === req.userPrincipal!.userKey;
    const ageSeconds = (Date.now() - new Date(message.created_at).getTime()) / 1000;
    let decision = ownDecision;
    if (!isOwn || ageSeconds > Number(ownDecision.chat?.own_delete_window_seconds || 0)) {
      decision = await decidePermission(db, req.userPrincipal!, req.params.clanId, "message.delete_any");
    }
    if (!decision.allowed) throw new ApiError(403, "Message deletion is not permitted", "permission_denied");
    const reason = optionalText(req.body?.reason, 500);
    const actorType = actorTypeForDecision(decision);
    const replacement = actorType === "leader" || actorType === "delegate"
      ? "Сообщение удалено руководителем клана"
      : "Сообщение удалено автором";
    await db.query(
      `update public.clan_chat_messages
          set body = $1, deleted_at = now(), deleted_by_type = $2,
              deleted_by_id = $3, deletion_reason = $4
        where id = $5`,
      [replacement, actorType, req.userPrincipal!.userKey, reason, messageId]
    );
    if (actorType !== "user") {
      await writeAudit(db, req, {
        actorType,
        actorId: req.userPrincipal!.userKey,
        permissionKey: "message.delete_any",
        action: "message.delete",
        targetType: "message",
        targetId: messageId,
        clanId: req.params.clanId,
        reason,
        before: { body: message.body, authorUserKey: message.author_user_key },
        after: { deleted: true }
      });
    }
    res.status(204).end();
  }));

  router.post("/:clanId/read", requireClanPermission(db, "chat.read"), asyncHandler(async (req, res) => {
    const messageId = req.body?.messageId ? uuid(req.body.messageId, "messageId") : null;
    if (messageId) {
      const found = await one<any>(
        db,
        `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [messageId, chatId(req)]
      );
      if (!found) throw new ApiError(404, "Message was not found", "not_found");
    }
    await db.query(
      `insert into public.clan_chat_read_states(chat_id, user_key, last_read_message_id, last_read_at)
       values ($1,$2,$3,now())
       on conflict (chat_id, user_key) do update set
         last_read_message_id = excluded.last_read_message_id,
         last_read_at = now(),
         updated_at = now()`,
      [chatId(req), req.userPrincipal!.userKey, messageId]
    );
    res.status(204).end();
  }));

  router.post("/:clanId/messages/:messageId/reports", requireClanPermission(db, "report.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "report.create", requestSubject(req, req.params.clanId));
    const messageId = uuid(req.params.messageId, "messageId");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const message = await one<any>(
      db,
      `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
      [messageId, chatId(req)]
    );
    if (!message) throw new ApiError(404, "Message was not found", "not_found");
    const report = await one<any>(
      db,
      `insert into public.clan_chat_reports(chat_id, message_id, reporter_user_key, reason)
       values ($1,$2,$3,$4)
       on conflict (message_id, reporter_user_key) do update set
         reason = excluded.reason, status = 'new', updated_at = now()
       returning *`,
      [chatId(req), messageId, req.userPrincipal!.userKey, reason]
    );
    res.status(201).json({ report });
  }));

  router.post("/:clanId/polls", requireClanPermission(db, "poll.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "poll.create", requestSubject(req, req.params.clanId));
    const question = requiredText(req.body?.question, "question", 500);
    const options = uniqueStrings(req.body?.options, "options", 2, 10, 200);
    const closesAt = isoDateOrNull(req.body?.closesAt);
    if (closesAt && new Date(closesAt).getTime() <= Date.now()) {
      throw new ApiError(400, "Poll close time must be in the future", "validation_error");
    }
    const poll = await transaction(db, async client => {
      const row = await one<any>(
        client,
        `insert into public.clan_chat_polls(
           chat_id, created_by_user_key, question, allow_multiple,
           anonymous, show_results_before_vote, closes_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,
        [
          chatId(req),
          req.userPrincipal!.userKey,
          question,
          booleanValue(req.body?.allowMultiple),
          booleanValue(req.body?.anonymous),
          booleanValue(req.body?.showResultsBeforeVote),
          closesAt
        ]
      );
      for (let index = 0; index < options.length; index += 1) {
        await client.query(
          `insert into public.clan_chat_poll_options(poll_id, label, sort_order)
           values ($1,$2,$3)`,
          [row!.id, options[index], index]
        );
      }
      return row!;
    });
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "poll.create",
      action: "poll.create",
      targetType: "poll",
      targetId: poll.id,
      clanId: req.params.clanId,
      after: { question, options }
    });
    res.status(201).json({ poll });
  }));

  router.post("/:clanId/polls/:pollId/votes", requireClanPermission(db, "poll.vote"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "poll.vote", requestSubject(req, req.params.clanId));
    const pollId = uuid(req.params.pollId, "pollId");
    const optionIds = uniqueStrings(req.body?.optionIds, "optionIds", 1, 10, 80).map(value => uuid(value, "optionId"));
    const poll = await one<any>(
      db,
      `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
      [pollId, chatId(req)]
    );
    if (!poll) throw new ApiError(404, "Poll was not found", "not_found");
    if (poll.status !== "active" || (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now())) {
      throw new ApiError(409, "Poll is closed", "poll_closed");
    }
    if (!poll.allow_multiple && optionIds.length !== 1) {
      throw new ApiError(400, "This poll accepts one option", "validation_error");
    }
    const validOptions = await many<any>(
      db,
      `select id from public.clan_chat_poll_options where poll_id = $1`,
      [pollId]
    );
    const valid = new Set(validOptions.map(row => String(row.id)));
    if (optionIds.some(id => !valid.has(id))) throw new ApiError(400, "Poll option is invalid", "validation_error");
    await transaction(db, async client => {
      await client.query(
        `delete from public.clan_chat_poll_votes where poll_id = $1 and voter_user_key = $2`,
        [pollId, req.userPrincipal!.userKey]
      );
      for (const optionId of optionIds) {
        await client.query(
          `insert into public.clan_chat_poll_votes(poll_id, option_id, voter_user_key)
           values ($1,$2,$3)`,
          [pollId, optionId, req.userPrincipal!.userKey]
        );
      }
    });
    res.json({ voted: true, optionIds, checkinCreated: false });
  }));

  for (const [action, permission, status] of [
    ["finish", "poll.finish", "finished"],
    ["cancel", "poll.cancel", "cancelled"]
  ] as const) {
    router.post(`/:clanId/polls/:pollId/${action}`, requireClanPermission(db, permission), asyncHandler(async (req, res) => {
      const pollId = uuid(req.params.pollId, "pollId");
      const before = await one<any>(
        db,
        `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
        [pollId, chatId(req)]
      );
      if (!before) throw new ApiError(404, "Poll was not found", "not_found");
      const after = await one<any>(
        db,
        `update public.clan_chat_polls set status = $1 where id = $2 returning *`,
        [status, pollId]
      );
      await writeAudit(db, req, {
        actorType: actorTypeForDecision(req.permissionDecision),
        actorId: req.userPrincipal!.userKey,
        permissionKey: permission,
        action: `poll.${action}`,
        targetType: "poll",
        targetId: pollId,
        clanId: req.params.clanId,
        before,
        after
      });
      res.json({ poll: after });
    }));
  }

  router.delete("/:clanId/polls/:pollId", requireClanPermission(db, "poll.delete"), asyncHandler(async (req, res) => {
    const pollId = uuid(req.params.pollId, "pollId");
    const before = await one<any>(
      db,
      `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
      [pollId, chatId(req)]
    );
    if (!before) throw new ApiError(404, "Poll was not found", "not_found");
    await db.query(`update public.clan_chat_polls set status = 'deleted' where id = $1`, [pollId]);
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "poll.delete",
      action: "poll.delete",
      targetType: "poll",
      targetId: pollId,
      clanId: req.params.clanId,
      before,
      after: { status: "deleted" }
    });
    res.status(204).end();
  }));

  router.post("/:clanId/events", requireClanPermission(db, "event.attach"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "event.attach", requestSubject(req, req.params.clanId));
    const eventId = identifier(req.body?.eventId, "eventId");
    const event = await one<any>(
      db,
      `select id, title, event_date, event_time, active from public.events
        where id = $1 and active = true`,
      [eventId]
    );
    if (!event) throw new ApiError(404, "Official event was not found", "not_found");
    const attachment = await one<any>(
      db,
      `insert into public.clan_chat_events(chat_id, event_id, attached_by_user_key)
       values ($1,$2,$3)
       on conflict (chat_id, event_id) do update set updated_at = now()
       returning *`,
      [chatId(req), eventId, req.userPrincipal!.userKey]
    );
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "event.attach",
      action: "event.attach",
      targetType: "event_attachment",
      targetId: attachment!.id,
      clanId: req.params.clanId,
      after: event
    });
    res.status(201).json({ attachment: { ...attachment, event } });
  }));

  router.delete("/:clanId/events/:attachmentId", requireClanPermission(db, "event.detach"), asyncHandler(async (req, res) => {
    const attachmentId = uuid(req.params.attachmentId, "attachmentId");
    const before = await one<any>(
      db,
      `select * from public.clan_chat_events where id = $1 and chat_id = $2`,
      [attachmentId, chatId(req)]
    );
    if (!before) throw new ApiError(404, "Event attachment was not found", "not_found");
    await db.query(`delete from public.clan_chat_events where id = $1`, [attachmentId]);
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "event.detach",
      action: "event.detach",
      targetType: "event_attachment",
      targetId: attachmentId,
      clanId: req.params.clanId,
      before
    });
    res.status(204).end();
  }));

  router.post("/:clanId/events/:attachmentId/primary", requireClanPermission(db, "event.set_primary"), asyncHandler(async (req, res) => {
    const attachmentId = uuid(req.params.attachmentId, "attachmentId");
    const updated = await transaction(db, async client => {
      await client.query(`update public.clan_chat_events set is_primary = false where chat_id = $1`, [chatId(req)]);
      return one<any>(
        client,
        `update public.clan_chat_events set is_primary = true
          where id = $1 and chat_id = $2 returning *`,
        [attachmentId, chatId(req)]
      );
    });
    if (!updated) throw new ApiError(404, "Event attachment was not found", "not_found");
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "event.set_primary",
      action: "event.set_primary",
      targetType: "event_attachment",
      targetId: attachmentId,
      clanId: req.params.clanId,
      after: { isPrimary: true }
    });
    res.json({ attachment: updated });
  }));

  router.post("/:clanId/polls/:pollId/event", requireClanPermission(db, "event.link_poll"), asyncHandler(async (req, res) => {
    const pollId = uuid(req.params.pollId, "pollId");
    const attachmentId = uuid(req.body?.attachmentId, "attachmentId");
    const linked = await one<any>(
      db,
      `update public.clan_chat_polls p set linked_event_attachment_id = $1
        where p.id = $2 and p.chat_id = $3
          and exists (
            select 1 from public.clan_chat_events e
             where e.id = $1 and e.chat_id = p.chat_id
          )
        returning *`,
      [attachmentId, pollId, chatId(req)]
    );
    if (!linked) throw new ApiError(404, "Poll or event attachment was not found", "not_found");
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "event.link_poll",
      action: "event.link_poll",
      targetType: "poll",
      targetId: pollId,
      clanId: req.params.clanId,
      after: { attachmentId }
    });
    res.json({ poll: linked });
  }));

  router.post("/:clanId/announcements", requireClanPermission(db, "announcement.create"), asyncHandler(async (req, res) => {
    const title = optionalText(req.body?.title, 200);
    const body = requiredText(req.body?.body, "body", 4000);
    const result = await transaction(db, async client => {
      const announcement = await one<any>(
        client,
        `insert into public.clan_chat_announcements(
           chat_id, author_user_key, title, body, official
         ) values ($1,$2,$3,$4,false) returning *`,
        [chatId(req), req.userPrincipal!.userKey, title, body]
      );
      await client.query(
        `insert into public.clan_chat_messages(
           chat_id, author_user_key, body, message_type
         ) values ($1,$2,$3,'announcement')`,
        [chatId(req), req.userPrincipal!.userKey, title ? `${title}\n${body}` : body]
      );
      return announcement!;
    });
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "announcement.create",
      action: "announcement.create",
      targetType: "announcement",
      targetId: result.id,
      clanId: req.params.clanId,
      after: { title, body }
    });
    res.status(201).json({ announcement: result });
  }));

  router.post("/:clanId/pins", asyncHandler(async (req, res) => {
    const type = requiredText(req.body?.targetType, "targetType", 30);
    const targetId = uuid(req.body?.targetId, "targetId");
    const permission = type === "message" ? "message.pin" : type === "poll" ? "poll.pin" : type === "event" ? "event.pin" : "announcement.create";
    const decision = await decidePermission(db, req.userPrincipal!, req.params.clanId, permission);
    req.permissionDecision = decision;
    if (!decision.allowed) throw new ApiError(403, "Pin is not permitted", "permission_denied");
    await ensureTargetInChat(db, type, targetId, String(decision.chat!.chat_id));
    const pin = await one<any>(
      db,
      `insert into public.clan_chat_pins(chat_id, target_type, target_id, pinned_by_user_key)
       values ($1,$2,$3,$4)
       on conflict (chat_id, target_type, target_id) do update set
         pinned_by_user_key = excluded.pinned_by_user_key
       returning *`,
      [decision.chat!.chat_id, type, targetId, req.userPrincipal!.userKey]
    );
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(decision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: permission,
      action: "pin.create",
      targetType: type,
      targetId,
      clanId: req.params.clanId,
      after: pin
    });
    res.status(201).json({ pin });
  }));

  router.delete("/:clanId/pins/:pinId", asyncHandler(async (req, res) => {
    const pinId = uuid(req.params.pinId, "pinId");
    const pin = await one<any>(
      db,
      `select p.*, ch.clan_id from public.clan_chat_pins p
       join public.clan_chats ch on ch.id = p.chat_id
       where p.id = $1 and ch.clan_id = $2`,
      [pinId, req.params.clanId]
    );
    if (!pin) throw new ApiError(404, "Pin was not found", "not_found");
    const permission = pin.target_type === "message" ? "message.pin" : pin.target_type === "poll" ? "poll.pin" : pin.target_type === "event" ? "event.pin" : "announcement.create";
    const decision = await decidePermission(db, req.userPrincipal!, req.params.clanId, permission);
    if (!decision.allowed) throw new ApiError(403, "Pin removal is not permitted", "permission_denied");
    await db.query(`delete from public.clan_chat_pins where id = $1`, [pinId]);
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(decision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: permission,
      action: "pin.delete",
      targetType: pin.target_type,
      targetId: pin.target_id,
      clanId: req.params.clanId,
      before: pin
    });
    res.status(204).end();
  }));

  router.post("/:clanId/restrictions", requireClanPermission(db, "member.restrict_chat"), asyncHandler(async (req, res) => {
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const expiresAt = isoDateOrNull(req.body?.expiresAt);
    const member = await one<any>(
      db,
      `select id from public.clan_memberships
        where clan_id = $1 and user_key = $2 and status = 'active'`,
      [req.params.clanId, userKey]
    );
    if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
    const restriction = await one<any>(
      db,
      `insert into public.clan_chat_restrictions(
         chat_id, user_key, can_write, reason, expires_at, created_by_type, created_by_id
       ) values ($1,$2,false,$3,$4,$5,$6)
       on conflict (chat_id, user_key) where revoked_at is null
       do update set reason = excluded.reason, expires_at = excluded.expires_at,
         updated_at = now()
       returning *`,
      [
        chatId(req),
        userKey,
        reason,
        expiresAt,
        actorTypeForDecision(req.permissionDecision),
        req.userPrincipal!.userKey
      ]
    );
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "member.restrict_chat",
      action: "member.restrict_chat",
      targetType: "member",
      targetId: userKey,
      clanId: req.params.clanId,
      reason,
      after: restriction
    });
    res.status(201).json({ restriction });
  }));

  router.delete("/:clanId/restrictions/:userKey", requireClanPermission(db, "member.unrestrict_chat"), asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const before = await one<any>(
      db,
      `update public.clan_chat_restrictions
          set revoked_at = now(), updated_at = now()
        where chat_id = $1 and user_key = $2 and revoked_at is null
        returning *`,
      [chatId(req), userKey]
    );
    if (!before) throw new ApiError(404, "Active restriction was not found", "not_found");
    await writeAudit(db, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal!.userKey,
      permissionKey: "member.unrestrict_chat",
      action: "member.unrestrict_chat",
      targetType: "member",
      targetId: userKey,
      clanId: req.params.clanId,
      before
    });
    res.status(204).end();
  }));

  router.put("/:clanId/notifications", requireClanPermission(db, "chat.read"), asyncHandler(async (req, res) => {
    const mutedUntil = isoDateOrNull(req.body?.mutedUntil);
    const preference = await one<any>(
      db,
      `insert into public.clan_chat_notification_preferences(
         chat_id, user_key, muted_until, announcements_only
       ) values ($1,$2,$3,$4)
       on conflict (chat_id, user_key) do update set
         muted_until = excluded.muted_until,
         announcements_only = excluded.announcements_only,
         updated_at = now()
       returning *`,
      [chatId(req), req.userPrincipal!.userKey, mutedUntil, booleanValue(req.body?.announcementsOnly)]
    );
    res.json({ preference });
  }));

  router.get("/:clanId/audit", requireClanPermission(db, "audit.read"), asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const rows = await many<any>(
      db,
      `select * from public.clan_chat_audit_log
        where clan_id = $1 and actor_id = $2
        order by created_at desc limit $3`,
      [req.params.clanId, req.userPrincipal!.userKey, limit]
    );
    res.json({ audit: rows });
  }));

  return router;
}
