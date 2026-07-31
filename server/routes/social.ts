import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import type { Queryable } from "../types.js";
import { enumValue, identifier, optionalText, requiredText, uuid } from "../validation.js";

const CONNECTION_RESPONSES = ["accepted", "declined"] as const;

function pair(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

async function blockedBetween(db: Queryable, first: string, second: string): Promise<boolean> {
  return Boolean(await one<any>(
    db,
    `select 1
       from public.user_blocks
      where (blocker_user_key = $1 and blocked_user_key = $2)
         or (blocker_user_key = $2 and blocked_user_key = $1)
      limit 1`,
    [first, second]
  ));
}

async function conversationAccess(db: Queryable, conversationId: string, userKey: string): Promise<any> {
  const row = await one<any>(
    db,
    `select conversation.*, connection.status as connection_status
       from public.direct_conversations conversation
       join public.user_connections connection on connection.id = conversation.connection_id
      where conversation.id = $1
        and $2 in (conversation.pair_low, conversation.pair_high)`,
    [conversationId, userKey]
  );
  if (!row) throw new ApiError(404, "Conversation was not found", "not_found");
  if (row.connection_status !== "accepted" || row.archived_at) {
    throw new ApiError(403, "Conversation is not active", "conversation_unavailable");
  }
  const peerKey = row.pair_low === userKey ? row.pair_high : row.pair_low;
  if (await blockedBetween(db, userKey, peerKey)) {
    throw new ApiError(403, "Conversation is unavailable because one user blocked the other", "user_blocked");
  }
  return { ...row, peerKey };
}

async function notify(
  db: Queryable,
  userKey: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  idempotencyKey: string
): Promise<void> {
  await db.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [userKey, type, title, body, JSON.stringify(data), idempotencyKey]
  );
}

