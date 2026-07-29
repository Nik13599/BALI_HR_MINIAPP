import type { NextFunction, Request, RequestHandler, Response } from "express";
import { one } from "./db.js";
import { ApiError, asyncHandler } from "./errors.js";
import type { PermissionDecision, Queryable, UserPrincipal } from "./types.js";

export const MEMBER_PERMISSIONS = new Set([
  "chat.read",
  "chat.write",
  "chat.reply",
  "message.read",
  "message.create",
  "message.reply",
  "message.delete_own",
  "poll.read",
  "poll.vote",
  "event.read",
  "report.create"
]);

export const LEADER_PERMISSIONS = new Set([
  ...MEMBER_PERMISSIONS,
  "chat.enable",
  "chat.disable",
  "chat.set_read_only",
  "chat.settings.update",
  "message.delete_any",
  "message.pin",
  "poll.create",
  "poll.finish",
  "poll.cancel",
  "poll.delete",
  "poll.pin",
  "event.attach",
  "event.detach",
  "event.set_primary",
  "event.link_poll",
  "event.pin",
  "announcement.create",
  "notification.broadcast",
  "member.restrict_chat",
  "member.unrestrict_chat",
  "audit.read"
]);

const WRITE_PERMISSIONS = new Set([
  "chat.write",
  "chat.reply",
  "message.create",
  "message.reply"
]);

export function isKnownPermission(permission: string): boolean {
  return MEMBER_PERMISSIONS.has(permission) || LEADER_PERMISSIONS.has(permission);
}

export async function decidePermission(
  db: Queryable,
  principal: UserPrincipal,
  clanId: string,
  permission: string
): Promise<PermissionDecision> {
  const context = await one<any>(
    db,
    `select
       m.id as membership_id, m.user_key, m.role, m.status as membership_status,
       c.id as clan_id, c.name as clan_name, c.status as clan_status, c.leader_user_key,
       ch.id as chat_id, ch.enabled, ch.read_only, ch.own_delete_window_seconds, ch.settings
     from public.clan_memberships m
     join public.clans c on c.id = m.clan_id
     join public.clan_chats ch on ch.clan_id = c.id
     where m.clan_id = $1 and m.user_key = $2`,
    [clanId, principal.userKey]
  );
  if (!context || context.membership_status !== "active" || context.clan_status !== "active") {
    return { allowed: false, source: "none" };
  }

  const restriction = await one<any>(
    db,
    `select * from public.clan_chat_restrictions
      where chat_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,
    [context.chat_id, principal.userKey]
  );

  const override = await one<any>(
    db,
    `select effect from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and permission_key = $3
        and revoked_at is null and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,
    [clanId, principal.userKey, permission]
  );

  const base = { membership: context, chat: context, restriction };
  if (override?.effect === "deny") return { ...base, allowed: false, source: "denied" };
  if (!context.enabled && permission !== "chat.read" && permission !== "message.read") {
    return { ...base, allowed: false, source: "denied" };
  }
  if (WRITE_PERMISSIONS.has(permission) && (context.read_only || restriction?.can_write === false)) {
    return { ...base, allowed: false, source: "denied" };
  }

  const isLeader = context.leader_user_key === principal.userKey || context.role === "leader";
  if (isLeader && LEADER_PERMISSIONS.has(permission)) return { ...base, allowed: true, source: "leader" };
  if (override?.effect === "allow") return { ...base, allowed: true, source: "grant" };
  if (MEMBER_PERMISSIONS.has(permission)) return { ...base, allowed: true, source: "member" };
  return { ...base, allowed: false, source: "none" };
}

export function requireClanPermission(db: Queryable, permission: string): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userPrincipal) throw new ApiError(401, "User session is required", "authentication_required");
    const clanId = String(req.params.clanId || "");
    if (!clanId) throw new ApiError(400, "Clan id is required", "validation_error");
    const decision = await decidePermission(db, req.userPrincipal, clanId, permission);
    req.permissionDecision = decision;
    if (!decision.allowed) {
      throw new ApiError(403, "The requested clan action is not permitted", "permission_denied", {
        permission
      });
    }
    next();
  });
}

export function actorTypeForDecision(decision?: PermissionDecision): "user" | "leader" | "delegate" {
  if (decision?.source === "leader") return "leader";
  if (decision?.source === "grant") return "delegate";
  return "user";
}

export async function effectivePermissionKeys(
  db: Queryable,
  principal: UserPrincipal,
  clanId: string
): Promise<string[]> {
  const context = await one<any>(
    db,
    `select m.role, m.status as membership_status, c.status as clan_status,
            c.leader_user_key, ch.enabled, ch.read_only
       from public.clan_memberships m
       join public.clans c on c.id = m.clan_id
       join public.clan_chats ch on ch.clan_id = c.id
      where m.clan_id = $1 and m.user_key = $2`,
    [clanId, principal.userKey]
  );
  if (!context || context.membership_status !== "active" || context.clan_status !== "active") return [];
  const rows = (await db.query<any>(
    `select permission_key, effect
       from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at asc`,
    [clanId, principal.userKey]
  )).rows;
  const keys = new Set(
    context.leader_user_key === principal.userKey || context.role === "leader"
      ? LEADER_PERMISSIONS
      : MEMBER_PERMISSIONS
  );
  for (const row of rows) {
    if (row.effect === "deny") keys.delete(row.permission_key);
    else keys.add(row.permission_key);
  }
  if (!context.enabled) {
    for (const key of [...keys]) if (!["chat.read", "message.read"].includes(key)) keys.delete(key);
  }
  if (context.read_only) {
    for (const key of WRITE_PERMISSIONS) keys.delete(key);
  }
  return [...keys].sort();
}
