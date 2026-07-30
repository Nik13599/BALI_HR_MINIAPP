import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { Router } from "express";
import { writeAdminAudit } from "../audit.js";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  enumValue,
  identifier,
  optionalText,
  requiredText
} from "../validation.js";

const SCOPES = ["app", "admin", "shared", "game"] as const;
const MEDIA_TYPES = ["image", "video", "audio", "icon"] as const;
const APP_TYPES = ["app", "admin"] as const;
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);

function validImage(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ApiError(400, `${field} must be an object`, "validation_error");
  }
  return value as Record<string, unknown>;
}

function nullableDimension(value: unknown, _field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return boundedInteger(value, 0, 1, 100_000);
}

function campaignSegment(value: unknown): {
  userKeys: string[] | null;
  marketingOnly: boolean;
  clanId: string | null;
  hasVip: boolean | null;
} {
  const source = value === undefined ? {} : objectValue(value, "segment");
  const userKeys = source.userKeys === undefined || source.userKeys === null
    ? null
    : Array.isArray(source.userKeys)
      ? [...new Set(source.userKeys.map(key => identifier(key, "userKey")))].slice(0, 10_000)
      : (() => { throw new ApiError(400, "segment.userKeys must be an array", "validation_error"); })();
  return {
    userKeys,
    marketingOnly: booleanValue(source.marketingOnly),
    clanId: source.clanId ? identifier(source.clanId, "clanId") : null,
    hasVip: source.hasVip === undefined || source.hasVip === null
      ? null
      : booleanValue(source.hasVip)
  };
}

async function campaignCandidates(
  db: Queryable,
  segment: ReturnType<typeof campaignSegment>
): Promise<any[]> {
  return many<any>(
    db,
    `select user_row.user_key, user_row.name, account.telegram_user_id,
            coalesce(preferences.telegram_enabled, true) as telegram_enabled,
            coalesce(consent.marketing_opt_in, false) as marketing_opt_in
       from public.app_users user_row
       join public.telegram_accounts account on account.app_user_key = user_row.user_key
       left join public.user_consents consent on consent.user_key = user_row.user_key
       left join public.notification_preferences preferences on preferences.user_key = user_row.user_key
      where user_row.account_status = 'active' and user_row.blocked_at is null
        and ($1::text[] is null or user_row.user_key = any($1::text[]))
        and ($2::boolean = false or coalesce(consent.marketing_opt_in, false) = true)
        and ($3::text is null or exists (
          select 1 from public.clan_memberships membership
           where membership.user_key = user_row.user_key
             and membership.clan_id = $3 and membership.status = 'active'
        ))
        and ($4::boolean is null or exists (
          select 1 from public.user_vip_subscriptions vip
           where vip.user_key = user_row.user_key
             and vip.status = 'active' and vip.starts_at <= now() and vip.ends_at > now()
        ) = $4)
      order by user_row.user_key`,
    [segment.userKeys, segment.marketingOnly, segment.clanId, segment.hasVip]
  );
}