export function createSocialRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/connections", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select connection.*,
              case when connection.requester_user_key = $1
                then recipient.name else requester.name end as peer_name,
              case when connection.requester_user_key = $1
                then recipient.avatar else requester.avatar end as peer_avatar,
              case when connection.requester_user_key = $1
                then connection.recipient_user_key else connection.requester_user_key end as peer_user_key,
              conversation.id as conversation_id
         from public.user_connections connection
         join public.app_users requester on requester.user_key = connection.requester_user_key
         join public.app_users recipient on recipient.user_key = connection.recipient_user_key
         left join public.direct_conversations conversation
           on conversation.connection_id = connection.id
        where $1 in (connection.requester_user_key, connection.recipient_user_key)
          and connection.status in ('pending', 'accepted')
        order by case when connection.status = 'pending' then 0 else 1 end,
                 connection.updated_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ connections: rows });
  }));

  router.post("/connections", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "connection.create", requestSubject(req));
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    const requesterUserKey = req.userPrincipal!.userKey;
    if (recipientUserKey === requesterUserKey) {
      throw new ApiError(400, "A user cannot send a connection request to themselves", "validation_error");
    }
    if (await blockedBetween(db, requesterUserKey, recipientUserKey)) {
      throw new ApiError(403, "Connection request is unavailable because one user blocked the other", "user_blocked");
    }
    const recipient = await one<any>(
      db,
      `select user_row.user_key, user_row.name,
              coalesce(profile.allow_connections, true) as allow_connections
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $1
          and user_row.account_status = 'active'
          and user_row.blocked_at is null`,
      [recipientUserKey]
    );
    if (!recipient) throw new ApiError(404, "Recipient was not found", "not_found");
    if (!recipient.allow_connections) {
      throw new ApiError(403, "Recipient disabled connection requests", "connections_disabled");
    }
    const sentToday = await one<any>(
      db,
      `select count(*)::integer as count
         from public.user_connections
        where requester_user_key = $1
          and created_at > now() - interval '24 hours'`,
      [requesterUserKey]
    );
    if (Number(sentToday?.count || 0) >= 10) {
      throw new ApiError(429, "Daily connection request limit has been reached", "connection_daily_limit", {
        retryAfter: 3600
      });
    }
    const [pairLow, pairHigh] = pair(requesterUserKey, recipientUserKey);
    const connection = await transaction(db, async client => {
      const existing = await one<any>(
        client,
        `select * from public.user_connections
          where pair_low = $1 and pair_high = $2
          for update`,
        [pairLow, pairHigh]
      );
      if (existing) {
        if (existing.status === "accepted") {
          throw new ApiError(409, "Users are already connected", "connection_already_exists");
        }
        if (existing.status === "pending") {
          throw new ApiError(409, "A connection request is already pending", "connection_already_pending");
        }
        if (existing.cooldown_until && new Date(existing.cooldown_until).getTime() > Date.now()) {
          throw new ApiError(409, "A new request is temporarily unavailable after rejection", "connection_cooldown", {
            cooldownUntil: existing.cooldown_until
          });
        }
        const reopened = await one<any>(
          client,
          `update public.user_connections
              set requester_user_key = $2,
                  recipient_user_key = $3,
                  status = 'pending',
                  request_message = $4,
                  cooldown_until = null,
                  responded_at = null,
                  created_at = now(),
                  updated_at = now()
            where id = $1
            returning *`,
          [existing.id, requesterUserKey, recipientUserKey, message]
        );
        return reopened;
      }
      return one<any>(
        client,
        `insert into public.user_connections(
           requester_user_key, recipient_user_key, pair_low, pair_high, request_message
         ) values ($1,$2,$3,$4,$5)
         returning *`,
        [requesterUserKey, recipientUserKey, pairLow, pairHigh, message]
      );
    });
    await notify(
      db,
      recipientUserKey,
      "connection_request",
      "Новая заявка на знакомство",
      `${req.userPrincipal!.name} хочет познакомиться.`,
      { connectionId: connection!.id, requesterUserKey },
      `connection-request:${connection!.id}:${connection!.created_at}`
    );
    res.status(201).json({ connection });
  }));

  router.patch("/connections/:connectionId", asyncHandler(async (req, res) => {
    const connectionId = uuid(req.params.connectionId, "connectionId");
    const status = enumValue(req.body?.status, "status", CONNECTION_RESPONSES);
    const result = await transaction(db, async client => {
      const connection = await one<any>(
        client,
        `select * from public.user_connections
          where id = $1 and recipient_user_key = $2
          for update`,
        [connectionId, req.userPrincipal!.userKey]
      );
      if (!connection) throw new ApiError(404, "Connection request was not found", "not_found");
      if (connection.status !== "pending") {
        throw new ApiError(409, "Connection request has already been answered", "connection_already_answered");
      }
      if (await blockedBetween(client, connection.requester_user_key, connection.recipient_user_key)) {
        throw new ApiError(403, "Connection is unavailable because one user blocked the other", "user_blocked");
      }
      const updated = await one<any>(
        client,
        `update public.user_connections
            set status = $2,
                responded_at = now(),
                cooldown_until = case when $2 = 'declined' then now() + interval '30 days' else null end,
                updated_at = now()
          where id = $1
          returning *`,
        [connectionId, status]
      );
      let conversation = null;
      if (status === "accepted") {
        conversation = await one<any>(
          client,
          `insert into public.direct_conversations(pair_low, pair_high, connection_id)
           values ($1,$2,$3)
           on conflict (pair_low, pair_high) do update
             set connection_id = excluded.connection_id,
                 archived_at = null,
                 updated_at = now()
           returning *`,
          [connection.pair_low, connection.pair_high, connection.id]
        );
      }
      await notify(
        client,
        connection.requester_user_key,
        status === "accepted" ? "connection_accepted" : "connection_declined",
        status === "accepted" ? "Знакомство принято" : "Заявка отклонена",
        status === "accepted"
          ? `${req.userPrincipal!.name} принял вашу заявку. Теперь доступен личный чат.`
          : `${req.userPrincipal!.name} отклонил вашу заявку.`,
        { connectionId, conversationId: conversation?.id || null, status },
        `connection-response:${connectionId}`
      );
      return { connection: updated, conversation };
    });
    res.json(result);
  }));

  router.delete("/connections/:connectionId", asyncHandler(async (req, res) => {
    const connectionId = uuid(req.params.connectionId, "connectionId");
    const updated = await one<any>(
      db,
      `update public.user_connections
          set status = 'removed', updated_at = now()
        where id = $1
          and $2 in (requester_user_key, recipient_user_key)
          and status = 'accepted'
        returning *`,
      [connectionId, req.userPrincipal!.userKey]
    );
    if (!updated) throw new ApiError(404, "Active connection was not found", "not_found");
    await db.query(
      `update public.direct_conversations
          set archived_at = now(), updated_at = now()
        where connection_id = $1`,
      [connectionId]
    );
    res.status(204).end();
  }));

  router.get("/conversations", asyncHandler(async (req, res) => {
    const rows = await many<any>(
      db,
      `select conversation.*,
              case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end as peer_user_key,
              peer.name as peer_name,
              peer.avatar as peer_avatar,
              latest.body as last_message,
              latest.created_at as last_message_at,
              coalesce(unread.unread_count, 0)::integer as unread_count
         from public.direct_conversations conversation
         join public.user_connections connection
           on connection.id = conversation.connection_id and connection.status = 'accepted'
         join public.app_users peer
           on peer.user_key = case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end
         left join lateral (
           select message.body, message.created_at
             from public.direct_messages message
            where message.conversation_id = conversation.id and message.deleted_at is null
            order by message.created_at desc
            limit 1
         ) latest on true
         left join lateral (
           select count(*) as unread_count
             from public.direct_messages message
             left join public.direct_message_read_states read_state
               on read_state.conversation_id = conversation.id and read_state.user_key = $1
            where message.conversation_id = conversation.id
              and message.sender_user_key <> $1
              and message.deleted_at is null
              and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
         ) unread on true
        where $1 in (conversation.pair_low, conversation.pair_high)
          and conversation.archived_at is null
          and not exists (
            select 1 from public.user_blocks block
             where (block.blocker_user_key = conversation.pair_low and block.blocked_user_key = conversation.pair_high)
                or (block.blocker_user_key = conversation.pair_high and block.blocked_user_key = conversation.pair_low)
          )
        order by latest.created_at desc nulls last, conversation.updated_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ conversations: rows });
  }));

  router.get("/conversations/:conversationId/messages", asyncHandler(async (req, res) => {
    const conversationId = uuid(req.params.conversationId, "conversationId");
    await conversationAccess(db, conversationId, req.userPrincipal!.userKey);
    const rows = await many<any>(
      db,
      `select message.*, author.name as author_name, author.avatar as author_avatar
         from public.direct_messages message
         left join public.app_users author on author.user_key = message.sender_user_key
        where message.conversation_id = $1
        order by message.created_at asc
        limit 200`,
      [conversationId]
    );
    await db.query(
      `insert into public.direct_message_read_states(conversation_id, user_key, last_read_at)
       values ($1,$2,now())
       on conflict (conversation_id, user_key) do update
         set last_read_at = excluded.last_read_at`,
      [conversationId, req.userPrincipal!.userKey]
    );
    res.json({ messages: rows });
  }));

  router.post("/conversations/:conversationId/messages", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "direct_message.create", requestSubject(req));
    const conversationId = uuid(req.params.conversationId, "conversationId");
    const body = requiredText(req.body?.body, "body", 4000);
    const replyToMessageId = req.body?.replyToMessageId
      ? uuid(req.body.replyToMessageId, "replyToMessageId")
      : null;
    const conversation = await conversationAccess(db, conversationId, req.userPrincipal!.userKey);
    if (replyToMessageId) {
      const reply = await one<any>(
        db,
        `select id from public.direct_messages
          where id = $1 and conversation_id = $2`,
        [replyToMessageId, conversationId]
      );
      if (!reply) throw new ApiError(404, "Reply message was not found", "not_found");
    }
    const message = await one<any>(
      db,
      `insert into public.direct_messages(
         conversation_id, sender_user_key, body, reply_to_message_id
       ) values ($1,$2,$3,$4)
       returning *`,
      [conversationId, req.userPrincipal!.userKey, body, replyToMessageId]
    );
    await db.query(
      `update public.direct_conversations set updated_at = now() where id = $1`,
      [conversationId]
    );
    await notify(
      db,
      conversation.peerKey,
      "direct_message",
      `Сообщение от ${req.userPrincipal!.name}`,
      body.slice(0, 300),
      { conversationId, messageId: message!.id },
      `direct-message:${message!.id}`
    );
    res.status(201).json({ message });
  }));

  router.post("/blocks", asyncHandler(async (req, res) => {
    const blockedUserKey = identifier(req.body?.blockedUserKey, "blockedUserKey");
    const reason = optionalText(req.body?.reason, 1000);
    if (blockedUserKey === req.userPrincipal!.userKey) {
      throw new ApiError(400, "A user cannot block themselves", "validation_error");
    }
    const target = await one<any>(
      db,
      `select user_key from public.app_users where user_key = $1`,
      [blockedUserKey]
    );
    if (!target) throw new ApiError(404, "User was not found", "not_found");
    const [pairLow, pairHigh] = pair(req.userPrincipal!.userKey, blockedUserKey);
    const result = await transaction(db, async client => {
      const block = await one<any>(
        client,
        `insert into public.user_blocks(blocker_user_key, blocked_user_key, reason)
         values ($1,$2,$3)
         on conflict (blocker_user_key, blocked_user_key) do update
           set reason = excluded.reason
         returning *`,
        [req.userPrincipal!.userKey, blockedUserKey, reason]
      );
      await client.query(
        `update public.user_connections
            set status = 'blocked', updated_at = now()
          where pair_low = $1 and pair_high = $2`,
        [pairLow, pairHigh]
      );
      await client.query(
        `update public.direct_conversations
            set archived_at = now(), updated_at = now()
          where pair_low = $1 and pair_high = $2`,
        [pairLow, pairHigh]
      );
      return block;
    });
    res.status(201).json({ block: result });
  }));

  router.delete("/blocks/:blockedUserKey", asyncHandler(async (req, res) => {
    const blockedUserKey = identifier(req.params.blockedUserKey, "blockedUserKey");
    const result = await db.query(
      `delete from public.user_blocks
        where blocker_user_key = $1 and blocked_user_key = $2`,
      [req.userPrincipal!.userKey, blockedUserKey]
    );
    if (!result.rowCount) throw new ApiError(404, "Block was not found", "not_found");
    res.status(204).end();
  }));

  router.post("/reports", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "user_report.create", requestSubject(req));
    const reportedUserKey = identifier(req.body?.reportedUserKey, "reportedUserKey");
    const reasonCode = requiredText(req.body?.reasonCode, "reasonCode", 100);
    const details = optionalText(req.body?.details, 2000);
    const conversationId = req.body?.conversationId
      ? uuid(req.body.conversationId, "conversationId")
      : null;
    const messageId = req.body?.messageId
      ? uuid(req.body.messageId, "messageId")
      : null;
    if (reportedUserKey === req.userPrincipal!.userKey) {
      throw new ApiError(400, "A user cannot report themselves", "validation_error");
    }
    if (conversationId) {
      await conversationAccess(db, conversationId, req.userPrincipal!.userKey);
    }
    const report = await transaction(db, async client => {
      const created = await one<any>(
        client,
        `insert into public.user_reports(
           reporter_user_key, reported_user_key, conversation_id, message_id,
           reason_code, details
         ) values ($1,$2,$3,$4,$5,$6)
         returning *`,
        [
          req.userPrincipal!.userKey,
          reportedUserKey,
          conversationId,
          messageId,
          reasonCode,
          details
        ]
      );
      await client.query(
        `insert into public.moderation_cases(
           case_type, source_type, source_id, reported_user_key, priority
         ) values ('user_report','user_report',$1,$2,'normal')`,
        [created!.id, reportedUserKey]
      );
      return created;
    });
    res.status(201).json({ report });
  }));

  return router;
}
