import { Router } from "express";
import { many } from "../db.js";
import { asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import type { Queryable } from "../types.js";

export function createPlatformConfigRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (_req, res) => {
    const [blocks, navigation, assets] = await Promise.all([
      many<any>(
        db,
        `select scope, block_key, name, title, subtitle, asset_key,
                configuration, recommended_width, recommended_height, sort_order
           from public.ui_content_blocks
          where active = true
          order by scope, sort_order, block_key`
      ),
      many<any>(
        db,
        `select app_type, item_key, label, route, icon_url,
                recommended_width, recommended_height, sort_order
           from public.ui_navigation_items
          where active = true
          order by app_type, sort_order, item_key`
      ),
      many<any>(
        db,
        `select asset_key, name, url, media_type, width, height,
                recommended_width, recommended_height, alt_text
           from public.admin_assets`
      )
    ]);
    res.json({ blocks, navigation, assets });
  }));

  return router;
}
