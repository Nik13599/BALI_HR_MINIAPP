import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { hashPassword } from "../security.js";
import type { Queryable } from "../types.js";
import { enumValue, requiredText, uuid } from "../validation.js";

function temporaryPassword(): string {
  return `Bali-${randomBytes(7).toString("base64url")}9!`;
}

function telegramUrl(username: string): string {
  return `https://t.me/${String(username || "").replace(/^@+/, "")}`;
}

async function createMobileUser(client: Queryable, request: any, passwordHash: string) {
  const userKey = `mobile:${randomUUID()}`;
  const displayName = String(request.display_name || "Пользователь BALI").trim();
  const parts = displayName.split(/\s+/);
  const firstName = parts.shift() || displayName;
  const lastName = parts.join(" ");

  await client.query(
    `insert into public.app_users(
       user_key, name, username, phone, first_seen_at, last_seen_at, opens, account_status, updated_at
     ) values ($1,$2,$3,$4,now(),now(),1,'active',now())`,
    [userKey, displayName, request.telegram_username, request.phone]
  );
  await client.query(
    `insert into public.mobile_credentials(
       app_user_key, phone, telegram_username, password_hash, must_change_password, password_issued_at
     ) values ($1,$2,$3,$4,true,now())`,
    [userKey, request.phone, request.telegram_username, passwordHash]
  );
  await client.query(
    `insert into public.user_profiles(user_key, display_name, avatar_url, phone)
     values ($1,$2,'',$3) on conflict (user_key) do update set display_name = excluded.display_name, phone = excluded.phone`,
    [userKey, displayName, request.phone]
  );
  await client.query(`insert into public.user_consents(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(
    `insert into public.crm_customers(user_key, first_name, last_name, last_activity_at, app_opens)
     values ($1,$2,$3,now(),1) on conflict (user_key) do nothing`,
    [userKey, firstName, lastName]
  );
  await client.query(`insert into public.point_accounts(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(`insert into public.game_profiles(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(`insert into public.notification_preferences(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);

  const settings = await one<any>(client, `select registration_points as amount from public.economy_settings where singleton = true`);
  const amount = Number(settings?.amount || 0);
  if (amount > 0) {
    const registrationKey = `registration:${userKey}`;
    const account = await one<any>(client, `select balance from public.point_accounts where user_key = $1 for update`, [userKey]);
    const before = Number(account?.balance || 0);
    const after = before + amount;
    await client.query(
      `update public.point_accounts
          set balance = $2, lifetime_earned = lifetime_earned + $3, version = version + 1, updated_at = now()
        where user_key = $1`,
      [userKey, after, amount]
    );
    await client.query(
      `insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type, source_type, source_id, reason, idempotency_key
       ) values ($1,$2,$3,$4,'credit','registration',$1,'Начисление за регистрацию',$5)
       on conflict (idempotency_key) do nothing`,
      [userKey, amount, before, after, registrationKey]
    );
  }
  return userKey;
}

export function createAdminMobileAccessRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/mobile-access", asyncHandler(async (req, res) => {
    const status = req.query.status ? enumValue(req.query.status, "status", ["pending","issued","completed","rejected","cancelled"] as const) : "pending";
    const rows = await many<any>(
      db,
      `select r.id, r.request_type, r.phone, r.telegram_username, r.display_name,
              r.app_user_key, r.status, r.requested_at, r.issued_at, r.completed_at, r.note,
              c.must_change_password, c.last_login_at,
              u.name as user_name
         from public.mobile_access_requests r
         left join public.mobile_credentials c on c.app_user_key = r.app_user_key
         left join public.app_users u on u.user_key = r.app_user_key
        where r.status = $1
        order by r.requested_at desc
        limit 250`,
      [status]
    );
    const counts = await one<any>(
      db,
      `select
         count(*) filter (where status = 'pending')::int as pending,
         count(*) filter (where status = 'issued')::int as issued,
         count(*) filter (where status = 'completed')::int as completed
       from public.mobile_access_requests`
    );
    res.json({ requests: rows, counts: counts || { pending: 0, issued: 0, completed: 0 } });
  }));

  router.post("/mobile-access/:requestId/issue", asyncHandler(async (req, res) => {
    const requestId = uuid(req.params.requestId, "requestId");
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);

    const result = await transaction(db, async client => {
      const request = await one<any>(
        client,
        `select * from public.mobile_access_requests where id = $1 for update`,
        [requestId]
      );
      if (!request) throw new ApiError(404, "Заявка не найдена", "mobile_access_request_not_found");
      if (request.status !== "pending") throw new ApiError(409, "Заявка уже обработана", "mobile_access_already_processed");

      let userKey = request.app_user_key;
      if (request.request_type === "registration") {
        const duplicate = await one<any>(client, `select app_user_key from public.mobile_credentials where phone = $1`, [request.phone]);
        if (duplicate) throw new ApiError(409, "Для этого телефона аккаунт уже создан", "mobile_account_exists");
        userKey = await createMobileUser(client, request, passwordHash);
      } else {
        const credential = await one<any>(
          client,
          `select app_user_key from public.mobile_credentials where app_user_key = $1 or phone = $2 limit 1`,
          [userKey, request.phone]
        );
        if (!credential) throw new ApiError(404, "Мобильный аккаунт не найден", "mobile_account_not_found");
        userKey = credential.app_user_key;
        await client.query(
          `update public.mobile_credentials
              set password_hash = $2,
                  telegram_username = $3,
                  must_change_password = true,
                  password_issued_at = now(),
                  password_changed_at = null,
                  failed_login_count = 0,
                  locked_until = null
            where app_user_key = $1`,
          [userKey, passwordHash, request.telegram_username]
        );
        await client.query(
          `update public.user_sessions set revoked_at = now()
            where app_user_key = $1 and revoked_at is null`,
          [userKey]
        );
      }

      await client.query(
        `update public.mobile_access_requests
            set app_user_key = $2,
                status = 'issued',
                issued_at = now(),
                issued_by_admin_id = $3,
                updated_at = now()
          where id = $1`,
        [requestId, userKey, req.adminPrincipal!.adminId]
      );
      return { ...request, app_user_key: userKey };
    });

    res.json({
      requestId,
      requestType: result.request_type,
      phone: result.phone,
      telegramUsername: result.telegram_username,
      telegramUrl: telegramUrl(result.telegram_username),
      temporaryPassword: password,
      mustChangePassword: true,
      message: "Временный пароль создан. Он показывается администратору только в этом ответе."
    });
  }));

  router.post("/mobile-access/:requestId/reject", asyncHandler(async (req, res) => {
    const requestId = uuid(req.params.requestId, "requestId");
    const note = requiredText(req.body?.note || "Отклонено администратором", "note", 500);
    const updated = await one<any>(
      db,
      `update public.mobile_access_requests
          set status = 'rejected', note = $2, issued_by_admin_id = $3, updated_at = now()
        where id = $1 and status = 'pending'
        returning id`,
      [requestId, note, req.adminPrincipal!.adminId]
    );
    if (!updated) throw new ApiError(409, "Заявка уже обработана или не найдена", "mobile_access_already_processed");
    res.json({ ok: true });
  }));

  return router;
}
