import { Router } from "express";
import { many, one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  isoDateOrNull,
  uniqueStrings,
  uuid
} from "../validation.js";

export function createNotificationsRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const notifications = await many<any>(
      db,
      `select * from public.notifications
        where user_key = $1
          and status <> 'cancelled'
          and (expires_at is null or expires_at > now())
        order by created_at desc
        limit 200`,
      [req.userPrincipal!.userKey]
    );
    const unread = notifications.filter(row => !row.read_at).length;
    res.json({ notifications, unread });
  }));

  router.patch("/:notificationId/read", asyncHandler(async (req, res) => {
    const notificationId = uuid(req.params.notificationId, "notificationId");
    const notification = await one<any>(
      db,
      `update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where id = $1 and user_key = $2
        returning *`,
      [notificationId, req.userPrincipal!.userKey]
    );
    if (!notification) throw new ApiError(404, "Notification was not found", "not_found");
    res.json({ notification });
  }));

  router.post("/read-all", asyncHandler(async (req, res) => {
    const result = await db.query(
      `update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where user_key = $1 and read_at is null`,
      [req.userPrincipal!.userKey]
    );
    res.json({ updated: result.rowCount || 0 });
  }));

  router.get("/preferences/me", asyncHandler(async (req, res) => {
    const preferences = await one<any>(
      db,
      `select * from public.notification_preferences where user_key = $1`,
      [req.userPrincipal!.userKey]
    );
    res.json({ preferences });
  }));

  router.patch("/preferences/me", asyncHandler(async (req, res) => {
    const before = await one<any>(
      db,
      `select * from public.notification_preferences where user_key = $1`,
      [req.userPrincipal!.userKey]
    );
    if (!before) throw new ApiError(404, "Notification preferences were not found", "not_found");
    const quietStart = req.body?.quietHoursStart === undefined
      ? before.quiet_hours_start
      : isoDateOrNull(`1970-01-01T${String(req.body.quietHoursStart)}Z`)?.slice(11, 19) || null;
    const quietEnd = req.body?.quietHoursEnd === undefined
      ? before.quiet_hours_end
      : isoDateOrNull(`1970-01-01T${String(req.body.quietHoursEnd)}Z`)?.slice(11, 19) || null;
    const disabledTypes = req.body?.disabledTypes === undefined
      ? before.disabled_types || []
      : uniqueStrings(req.body.disabledTypes, "disabledTypes", 0, 100, 100);
    const preferences = await one<any>(
      db,
      `update public.notification_preferences
          set in_app_enabled = $2, telegram_enabled = $3, marketing_enabled = $4,
              quiet_hours_start = $5, quiet_hours_end = $6,
              disabled_types = $7::text[], updated_at = now()
        where user_key = $1 returning *`,
      [
        req.userPrincipal!.userKey,
        req.body?.inAppEnabled === undefined ? before.in_app_enabled : booleanValue(req.body.inAppEnabled),
        req.body?.telegramEnabled === undefined ? before.telegram_enabled : booleanValue(req.body.telegramEnabled),
        req.body?.marketingEnabled === undefined ? before.marketing_enabled : booleanValue(req.body.marketingEnabled),
        quietStart,
        quietEnd,
        disabledTypes
      ]
    );
    res.json({ preferences });
  }));

  return router;
}
