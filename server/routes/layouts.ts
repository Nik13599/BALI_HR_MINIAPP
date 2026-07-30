import { Router } from "express";
import { many, one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import { identifier } from "../validation.js";

export async function publishedLayoutBundle(
  db: Queryable,
  layoutId: string,
  allowArchived = false
): Promise<{ layout: any; tables: any[]; elements: any[] }> {
  const layout = await one<any>(
    db,
    `select * from public.hall_layouts
      where id = $1
        and status ${allowArchived ? "in ('published','archived')" : "= 'published'"}`,
    [layoutId]
  );
  if (!layout) throw new ApiError(404, "Published layout was not found", "not_found");
  const [tables, elements] = await Promise.all([
    many<any>(
      db,
      `select * from public.layout_tables
        where layout_id = $1 and active = true
        order by sort_order, table_number`,
      [layoutId]
    ),
    many<any>(
      db,
      `select * from public.hall_layout_elements
        where layout_id = $1 and active = true
        order by sort_order, id`,
      [layoutId]
    )
  ]);
  return { layout, tables, elements };
}

export function createLayoutsRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (_req, res) => {
    const layouts = await many<any>(
      db,
      `select id, layout_family_key, name, internal_description,
              canvas_width, canvas_height, background_url, version, published_at
         from public.hall_layouts
        where status = 'published'
        order by name, version desc`
    );
    res.json({ layouts });
  }));

  router.get("/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    res.json(await publishedLayoutBundle(db, layoutId));
  }));

  return router;
}
