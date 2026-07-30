import { randomUUID } from "node:crypto";
import { Router } from "express";
import { writeAdminAudit } from "../audit.js";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAdmin } from "../middleware/auth.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  boundedNumber,
  enumValue,
  identifier,
  optionalText,
  requiredText,
  uuid
} from "../validation.js";
import { publishedLayoutBundle } from "./layouts.js";

const LAYOUT_STATUSES = ["draft", "published", "archived"] as const;
const TABLE_SHAPES = ["round", "square", "rectangle", "sofa", "custom"] as const;
const TABLE_TYPES = ["regular", "vip", "bar", "sofa", "clan", "service"] as const;
const TABLE_STATUSES = ["available", "unavailable", "vip_only", "clan_only"] as const;
const ELEMENT_TYPES = [
  "stage", "dance_floor", "bar", "entrance", "exit", "cloakroom",
  "restroom", "dj_zone", "stairs", "partition", "decoration", "label"
] as const;
const BOOKING_STATUSES = [
  "new", "pending", "confirmed", "cancelled", "checked_in", "no_show", "completed"
] as const;

async function editableLayout(db: Queryable, layoutId: string): Promise<any> {
  const layout = await one<any>(
    db,
    `select * from public.hall_layouts where id = $1`,
    [layoutId]
  );
  if (!layout) throw new ApiError(404, "Layout was not found", "not_found");
  if (layout.status !== "draft") {
    throw new ApiError(409, "Only a draft layout can be edited; clone this version first", "layout_not_editable");
  }
  return layout;
}

