import { Router } from "express";
import { many, one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import { boundedInteger, optionalText } from "../validation.js";

export function createCatalogRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (_req, res) => {
    const [menu, venue, reviews] = await Promise.all([
      many<any>(
        db,
        `select * from public.menu_catalog_items
          where active = true order by sort_order, category, name`
      ),
      one<any>(
        db,
        `select * from public.venue_content where id = 'venue-main' and active = true`
      ),
      many<any>(
        db,
        `select review.id, review.rating, review.body, review.created_at,
                user_row.name, user_row.avatar
           from public.venue_reviews review
           join public.app_users user_row on user_row.user_key = review.user_key
          where review.status = 'published'
          order by review.created_at desc limit 100`
      )
    ]);
    res.json({ menu, venue, reviews });
  }));

  router.post("/reviews", asyncHandler(async (req, res) => {
    const rating = boundedInteger(req.body?.rating, 0, 1, 5);
    const body = optionalText(req.body?.body, 2000);
    if (!body) throw new ApiError(400, "Review text is required", "validation_error");
    const review = await one<any>(
      db,
      `insert into public.venue_reviews(user_key, rating, body)
       values ($1,$2,$3)
       returning *`,
      [req.userPrincipal!.userKey, rating, body]
    );
    res.status(201).json({ review });
  }));

  return router;
}
