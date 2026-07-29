import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { writeAudit } from "../audit.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  identifier,
  isoDateOrNull,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";

function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.adminPrincipal || !roles.includes(req.adminPrincipal.role)) {
      return next(new ApiError(403, "Administrator role does not permit this action", "admin_permission_denied"));
    }
    next();
  };
}

async function clanChat(db: Queryable, clanId: string): Promise<any> {
  const row = await one<any>(
    db,
    `select c.id as clan_id, c.name as clan_name, c.clan_type, c.status as clan_status,
            c.leader_user_key, ch.*
       from public.clans c
       join public.clan_chats ch on ch.clan_id = c.id
      where c.id = $1`,
    [clanId]
  );
  if (!row) throw new ApiError(404, "Clan chat was not found", "not_found");
  return row;
}

async function adminAudit(
  db: Queryable,
  req: Request,
  input: Omit<Parameters<typeof writeAudit>[2], "actorType" | "actorId">
) {
  return writeAudit(db, req, {
    actorType: "admin",
    actorId: req.adminPrincipal!.adminId,
    ...input
  });
}

function csv(value: unknown): string {
  const text = value === null || value === undefined
    ? ""
    : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function createAdminRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/permissions", asyncHandler(async (_req, res) => {
    const permissions = await many<any>(
      db,
      `select * from public.clan_chat_permissions order by permission_key`
    );
    res.json({ permissions });
  }));

  router.get("/chats", asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const rows = await many<any>(
      db,
      `select c.id as clan_id, c.name, c.clan_type, c.status,
              c.leader_user_key, leader.name as leader_name,
              ch.id as chat_id, ch.enabled, ch.read_only,
              coalesce(members.member_count, 0)::integer as member_count,
              coalesce(messages.message_count, 0)::integer as message_count,
              messages.last_message_at,
              coalesce(polls.active_poll_count, 0)::integer as active_poll_count,
              coalesce(events.attached_event_count, 0)::integer as attached_event_count,
              coalesce(reports.open_report_count, 0)::integer as open_report_count
         from public.clans c
         join public.clan_chats ch on ch.clan_id = c.id
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select chat_id, count(*) as message_count, max(created_at) as last_message_at
             from public.clan_chat_messages
            group by chat_id
         ) messages on messages.chat_id = ch.id
         left join (
           select chat_id, count(*) as active_poll_count
             from public.clan_chat_polls
            where status = 'active'
            group by chat_id
         ) polls on polls.chat_id = ch.id
         left join (
           select chat_id, count(*) as attached_event_count
             from public.clan_chat_events
            group by chat_id
         ) events on events.chat_id = ch.id
         left join (
           select chat_id, count(*) as open_report_count
             from public.clan_chat_reports
            where status = 'new'
            group by chat_id
         ) reports on reports.chat_id = ch.id
        where ($1 = '' or lower(c.name) like '%' || lower($1) || '%')
        order by c.name`,
      [search]
    );
    res.json({ chats: rows });
  }));

  router.get("/clans/:clanId/chat", asyncHandler(async (req, res) => {
    const chat = await clanChat(db, req.params.clanId);
    const limit = boundedInteger(req.query.limit, 100, 1, 200);
    const [members, messages, polls, events, grants, restrictions, reports] = await Promise.all([
      many<any>(
        db,
        `select m.*, u.name, u.username, u.account_status
           from public.clan_memberships m
           join public.app_users u on u.user_key = m.user_key
          where m.clan_id = $1 order by m.status, m.joined_at`,
        [req.params.clanId]
      ),
      many<any>(
        db,
        `select msg.*, u.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users u on u.user_key = msg.author_user_key
          where msg.chat_id = $1
          order by msg.created_at desc limit $2`,
        [chat.id, limit]
      ),
      many<any>(
        db,
        `select p.*, u.name as creator_name
           from public.clan_chat_polls p
           left join public.app_users u on u.user_key = p.created_by_user_key
          where p.chat_id = $1 order by p.created_at desc`,
        [chat.id]
      ),
      many<any>(
        db,
        `select ce.*, e.title, e.event_date, e.event_time
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1 order by ce.is_primary desc, e.event_date`,
        [chat.id]
      ),
      many<any>(
        db,
        `select g.*, u.name as user_name, a.email as granted_by_email
           from public.clan_chat_permission_grants g
           join public.app_users u on u.user_key = g.user_key
           left join public.admin_users a on a.id = g.granted_by_admin_id
          where g.clan_id = $1 order by g.created_at desc`,
        [req.params.clanId]
      ),
      many<any>(
        db,
        `select r.*, u.name as user_name
           from public.clan_chat_restrictions r
           join public.app_users u on u.user_key = r.user_key
          where r.chat_id = $1 order by r.created_at desc`,
        [chat.id]
      ),
      many<any>(
        db,
        `select r.*, reporter.name as reporter_name, author.name as message_author_name
           from public.clan_chat_reports r
           join public.app_users reporter on reporter.user_key = r.reporter_user_key
           join public.clan_chat_messages msg on msg.id = r.message_id
           left join public.app_users author on author.user_key = msg.author_user_key
          where r.chat_id = $1 order by r.created_at desc`,
        [chat.id]
      )
    ]);
    res.json({ chat, members, messages, polls, events, grants, restrictions, reports });
  }));

  router.get(
    "/clans/:clanId/messages",
    requireRole("admin", "superadmin", "moderator", "auditor"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const search = String(req.query.search || "").trim().slice(0, 500);
      const limit = boundedInteger(req.query.limit, 100, 1, 500);
      const messages = await many<any>(
        db,
        `select msg.*, author.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users author on author.user_key = msg.author_user_key
          where msg.chat_id = $1
            and ($2 = '' or lower(msg.body) like '%' || lower($2) || '%')
          order by msg.created_at desc
          limit $3`,
        [chat.id, search, limit]
      );
      res.json({ messages });
    })
  );

  router.patch(
    "/clans/:clanId/chat",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const before = await clanChat(db, req.params.clanId);
      const enabled = req.body?.enabled === undefined ? before.enabled : booleanValue(req.body.enabled);
      const readOnly = req.body?.readOnly === undefined ? before.read_only : booleanValue(req.body.readOnly);
      const ownDeleteWindowSeconds = boundedInteger(
        req.body?.ownDeleteWindowSeconds,
        Number(before.own_delete_window_seconds),
        0,
        86400
      );
      let storedSettings = before.settings;
      if (typeof storedSettings === "string") {
        try {
          storedSettings = JSON.parse(storedSettings);
        } catch {
          storedSettings = {};
        }
      }
      const settings = req.body?.settings === undefined ? storedSettings : req.body.settings;
      if (!settings || Array.isArray(settings) || typeof settings !== "object") {
        throw new ApiError(400, "settings must be an object", "validation_error");
      }
      const after = await one<any>(
        db,
        `update public.clan_chats
            set enabled = $1, read_only = $2, own_delete_window_seconds = $3,
                settings = $4::jsonb
          where clan_id = $5 returning *`,
        [enabled, readOnly, ownDeleteWindowSeconds, JSON.stringify(settings), req.params.clanId]
      );
      await adminAudit(db, req, {
        permissionKey: "chat.settings.update",
        action: "chat.settings.update",
        targetType: "chat",
        targetId: after!.id,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 1000),
        before,
        after
      });
      res.json({ chat: after });
    })
  );

  router.delete(
    "/clans/:clanId/messages/:messageId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const messageId = uuid(req.params.messageId, "messageId");
      const before = await one<any>(
        db,
        `select * from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [messageId, chat.id]
      );
      if (!before) throw new ApiError(404, "Message was not found", "not_found");
      if (!before.deleted_at) {
        await db.query(
          `update public.clan_chat_messages
              set body = 'Сообщение удалено администратором BALI',
                  deleted_at = now(), deleted_by_type = 'admin',
                  deleted_by_id = $1, deletion_reason = $2
            where id = $3`,
          [
            req.adminPrincipal!.adminId,
            optionalText(req.body?.reason, 500),
            messageId
          ]
        );
      }
      await adminAudit(db, req, {
        permissionKey: "message.delete_any",
        action: "message.delete",
        targetType: "message",
        targetId: messageId,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 500),
        before,
        after: { deleted: true }
      });
      res.status(204).end();
    })
  );

  router.post(
    "/clans/:clanId/grants",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      await clanChat(db, req.params.clanId);
      const userKey = identifier(req.body?.userKey, "userKey");
      const permissionKey = requiredText(req.body?.permissionKey, "permissionKey", 100);
      const effect = req.body?.effect === "deny" ? "deny" : "allow";
      const expiresAt = isoDateOrNull(req.body?.expiresAt);
      const reason = requiredText(req.body?.reason, "reason", 1000);
      const [member, permission] = await Promise.all([
        one<any>(
          db,
          `select id from public.clan_memberships
            where clan_id = $1 and user_key = $2 and status = 'active'`,
          [req.params.clanId, userKey]
        ),
        one<any>(
          db,
          `select permission_key from public.clan_chat_permissions where permission_key = $1`,
          [permissionKey]
        )
      ]);
      if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
      if (!permission) throw new ApiError(400, "Unknown permission", "validation_error");
      const grant = await one<any>(
        db,
        `insert into public.clan_chat_permission_grants(
           clan_id, user_key, permission_key, effect, reason,
           granted_by_admin_id, expires_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,
        [
          req.params.clanId,
          userKey,
          permissionKey,
          effect,
          reason,
          req.adminPrincipal!.adminId,
          expiresAt
        ]
      );
      await adminAudit(db, req, {
        permissionKey,
        action: effect === "deny" ? "permission.deny" : "permission.grant",
        targetType: "permission_grant",
        targetId: grant!.id,
        clanId: req.params.clanId,
        reason,
        after: grant
      });
      res.status(201).json({ grant });
    })
  );

  router.delete(
    "/clans/:clanId/grants/:grantId",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const grantId = uuid(req.params.grantId, "grantId");
      const grant = await one<any>(
        db,
        `update public.clan_chat_permission_grants
            set revoked_at = now(), updated_at = now()
          where id = $1 and clan_id = $2 and revoked_at is null
          returning *`,
        [grantId, req.params.clanId]
      );
      if (!grant) throw new ApiError(404, "Active permission grant was not found", "not_found");
      await adminAudit(db, req, {
        permissionKey: grant.permission_key,
        action: "permission.revoke",
        targetType: "permission_grant",
        targetId: grantId,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 1000),
        before: grant,
        after: { revoked: true }
      });
      res.status(204).end();
    })
  );

  router.put(
    "/clans/:clanId/leader",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const userKey = identifier(req.body?.userKey, "userKey");
      const reason = requiredText(req.body?.reason, "reason", 1000);
      const before = await clanChat(db, req.params.clanId);
      const member = await one<any>(
        db,
        `select * from public.clan_memberships
          where clan_id = $1 and user_key = $2 and status = 'active'`,
        [req.params.clanId, userKey]
      );
      if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
      await transaction(db, async client => {
        await client.query(
          `update public.clan_memberships set role = 'member'
            where clan_id = $1 and role = 'leader'`,
          [req.params.clanId]
        );
        await client.query(
          `update public.clan_memberships set role = 'leader'
            where clan_id = $1 and user_key = $2`,
          [req.params.clanId, userKey]
        );
        await client.query(
          `update public.clans set leader_user_key = $1 where id = $2`,
          [userKey, req.params.clanId]
        );
      });
      await adminAudit(db, req, {
        permissionKey: "chat.settings.update",
        action: "clan.leader.transfer",
        targetType: "clan",
        targetId: req.params.clanId,
        clanId: req.params.clanId,
        reason,
        before: { leaderUserKey: before.leader_user_key },
        after: { leaderUserKey: userKey }
      });
      res.json({ leaderUserKey: userKey });
    })
  );

  router.post(
    "/clans/:clanId/restrictions",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
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
         ) values ($1,$2,false,$3,$4,'admin',$5)
         on conflict (chat_id, user_key) where revoked_at is null
         do update set reason = excluded.reason, expires_at = excluded.expires_at,
           updated_at = now()
         returning *`,
        [chat.id, userKey, reason, expiresAt, req.adminPrincipal!.adminId]
      );
      await adminAudit(db, req, {
        permissionKey: "member.restrict_chat",
        action: "member.restrict_chat",
        targetType: "member",
        targetId: userKey,
        clanId: req.params.clanId,
        reason,
        after: restriction
      });
      res.status(201).json({ restriction });
    })
  );

  router.delete(
    "/clans/:clanId/restrictions/:userKey",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const userKey = identifier(req.params.userKey, "userKey");
      const before = await one<any>(
        db,
        `update public.clan_chat_restrictions
            set revoked_at = now(), updated_at = now()
          where chat_id = $1 and user_key = $2 and revoked_at is null
          returning *`,
        [chat.id, userKey]
      );
      if (!before) throw new ApiError(404, "Active restriction was not found", "not_found");
      await adminAudit(db, req, {
        permissionKey: "member.unrestrict_chat",
        action: "member.unrestrict_chat",
        targetType: "member",
        targetId: userKey,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );

  router.post(
    "/clans/:clanId/announcements",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const title = optionalText(req.body?.title, 200);
      const body = requiredText(req.body?.body, "body", 4000);
      const announcement = await transaction(db, async client => {
        const row = await one<any>(
          client,
          `insert into public.clan_chat_announcements(
             chat_id, title, body, official
           ) values ($1,$2,$3,true) returning *`,
          [chat.id, title, body]
        );
        await client.query(
          `insert into public.clan_chat_messages(chat_id, body, message_type)
           values ($1,$2,'announcement')`,
          [chat.id, title ? `${title}\n${body}` : body]
        );
        return row!;
      });
      await adminAudit(db, req, {
        permissionKey: "announcement.create",
        action: "announcement.create",
        targetType: "announcement",
        targetId: announcement.id,
        clanId: req.params.clanId,
        after: announcement
      });
      res.status(201).json({ announcement });
    })
  );

  router.delete(
    "/clans/:clanId/polls/:pollId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const pollId = uuid(req.params.pollId, "pollId");
      const before = await one<any>(
        db,
        `update public.clan_chat_polls set status = 'deleted'
          where id = $1 and chat_id = $2 returning *`,
        [pollId, chat.id]
      );
      if (!before) throw new ApiError(404, "Poll was not found", "not_found");
      await adminAudit(db, req, {
        permissionKey: "poll.delete",
        action: "poll.delete",
        targetType: "poll",
        targetId: pollId,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );

  router.delete(
    "/clans/:clanId/events/:attachmentId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db, req.params.clanId);
      const attachmentId = uuid(req.params.attachmentId, "attachmentId");
      const before = await one<any>(
        db,
        `delete from public.clan_chat_events
          where id = $1 and chat_id = $2 returning *`,
        [attachmentId, chat.id]
      );
      if (!before) throw new ApiError(404, "Event attachment was not found", "not_found");
      await adminAudit(db, req, {
        permissionKey: "event.detach",
        action: "event.detach",
        targetType: "event_attachment",
        targetId: attachmentId,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );

  router.patch(
    "/reports/:reportId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const reportId = uuid(req.params.reportId, "reportId");
      const status = String(req.body?.status || "");
      if (!["reviewed", "resolved", "dismissed"].includes(status)) {
        throw new ApiError(400, "Invalid report status", "validation_error");
      }
      const before = await one<any>(db, `select * from public.clan_chat_reports where id = $1`, [reportId]);
      if (!before) throw new ApiError(404, "Report was not found", "not_found");
      const after = await one<any>(
        db,
        `update public.clan_chat_reports
            set status = $1, resolution = $2, reviewed_by_admin_id = $3,
                reviewed_at = now()
          where id = $4 returning *`,
        [
          status,
          optionalText(req.body?.resolution, 2000),
          req.adminPrincipal!.adminId,
          reportId
        ]
      );
      const clan = await one<any>(
        db,
        `select clan_id from public.clan_chats where id = $1`,
        [before.chat_id]
      );
      await adminAudit(db, req, {
        permissionKey: "report.review",
        action: "report.review",
        targetType: "report",
        targetId: reportId,
        clanId: clan?.clan_id,
        before,
        after
      });
      res.json({ report: after });
    })
  );

  router.get("/audit", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 100, 1, 1000);
    const clanId = String(req.query.clanId || "");
    const actorId = String(req.query.actorId || "");
    const action = String(req.query.action || "");
    const filters: string[] = [];
    const values: unknown[] = [];
    const addFilter = (column: string, value: string) => {
      if (!value) return;
      values.push(value);
      filters.push(`${column} = $${values.length}`);
    };
    addFilter("clan_id", clanId);
    addFilter("actor_id", actorId);
    addFilter("action", action);
    const rows = await many<any>(
      db,
      `select * from public.clan_chat_audit_log
        ${filters.length ? `where ${filters.join(" and ")}` : ""}
        order by created_at desc limit ${limit}`,
      values
    );
    if (req.query.format === "csv") {
      const headers = [
        "id", "created_at", "actor_type", "actor_id", "actor_telegram_id",
        "actor_user_key", "permission_key", "action", "target_type", "target_id",
        "clan_id", "chat_id", "request_id", "reason", "before_value", "after_value"
      ];
      const body = [
        headers.join(","),
        ...rows.map(row => headers.map(key => csv(row[key])).join(","))
      ].join("\n");
      res.type("text/csv").attachment("bali-clan-audit.csv").send(body);
      return;
    }
    res.json({ audit: rows });
  }));

  router.get("/rate-limits", asyncHandler(async (_req, res) => {
    const settings = await many<any>(
      db,
      `select * from public.rate_limit_settings order by bucket`
    );
    res.json({ settings });
  }));

  router.put(
    "/rate-limits/:bucket",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const bucket = String(req.params.bucket || "");
      if (!/^[a-z][a-z0-9.-]{1,80}$/.test(bucket)) {
        throw new ApiError(400, "Invalid rate-limit bucket", "validation_error");
      }
      const before = await one<any>(
        db,
        `select * from public.rate_limit_settings where bucket = $1`,
        [bucket]
      );
      if (!before) throw new ApiError(404, "Rate-limit setting was not found", "not_found");
      const after = await one<any>(
        db,
        `update public.rate_limit_settings
            set limit_count = $1, window_seconds = $2, enabled = $3,
                updated_by_admin_id = $4
          where bucket = $5 returning *`,
        [
          boundedInteger(req.body?.limitCount, Number(before.limit_count), 1, 100000),
          boundedInteger(req.body?.windowSeconds, Number(before.window_seconds), 1, 86400),
          req.body?.enabled === undefined ? before.enabled : booleanValue(req.body.enabled),
          req.adminPrincipal!.adminId,
          bucket
        ]
      );
      await adminAudit(db, req, {
        action: "rate_limit.update",
        targetType: "rate_limit_setting",
        targetId: bucket,
        before,
        after
      });
      res.json({ setting: after });
    })
  );

  return router;
}