export function createAdminPlatformRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/layouts", asyncHandler(async (req, res) => {
    const status = req.query.status
      ? enumValue(req.query.status, "status", LAYOUT_STATUSES)
      : null;
    const layouts = await many<any>(
      db,
      `select layout.*,
              coalesce(table_count.count, 0)::integer as table_count,
              coalesce(element_count.count, 0)::integer as element_count,
              coalesce(assignment_count.count, 0)::integer as assigned_event_count
         from public.hall_layouts layout
         left join (
           select layout_id, count(*) as count from public.layout_tables group by layout_id
         ) table_count on table_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.hall_layout_elements group by layout_id
         ) element_count on element_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.event_layout_assignments group by layout_id
         ) assignment_count on assignment_count.layout_id = layout.id
        where ($1::text is null or layout.status = $1)
        order by layout.updated_at desc`,
      [status]
    );
    res.json({ layouts });
  }));

  router.get("/layouts/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const layout = await one<any>(db, `select * from public.hall_layouts where id = $1`, [layoutId]);
    if (!layout) throw new ApiError(404, "Layout was not found", "not_found");
    const bundle = layout.status === "published"
      ? await publishedLayoutBundle(db, layoutId)
      : {
          layout,
          tables: await many<any>(
            db,
            `select * from public.layout_tables where layout_id = $1 order by sort_order, table_number`,
            [layoutId]
          ),
          elements: await many<any>(
            db,
            `select * from public.hall_layout_elements where layout_id = $1 order by sort_order, id`,
            [layoutId]
          )
        };
    res.json(bundle);
  }));

  router.post("/layouts", asyncHandler(async (req, res) => {
    const name = requiredText(req.body?.name, "name", 160);
    const layoutId = `layout-${randomUUID()}`;
    const familyKey = req.body?.layoutFamilyKey
      ? identifier(req.body.layoutFamilyKey, "layoutFamilyKey")
      : `layout-family-${randomUUID()}`;
    const layout = await one<any>(
      db,
      `insert into public.hall_layouts(
         id, layout_family_key, name, internal_description, canvas_width,
         canvas_height, background_url, status, version, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,'draft',1,$8)
       returning *`,
      [
        layoutId,
        familyKey,
        name,
        optionalText(req.body?.internalDescription, 2000),
        boundedInteger(req.body?.canvasWidth, 1000, 240, 10000),
        boundedInteger(req.body?.canvasHeight, 1400, 240, 10000),
        optionalText(req.body?.backgroundUrl, 2000),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.create",
      targetType: "hall_layout",
      targetId: layoutId,
      after: layout
    });
    res.status(201).json({ layout });
  }));

  router.post("/layouts/:layoutId/clone", asyncHandler(async (req, res) => {
    const sourceId = identifier(req.params.layoutId, "layoutId");
    const result = await transaction(db, async client => {
      const source = await one<any>(
        client,
        `select * from public.hall_layouts where id = $1 for update`,
        [sourceId]
      );
      if (!source) throw new ApiError(404, "Layout was not found", "not_found");
      const versionRow = await one<any>(
        client,
        `select coalesce(max(version), 0)::integer + 1 as version
           from public.hall_layouts where layout_family_key = $1`,
        [source.layout_family_key]
      );
      const layoutId = `layout-${randomUUID()}`;
      const layout = await one<any>(
        client,
        `insert into public.hall_layouts(
           id, layout_family_key, name, internal_description, canvas_width,
           canvas_height, background_url, status, version, source_layout_id,
           created_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)
         returning *`,
        [
          layoutId,
          source.layout_family_key,
          optionalText(req.body?.name, 160) || `${source.name} v${versionRow!.version}`,
          source.internal_description,
          source.canvas_width,
          source.canvas_height,
          source.background_url,
          versionRow!.version,
          sourceId,
          req.adminPrincipal!.adminId
        ]
      );
      await client.query(
        `insert into public.hall_layout_elements(
           layout_id, element_type, label, x, y, width, height, rotation,
           style, sort_order, active
         )
         select $1, element_type, label, x, y, width, height, rotation,
                style, sort_order, active
           from public.hall_layout_elements where layout_id = $2`,
        [layoutId, sourceId]
      );
      await client.query(
        `insert into public.layout_tables(
           id, layout_id, table_number, name, x, y, width, height, rotation,
           shape, capacity, recommended_guests, minimum_deposit, table_type,
           description, status, sort_order, active
         )
         select 'table-' || gen_random_uuid()::text, $1, table_number, name,
                x, y, width, height, rotation, shape, capacity,
                recommended_guests, minimum_deposit, table_type,
                description, status, sort_order, active
           from public.layout_tables where layout_id = $2`,
        [layoutId, sourceId]
      );
      return { source, layout };
    });
    await writeAdminAudit(db, req, {
      action: "layout.clone",
      targetType: "hall_layout",
      targetId: result.layout.id,
      before: result.source,
      after: result.layout
    });
    res.status(201).json({ layout: result.layout });
  }));

  router.patch("/layouts/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const before = await editableLayout(db, layoutId);
    const layout = await one<any>(
      db,
      `update public.hall_layouts
          set name = $2, internal_description = $3, canvas_width = $4,
              canvas_height = $5, background_url = $6, updated_at = now()
        where id = $1
        returning *`,
      [
        layoutId,
        req.body?.name === undefined ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.internalDescription === undefined
          ? before.internal_description
          : optionalText(req.body.internalDescription, 2000),
        boundedInteger(req.body?.canvasWidth, Number(before.canvas_width), 240, 10000),
        boundedInteger(req.body?.canvasHeight, Number(before.canvas_height), 240, 10000),
        req.body?.backgroundUrl === undefined
          ? before.background_url
          : optionalText(req.body.backgroundUrl, 2000)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.update",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: layout
    });
    res.json({ layout });
  }));

  router.post("/layouts/:layoutId/publish", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const result = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.hall_layouts where id = $1 for update`,
        [layoutId]
      );
      if (!before) throw new ApiError(404, "Layout was not found", "not_found");
      const tableCount = await one<any>(
        client,
        `select count(*)::integer as count from public.layout_tables
          where layout_id = $1 and active = true`,
        [layoutId]
      );
      if (!Number(tableCount?.count || 0)) {
        throw new ApiError(409, "A layout without active tables cannot be published", "layout_has_no_tables");
      }
      await client.query(
        `update public.hall_layouts
            set status = 'archived', archived_at = now(), updated_at = now()
          where layout_family_key = $1 and status = 'published' and id <> $2`,
        [before.layout_family_key, layoutId]
      );
      const layout = await one<any>(
        client,
        `update public.hall_layouts
            set status = 'published', published_at = now(), archived_at = null,
                published_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [layoutId, req.adminPrincipal!.adminId]
      );
      return { before, layout };
    });
    await writeAdminAudit(db, req, {
      action: "layout.publish",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: optionalText(req.body?.reason, 1000),
      before: result.before,
      after: result.layout
    });
    res.json({ layout: result.layout });
  }));

  router.post("/layouts/:layoutId/archive", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const before = await one<any>(db, `select * from public.hall_layouts where id = $1`, [layoutId]);
    if (!before) throw new ApiError(404, "Layout was not found", "not_found");
    const assigned = await one<any>(
      db,
      `select count(*)::integer as count
         from public.event_layout_assignments where layout_id = $1`,
      [layoutId]
    );
    if (Number(assigned?.count || 0) > 0) {
      throw new ApiError(409, "An assigned layout cannot be archived", "layout_is_assigned");
    }
    const layout = await one<any>(
      db,
      `update public.hall_layouts
          set status = 'archived', archived_at = now(), updated_at = now()
        where id = $1 returning *`,
      [layoutId]
    );
    await writeAdminAudit(db, req, {
      action: "layout.archive",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: requiredText(req.body?.reason, "reason", 1000),
      before,
      after: layout
    });
    res.json({ layout });
  }));

  router.post("/layouts/:layoutId/tables", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    await editableLayout(db, layoutId);
    const tableId = `table-${randomUUID()}`;
    const capacity = boundedInteger(req.body?.capacity, 4, 1, 100);
    const recommended = boundedInteger(req.body?.recommendedGuests, capacity, 1, capacity);
    const table = await one<any>(
      db,
      `insert into public.layout_tables(
         id, layout_id, table_number, name, x, y, width, height, rotation,
         shape, capacity, recommended_guests, minimum_deposit, table_type,
         description, status, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [
        tableId,
        layoutId,
        requiredText(req.body?.tableNumber, "tableNumber", 80),
        optionalText(req.body?.name, 160),
        boundedNumber(req.body?.x, 0, -10000, 10000),
        boundedNumber(req.body?.y, 0, -10000, 10000),
        boundedNumber(req.body?.width, 8, 0.1, 10000),
        boundedNumber(req.body?.height, 8, 0.1, 10000),
        boundedNumber(req.body?.rotation, 0, -3600, 3600),
        enumValue(req.body?.shape || "round", "shape", TABLE_SHAPES),
        capacity,
        recommended,
        boundedNumber(req.body?.minimumDeposit, 0, 0, 1_000_000_000),
        enumValue(req.body?.tableType || "regular", "tableType", TABLE_TYPES),
        optionalText(req.body?.description, 2000),
        enumValue(req.body?.status || "available", "status", TABLE_STATUSES),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        booleanValue(req.body?.active, true)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.table.create",
      targetType: "layout_table",
      targetId: tableId,
      after: table
    });
    res.status(201).json({ table });
  }));

  router.patch("/layouts/:layoutId/tables/:tableId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const tableId = identifier(req.params.tableId, "tableId");
    await editableLayout(db, layoutId);
    const before = await one<any>(
      db,
      `select * from public.layout_tables where id = $1 and layout_id = $2`,
      [tableId, layoutId]
    );
    if (!before) throw new ApiError(404, "Table was not found", "not_found");
    const capacity = boundedInteger(req.body?.capacity, Number(before.capacity), 1, 100);
    const recommended = boundedInteger(
      req.body?.recommendedGuests,
      Math.min(Number(before.recommended_guests), capacity),
      1,
      capacity
    );
    const table = await one<any>(
      db,
      `update public.layout_tables
          set table_number = $3, name = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, shape = $10, capacity = $11,
              recommended_guests = $12, minimum_deposit = $13,
              table_type = $14, description = $15, status = $16,
              sort_order = $17, active = $18, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,
      [
        tableId,
        layoutId,
        req.body?.tableNumber === undefined
          ? before.table_number
          : requiredText(req.body.tableNumber, "tableNumber", 80),
        req.body?.name === undefined ? before.name : optionalText(req.body.name, 160),
        boundedNumber(req.body?.x, Number(before.x), -10000, 10000),
        boundedNumber(req.body?.y, Number(before.y), -10000, 10000),
        boundedNumber(req.body?.width, Number(before.width), 0.1, 10000),
        boundedNumber(req.body?.height, Number(before.height), 0.1, 10000),
        boundedNumber(req.body?.rotation, Number(before.rotation), -3600, 3600),
        req.body?.shape === undefined ? before.shape : enumValue(req.body.shape, "shape", TABLE_SHAPES),
        capacity,
        recommended,
        boundedNumber(req.body?.minimumDeposit, Number(before.minimum_deposit), 0, 1_000_000_000),
        req.body?.tableType === undefined
          ? before.table_type
          : enumValue(req.body.tableType, "tableType", TABLE_TYPES),
        req.body?.description === undefined
          ? before.description
          : optionalText(req.body.description, 2000),
        req.body?.status === undefined
          ? before.status
          : enumValue(req.body.status, "status", TABLE_STATUSES),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.table.update",
      targetType: "layout_table",
      targetId: tableId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: table
    });
    res.json({ table });
  }));

  router.delete("/layouts/:layoutId/tables/:tableId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const tableId = identifier(req.params.tableId, "tableId");
    await editableLayout(db, layoutId);
    const before = await one<any>(
      db,
      `select * from public.layout_tables where id = $1 and layout_id = $2`,
      [tableId, layoutId]
    );
    if (!before) throw new ApiError(404, "Table was not found", "not_found");
    try {
      await db.query(`delete from public.layout_tables where id = $1 and layout_id = $2`, [tableId, layoutId]);
    } catch (error: any) {
      if (error?.code === "23503") {
        throw new ApiError(409, "A table with booking history cannot be deleted; mark it inactive", "table_has_history");
      }
      throw error;
    }
    await writeAdminAudit(db, req, {
      action: "layout.table.delete",
      targetType: "layout_table",
      targetId: tableId,
      reason: requiredText(req.body?.reason, "reason", 1000),
      before
    });
    res.status(204).end();
  }));

  router.post("/layouts/:layoutId/elements", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    await editableLayout(db, layoutId);
    const style = req.body?.style && typeof req.body.style === "object" && !Array.isArray(req.body.style)
      ? req.body.style
      : {};
    const element = await one<any>(
      db,
      `insert into public.hall_layout_elements(
         layout_id, element_type, label, x, y, width, height, rotation,
         style, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       returning *`,
      [
        layoutId,
        enumValue(req.body?.elementType, "elementType", ELEMENT_TYPES),
        optionalText(req.body?.label, 160),
        boundedNumber(req.body?.x, 0, -10000, 10000),
        boundedNumber(req.body?.y, 0, -10000, 10000),
        boundedNumber(req.body?.width, 10, 0.1, 10000),
        boundedNumber(req.body?.height, 10, 0.1, 10000),
        boundedNumber(req.body?.rotation, 0, -3600, 3600),
        JSON.stringify(style),
        boundedInteger(req.body?.sortOrder, 0, -1_000_000, 1_000_000),
        booleanValue(req.body?.active, true)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.element.create",
      targetType: "layout_element",
      targetId: element!.id,
      after: element
    });
    res.status(201).json({ element });
  }));

  router.patch("/layouts/:layoutId/elements/:elementId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const elementId = uuid(req.params.elementId, "elementId");
    await editableLayout(db, layoutId);
    const before = await one<any>(
      db,
      `select * from public.hall_layout_elements where id = $1 and layout_id = $2`,
      [elementId, layoutId]
    );
    if (!before) throw new ApiError(404, "Layout element was not found", "not_found");
    const style = req.body?.style === undefined
      ? before.style
      : req.body.style && typeof req.body.style === "object" && !Array.isArray(req.body.style)
        ? req.body.style
        : (() => { throw new ApiError(400, "style must be an object", "validation_error"); })();
    const element = await one<any>(
      db,
      `update public.hall_layout_elements
          set element_type = $3, label = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, style = $10::jsonb,
              sort_order = $11, active = $12, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,
      [
        elementId,
        layoutId,
        req.body?.elementType === undefined
          ? before.element_type
          : enumValue(req.body.elementType, "elementType", ELEMENT_TYPES),
        req.body?.label === undefined ? before.label : optionalText(req.body.label, 160),
        boundedNumber(req.body?.x, Number(before.x), -10000, 10000),
        boundedNumber(req.body?.y, Number(before.y), -10000, 10000),
        boundedNumber(req.body?.width, Number(before.width), 0.1, 10000),
        boundedNumber(req.body?.height, Number(before.height), 0.1, 10000),
        boundedNumber(req.body?.rotation, Number(before.rotation), -3600, 3600),
        JSON.stringify(style),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1_000_000, 1_000_000),
        req.body?.active === undefined ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db, req, {
      action: "layout.element.update",
      targetType: "layout_element",
      targetId: elementId,
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: element
    });
    res.json({ element });
  }));

  router.post("/events/:eventId/layout", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const nextLayoutId = identifier(req.body?.layoutId, "layoutId");
    const confirmed = booleanValue(req.body?.confirmed);
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const mappings = req.body?.tableMappings && typeof req.body.tableMappings === "object"
      ? req.body.tableMappings as Record<string, unknown>
      : {};
    const result = await transaction(db, async client => {
      const [event, layout, current] = await Promise.all([
        one<any>(client, `select id, title from public.events where id = $1`, [eventId]),
        one<any>(
          client,
          `select * from public.hall_layouts where id = $1 and status = 'published'`,
          [nextLayoutId]
        ),
        one<any>(
          client,
          `select * from public.event_layout_assignments where event_id = $1 for update`,
          [eventId]
        )
      ]);
      if (!event) throw new ApiError(404, "Event was not found", "not_found");
      if (!layout) throw new ApiError(404, "Published layout was not found", "layout_not_found");
      const activeBookings = await many<any>(
        client,
        `select id, table_id, status
           from public.booking_records
          where event_id = $1
            and status in ('new','pending','confirmed','checked_in')
          for update`,
        [eventId]
      );
      const mappedRows: Array<{ bookingId: string; oldTableId: string; newTableId: string }> = [];
      const unresolved: any[] = [];
      for (const booking of activeBookings) {
        const mappedTableId = String(mappings[booking.table_id] || "").trim();
        if (!mappedTableId) {
          unresolved.push(booking);
          continue;
        }
        const targetTable = await one<any>(
          client,
          `select id from public.layout_tables
            where id = $1 and layout_id = $2 and active = true`,
          [mappedTableId, nextLayoutId]
        );
        if (!targetTable) {
          throw new ApiError(400, `Mapped table ${mappedTableId} is not active in the selected layout`, "invalid_table_mapping");
        }
        mappedRows.push({
          bookingId: booking.id,
          oldTableId: booking.table_id,
          newTableId: mappedTableId
        });
      }
      if (activeBookings.length && (!confirmed || unresolved.length)) {
        throw new ApiError(
          409,
          "Layout change affects active bookings and requires confirmation plus a table mapping for every booking",
          "layout_assignment_conflict",
          {
            affectedBookingCount: activeBookings.length,
            unresolvedBookings: unresolved,
            requiredMappingKeys: unresolved.map(row => row.table_id)
          }
        );
      }
      for (const mapping of mappedRows) {
        await client.query(
          `update public.booking_records
              set layout_id = $2, table_id = $3, updated_at = now()
            where id = $1`,
          [mapping.bookingId, nextLayoutId, mapping.newTableId]
        );
      }
      await client.query(
        `update public.booking_holds
            set status = 'released', released_at = now(), updated_at = now()
          where event_id = $1 and status = 'active'`,
        [eventId]
      );
      const assignment = await one<any>(
        client,
        `insert into public.event_layout_assignments(
           event_id, layout_id, assigned_by_admin_id
         ) values ($1,$2,$3)
         on conflict (event_id) do update
           set layout_id = excluded.layout_id,
               assigned_by_admin_id = excluded.assigned_by_admin_id,
               updated_at = now()
         returning *`,
        [eventId, nextLayoutId, req.adminPrincipal!.adminId]
      );
      await client.query(
        `insert into public.event_layout_assignment_history(
           event_id, previous_layout_id, next_layout_id, affected_booking_count,
           conflict_count, confirmed, reason, changed_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          eventId,
          current?.layout_id || null,
          nextLayoutId,
          activeBookings.length,
          activeBookings.length,
          confirmed,
          reason,
          req.adminPrincipal!.adminId
        ]
      );
      return { event, layout, previousAssignment: current, assignment, mappedRows };
    });
    await writeAdminAudit(db, req, {
      action: "event.layout.assign",
      targetType: "event",
      targetId: eventId,
      reason,
      before: result.previousAssignment,
      after: { assignment: result.assignment, mappedRows: result.mappedRows }
    });
    res.json({ assignment: result.assignment, mappedBookings: result.mappedRows });
  }));

  router.get("/bookings", asyncHandler(async (req, res) => {
    const eventId = req.query.eventId ? identifier(req.query.eventId, "eventId") : null;
    const status = req.query.status
      ? enumValue(req.query.status, "status", BOOKING_STATUSES)
      : null;
    const search = String(req.query.search || "").trim().slice(0, 160);
    const bookings = await many<any>(
      db,
      `select booking.*, event.title as event_title,
              layout_table.table_number, layout_table.name as table_name,
              app_user.name as app_user_name, app_user.username,
              clan.name as clan_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
         join public.app_users app_user on app_user.user_key = booking.user_key
         left join public.clans clan on clan.id = booking.clan_id
        where ($1::text is null or booking.event_id = $1)
          and ($2::text is null or booking.status = $2)
          and ($3 = '' or lower(booking.customer_name) like '%' || lower($3) || '%'
            or lower(booking.phone) like '%' || lower($3) || '%'
            or lower(booking.booking_reference) like '%' || lower($3) || '%')
        order by booking.created_at desc
        limit 500`,
      [eventId, status, search]
    );
    res.json({ bookings });
  }));

  router.patch("/bookings/:bookingId", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const nextStatus = enumValue(req.body?.status, "status", BOOKING_STATUSES);
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const result = await transaction(db, async client => {
      const before = await one<any>(
        client,
        `select * from public.booking_records where id = $1 for update`,
        [bookingId]
      );
      if (!before) throw new ApiError(404, "Booking was not found", "not_found");
      const after = await one<any>(
        client,
        `update public.booking_records
            set status = $2,
                confirmed_at = case when $2 = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
                cancelled_at = case when $2 = 'cancelled' then now() else cancelled_at end,
                cancelled_by = case when $2 = 'cancelled' then $3 else cancelled_by end,
                checked_in_at = case when $2 = 'checked_in' then now() else checked_in_at end,
                no_show_at = case when $2 = 'no_show' then now() else no_show_at end,
                completed_at = case when $2 = 'completed' then now() else completed_at end,
                updated_at = now()
          where id = $1
          returning *`,
        [bookingId, nextStatus, req.adminPrincipal!.email]
      );
      await client.query(
        `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,$3,'admin',$4,$5,$6::jsonb,$7::jsonb)`,
        [
          bookingId,
          before.status,
          nextStatus,
          req.adminPrincipal!.adminId,
          reason,
          JSON.stringify(before),
          JSON.stringify(after)
        ]
      );
      return { before, after };
    });
    await writeAdminAudit(db, req, {
      action: "booking.status.update",
      targetType: "booking",
      targetId: bookingId,
      reason,
      before: result.before,
      after: result.after
    });
    res.json({ booking: result.after });
  }));

  router.get("/booking-settings", asyncHandler(async (_req, res) => {
    const settings = await one<any>(
      db,
      `select * from public.booking_settings where singleton = true`
    );
    res.json({ settings });
  }));

  router.patch("/booking-settings", asyncHandler(async (req, res) => {
    const before = await one<any>(db, `select * from public.booking_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Booking settings are missing", "booking_settings_missing");
    const settings = await one<any>(
      db,
      `update public.booking_settings
          set hold_seconds = $1, allow_capacity_override = $2, auto_confirm = $3,
              updated_by_admin_id = $4, updated_at = now()
        where singleton = true
        returning *`,
      [
        boundedInteger(req.body?.holdSeconds, Number(before.hold_seconds), 60, 3600),
        req.body?.allowCapacityOverride === undefined
          ? before.allow_capacity_override
          : booleanValue(req.body.allowCapacityOverride),
        req.body?.autoConfirm === undefined ? before.auto_confirm : booleanValue(req.body.autoConfirm),
        req.adminPrincipal!.adminId
      ]
    );
    await writeAdminAudit(db, req, {
      action: "booking.settings.update",
      targetType: "booking_settings",
      targetId: "singleton",
      reason: optionalText(req.body?.reason, 1000),
      before,
      after: settings
    });
    res.json({ settings });
  }));

  return router;
}