export function createAdminContentRouter(db: Queryable, uploadDirectory: string): Router {
  const router = Router();
  router.use(requireAdmin);

  router.post(
    "/content/uploads",
    express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "12mb" }),
    asyncHandler(async (req, res) => {
      await enforceRateLimit(db, req, "content.upload", requestSubject(req));
      const mimeType = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const extension = IMAGE_TYPES.get(mimeType);
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!extension || !validImage(body, mimeType)) {
        throw new ApiError(400, "Only valid PNG, JPG and WEBP images are accepted", "invalid_image");
      }
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(path.join(uploadDirectory, filename), body, { flag: "wx", mode: 0o640 });
      const url = `/uploads/${filename}`;
      await writeAdminAudit(db, req, {
        action: "content.upload.create",
        targetType: "uploaded_asset",
        targetId: filename,
        after: { url, mimeType, bytes: body.length }
      });
      res.status(201).json({ upload: { url, mimeType, bytes: body.length } });
    })
  );

  router.get("/content", asyncHandler(async (_req, res) => {
    const [assets, blocks, navigation] = await Promise.all([
      many<any>(db, `select * from public.admin_assets order by asset_key`),
      many<any>(db, `select * from public.ui_content_blocks order by scope, sort_order, block_key`),
      many<any>(db, `select * from public.ui_navigation_items order by app_type, sort_order, item_key`)
    ]);
    res.json({ assets, blocks, navigation });
  }));

  router.post("/content/assets", asyncHandler(async (req, res) => {
    const assetKey = identifier(req.body?.assetKey, "assetKey");
    const url = requiredText(req.body?.url, "url", 4000);
    const asset = await one<any>(
      db,
      `insert into public.admin_assets(
         asset_key, name, default_name, url, default_url, media_type, mime_type,
         width, height, recommended_width, recommended_height,
         max_bytes, alt_text, updated_by_admin_id
       ) values ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        assetKey,
        requiredText(req.body?.name, "name", 200),
        url,
        optionalText(req.body?.defaultUrl, 4000) || url,
        enumValue(req.body?.mediaType || "image", "mediaType", MEDIA_TYPES),
        optionalText(req.body?.mimeType, 200),
        nullableDimension(req.body?.width, "width"),
        nullableDimension(req.body?.height, "height"),
        nullableDimension(req.body?.recommendedWidth, "recommendedWidth"),
        nullableDimension(req.body?.recommendedHeight, "recommendedHeight"),
        req.body?.maxBytes === undefined || req.body.maxBytes === null
          ? null
          : boundedInteger(req.body.maxBytes, 0, 1, 100_000_000),
        optionalText(req.body?.altText, 500),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "content.asset.create",
      targetType: "admin_asset",
      targetId: assetKey,
      after: asset
    });
    res.status(201).json({ asset });
  }));

  router.patch("/content/assets/:assetKey", asyncHandler(async (req, res) => {
    const assetKey = identifier(req.params.assetKey, "assetKey");
    const before = await one<any>(db, `select * from public.admin_assets where asset_key = $1`, [assetKey]);
    if (!before) throw new ApiError(404, "Asset was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const asset = await one<any>(
      db,
      `update public.admin_assets
          set name = $2, url = $3, media_type = $4, mime_type = $5,
              width = $6, height = $7, recommended_width = $8,
              recommended_height = $9, max_bytes = $10, alt_text = $11,
              updated_by_admin_id = $12, updated_at = now()
        where asset_key = $1 returning *`,
      [
        assetKey,
        reset
          ? before.default_name
          : req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 200),
        reset
          ? before.default_url
          : req.body?.url === undefined ? before.url : requiredText(req.body.url, "url", 4000),
        req.body?.mediaType === undefined
          ? before.media_type
          : enumValue(req.body.mediaType, "mediaType", MEDIA_TYPES),
        req.body?.mimeType === undefined ? before.mime_type : optionalText(req.body.mimeType, 200),
        req.body?.width === undefined ? before.width : nullableDimension(req.body.width, "width"),
        req.body?.height === undefined ? before.height : nullableDimension(req.body.height, "height"),
        req.body?.recommendedWidth === undefined
          ? before.recommended_width
          : nullableDimension(req.body.recommendedWidth, "recommendedWidth"),
        req.body?.recommendedHeight === undefined
          ? before.recommended_height
          : nullableDimension(req.body.recommendedHeight, "recommendedHeight"),
        req.body?.maxBytes === undefined
          ? before.max_bytes
          : req.body.maxBytes === null
            ? null
            : boundedInteger(req.body.maxBytes, 0, 1, 100_000_000),
        req.body?.altText === undefined ? before.alt_text : optionalText(req.body.altText, 500),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: reset ? "content.asset.reset" : "content.asset.update",
      targetType: "admin_asset",
      targetId: assetKey,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: asset
    });
    res.json({ asset });
  }));

  router.post("/content/blocks", asyncHandler(async (req, res) => {
    const scope = enumValue(req.body?.scope, "scope", SCOPES);
    const blockKey = identifier(req.body?.blockKey, "blockKey");
    const configuration = req.body?.configuration === undefined
      ? {}
      : objectValue(req.body.configuration, "configuration");
    const defaultValue = req.body?.defaultValue === undefined
      ? {
          name: requiredText(req.body?.name, "name", 200),
          title: optionalText(req.body?.title, 500),
          subtitle: optionalText(req.body?.subtitle, 1000),
          assetKey: req.body?.assetKey || null,
          configuration
        }
      : objectValue(req.body.defaultValue, "defaultValue");
    const block = await one<any>(
      db,
      `insert into public.ui_content_blocks(
         scope, block_key, name, title, subtitle, asset_key,
         configuration, default_value, recommended_width, recommended_height,
         active, sort_order, updated_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
       returning *`,
      [
        scope,
        blockKey,
        requiredText(req.body?.name, "name", 200),
        optionalText(req.body?.title, 500),
        optionalText(req.body?.subtitle, 1000),
        req.body?.assetKey ? identifier(req.body.assetKey, "assetKey") : null,
        JSON.stringify(configuration),
        JSON.stringify(defaultValue),
        nullableDimension(req.body?.recommendedWidth, "recommendedWidth"),
        nullableDimension(req.body?.recommendedHeight, "recommendedHeight"),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "content.block.create",
      targetType: "ui_content_block",
      targetId: block!.id,
      after: block
    });
    res.status(201).json({ block });
  }));

  router.patch("/content/blocks/:blockId", asyncHandler(async (req, res) => {
    const blockId = String(req.params.blockId || "");
    if (!/^[0-9a-f-]{36}$/i.test(blockId)) throw new ApiError(400, "blockId is invalid", "validation_error");
    const before = await one<any>(db, `select * from public.ui_content_blocks where id = $1`, [blockId]);
    if (!before) throw new ApiError(404, "Content block was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const defaults = before.default_value || {};
    const configuration = reset
      ? defaults.configuration || {}
      : req.body?.configuration === undefined
        ? before.configuration
        : objectValue(req.body.configuration, "configuration");
    const block = await one<any>(
      db,
      `update public.ui_content_blocks
          set name = $2, title = $3, subtitle = $4, asset_key = $5,
              configuration = $6::jsonb, recommended_width = $7,
              recommended_height = $8, active = $9, sort_order = $10,
              updated_by_admin_id = $11, updated_at = now()
        where id = $1 returning *`,
      [
        blockId,
        reset
          ? String(defaults.name || before.name)
          : req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 200),
        reset
          ? String(defaults.title || "")
          : req.body?.title === undefined ? before.title : optionalText(req.body.title, 500),
        reset
          ? String(defaults.subtitle || "")
          : req.body?.subtitle === undefined ? before.subtitle : optionalText(req.body.subtitle, 1000),
        reset
          ? defaults.assetKey || null
          : req.body?.assetKey === undefined
            ? before.asset_key
            : req.body.assetKey ? identifier(req.body.assetKey, "assetKey") : null,
        JSON.stringify(configuration),
        req.body?.recommendedWidth === undefined
          ? before.recommended_width
          : nullableDimension(req.body.recommendedWidth, "recommendedWidth"),
        req.body?.recommendedHeight === undefined
          ? before.recommended_height
          : nullableDimension(req.body.recommendedHeight, "recommendedHeight"),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: reset ? "content.block.reset" : "content.block.update",
      targetType: "ui_content_block",
      targetId: blockId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: block
    });
    res.json({ block });
  }));

  router.patch("/content/navigation/:itemId", asyncHandler(async (req, res) => {
    const itemId = String(req.params.itemId || "");
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new ApiError(400, "itemId is invalid", "validation_error");
    const before = await one<any>(db, `select * from public.ui_navigation_items where id = $1`, [itemId]);
    if (!before) throw new ApiError(404, "Navigation item was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const item = await one<any>(
      db,
      `update public.ui_navigation_items
          set app_type = $2, label = $3, route = $4, icon_url = $5,
              recommended_width = $6, recommended_height = $7,
              active = $8, sort_order = $9, updated_by_admin_id = $10,
              updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.appType === undefined
          ? before.app_type
          : enumValue(req.body.appType, "appType", APP_TYPES),
        reset
          ? before.default_label
          : req.body?.label === undefined ? before.label : requiredText(req.body.label, "label", 120),
        reset
          ? before.default_route
          : req.body?.route === undefined ? before.route : requiredText(req.body.route, "route", 200),
        reset
          ? before.default_icon_url
          : req.body?.iconUrl === undefined ? before.icon_url : optionalText(req.body.iconUrl, 4000),
        boundedInteger(req.body?.recommendedWidth, Number(before.recommended_width), 1, 10000),
        boundedInteger(req.body?.recommendedHeight, Number(before.recommended_height), 1, 10000),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: reset ? "content.navigation.reset" : "content.navigation.update",
      targetType: "ui_navigation_item",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: item
    });
    res.json({ item });
  }));

  router.get("/campaigns", asyncHandler(async (_req, res) => {
    const campaigns = await many<any>(
      db,
      `select campaign.*, creator.email as creator_email, confirmer.email as confirmer_email
         from public.crm_campaigns campaign
         left join public.admin_users creator on creator.id = campaign.created_by_admin_id
         left join public.admin_users confirmer on confirmer.id = campaign.confirmed_by_admin_id
        order by campaign.created_at desc limit 500`
    );
    res.json({ campaigns });
  }));

  router.post("/campaigns", asyncHandler(async (req, res) => {
    const segment = campaignSegment(req.body?.segment);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const existing = await one<any>(db, `select * from public.crm_campaigns where idempotency_key = $1`, [key]);
    if (existing) return res.json({ campaign: existing, replayed: true });
    const candidates = await campaignCandidates(db, segment);
    const campaign = await one<any>(
      db,
      `insert into public.crm_campaigns(
         name, segment, message_text, recipient_count, status,
         idempotency_key, created_by_admin_id
       ) values ($1,$2::jsonb,$3,$4,'previewed',$5,$6)
       returning *`,
      [
        requiredText(req.body?.name, "name", 200),
        JSON.stringify(segment),
        requiredText(req.body?.messageText, "messageText", 4000),
        candidates.length,
        key,
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "campaign.preview",
      targetType: "crm_campaign",
      targetId: campaign!.id,
      after: { campaign, sample: candidates.slice(0, 20) }
    });
    res.status(201).json({ campaign, sample: candidates.slice(0, 20), replayed: false });
  }));

  router.post("/campaigns/:campaignId/confirm", asyncHandler(async (req, res) => {
    const campaignId = String(req.params.campaignId || "");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new ApiError(400, "campaignId is invalid", "validation_error");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const result = await transaction(db, async client => {
      const campaign = await one<any>(
        client,
        `select * from public.crm_campaigns where id = $1 for update`,
        [campaignId]
      );
      if (!campaign) throw new ApiError(404, "Campaign was not found", "not_found");
      if (campaign.status === "sending" || campaign.status === "completed") {
        return { campaign, queued: Number(campaign.recipient_count), replayed: true };
      }
      if (!["draft", "previewed"].includes(campaign.status)) {
        throw new ApiError(409, "Campaign cannot be confirmed in its current state", "campaign_not_confirmable");
      }
      const segment = campaignSegment(campaign.segment);
      const candidates = await campaignCandidates(client, segment);
      for (const candidate of candidates) {
        const recipient = await one<any>(
          client,
          `insert into public.crm_campaign_recipients(campaign_id, user_key, status)
           values ($1,$2,$3)
           on conflict (campaign_id, user_key) do update set status = excluded.status
           returning *`,
          [
            campaignId,
            candidate.user_key,
            candidate.telegram_enabled ? "queued" : "skipped"
          ]
        );
        if (!candidate.telegram_enabled) {
          await client.query(
            `update public.crm_campaign_recipients
                set skip_reason = 'telegram_disabled', updated_at = now()
              where id = $1`,
            [recipient!.id]
          );
          continue;
        }
        const notification = await one<any>(
          client,
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'campaign',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
           returning *`,
          [
            candidate.user_key,
            campaign.name,
            campaign.message_text,
            JSON.stringify({ campaignId }),
            `campaign-notification:${campaignId}:${candidate.user_key}`
          ]
        );
        await client.query(
          `insert into public.telegram_delivery_log(
             notification_id, campaign_recipient_id, telegram_user_id,
             deduplication_key
           ) values ($1,$2,$3,$4)
           on conflict (deduplication_key) do nothing`,
          [
            notification!.id,
            recipient!.id,
            candidate.telegram_user_id,
            `campaign-delivery:${campaignId}:${candidate.user_key}`
          ]
        );
      }
      await client.query(
        `insert into public.outbox_jobs(
           job_type, aggregate_type, aggregate_id, payload, idempotency_key
         ) values ('telegram_campaign','crm_campaign',$1,$2::jsonb,$3)
         on conflict (idempotency_key) do nothing`,
        [
          campaignId,
          JSON.stringify({ campaignId }),
          `campaign-outbox:${campaignId}`
        ]
      );
      const updated = await one<any>(
        client,
        `update public.crm_campaigns
            set status = 'sending', recipient_count = $2,
                confirmed_by_admin_id = $3, confirmed_at = now(),
                started_at = now(), updated_at = now()
          where id = $1 returning *`,
        [campaignId, candidates.length, req.adminPrincipal!.adminId]
      );
      return { campaign: updated, queued: candidates.length, replayed: false };
    });
    await writeAdminAudit(db, req, {
      action: "campaign.confirm",
      targetType: "crm_campaign",
      targetId: campaignId,
      reason,
      after: result
    });
    res.json(result);
  }));

  return router;
}
