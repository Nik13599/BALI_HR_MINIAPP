import type { Request } from "express";
import { one } from "./db.js";
import type { Queryable } from "./types.js";

interface AuditInput {
  actorType: "user" | "leader" | "delegate" | "admin" | "system";
  actorId: string;
  permissionKey?: string;
  action: string;
  targetType: string;
  targetId: string;
  clanId?: string | null;
  chatId?: string | null;
  reason?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(db: Queryable, req: Request, input: AuditInput): Promise<void> {
  let chatId = input.chatId || req.permissionDecision?.chat?.chat_id || null;
  if (!chatId && input.clanId) {
    const chat = await one<{ id: string }>(
      db,
      `select id from public.clan_chats where clan_id = $1`,
      [input.clanId]
    );
    chatId = chat?.id || null;
  }
  const actorUserKey = req.userPrincipal?.userKey
    || (["user", "leader", "delegate"].includes(input.actorType) ? input.actorId : null);
  await db.query(
    `insert into public.clan_chat_audit_log(
       actor_type, actor_id, actor_telegram_id, actor_user_key,
       permission_key, action, target_type, target_id, clan_id, chat_id,
       request_id, reason, before_value, after_value, metadata
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb
     )`,
    [
      input.actorType,
      input.actorId,
      req.userPrincipal?.telegramUserId || null,
      actorUserKey,
      input.permissionKey || "",
      input.action,
      input.targetType,
      input.targetId,
      input.clanId || null,
      chatId,
      req.requestId,
      input.reason || "",
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      JSON.stringify(input.metadata || {})
    ]
  );
}

export function auditActor(req: Request): { actorType: "leader" | "delegate"; actorId: string } {
  return {
    actorType: req.permissionDecision?.source === "leader" ? "leader" : "delegate",
    actorId: req.userPrincipal?.userKey || "unknown"
  };
}
