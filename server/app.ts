import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Request, Response } from "express";
import { createAuthRouter } from "./routes/auth.js";
import { createMobileAuthRouter } from "./routes/mobile-auth.js";
import { createClanRouter } from "./routes/clans.js";
import { createAdminRouter } from "./routes/admin.js";
import { createAdminPlatformRouter } from "./routes/admin-platform.js";
import { createAdminEconomyRouter } from "./routes/admin-economy.js";
import { createAdminContentRouter } from "./routes/admin-content.js";
import { createAdminCrmRouter } from "./routes/admin-crm.js";
import { createAdminOperationsRouter } from "./routes/admin-operations.js";
import { createAdminMobileAccessRouter } from "./routes/admin-mobile-access.js";
import { createBookingsRouter } from "./routes/bookings.js";
import { createCatalogRouter } from "./routes/catalog.js";
import { createEconomyRouter } from "./routes/economy.js";
import { createEventsRouter } from "./routes/events.js";
import { createGameRouter } from "./routes/game.js";
import { createLayoutsRouter } from "./routes/layouts.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createPeopleRouter } from "./routes/people.js";
import { createPlatformConfigRouter } from "./routes/platform-config.js";
import { createSocialRouter } from "./routes/social.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { optionalAdmin, optionalUser } from "./middleware/auth.js";
import type { AppConfig, Queryable } from "./types.js";

const siteDirectory = path.resolve(process.cwd(), "site");
const uploadDirectory = path.resolve(process.env.BALI_UPLOAD_DIR || path.join(process.cwd(), "var", "uploads"));

export function createApp(db: Queryable, config: AppConfig) {
  mkdirSync(uploadDirectory, { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use((req, res, next) => {
    req.requestId = String(req.get("x-request-id") || randomUUID()).slice(0, 160);
    res.setHeader("x-request-id", req.requestId);
    res.setHeader("x-bali-environment", config.environment);
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(optionalUser(db, config));
  app.use(optionalAdmin(db, config));
  app.use("/api/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, environment: config.environment });
  });
  app.get("/api/v1/config/public", (_req, res) => {
    res.json({
      environment: config.environment,
      demoAvailable: !["production", "staging"].includes(config.environment),
      authentication: "mobile-password"
    });
  });
  app.use("/api/v1/auth", createAuthRouter(db, config));
  app.use("/api/v1/auth", createMobileAuthRouter(db, config));
  app.use("/api/v1/clans", createClanRouter(db));
  app.use("/api/v1/people", createPeopleRouter(db));
  app.use("/api/v1/events", createEventsRouter(db));
  app.use("/api/v1/layouts", createLayoutsRouter(db));
  app.use("/api/v1/bookings", createBookingsRouter(db));
  app.use("/api/v1/catalog", createCatalogRouter(db));
  app.use("/api/v1/economy", createEconomyRouter(db));
  app.use("/api/v1/game", createGameRouter(db));
  app.use("/api/v1/notifications", createNotificationsRouter(db));
  app.use("/api/v1/platform-config", createPlatformConfigRouter(db));
  app.use("/api/v1/social", createSocialRouter(db));
  app.use("/api/v1/admin", createAdminRouter(db));
  app.use("/api/v1/admin", createAdminPlatformRouter(db));
  app.use("/api/v1/admin", createAdminEconomyRouter(db));
  app.use("/api/v1/admin", createAdminContentRouter(db, uploadDirectory));
  app.use("/api/v1/admin", createAdminCrmRouter(db));
  app.use("/api/v1/admin", createAdminOperationsRouter(db));
  app.use("/api/v1/admin", createAdminMobileAccessRouter(db));

  app.use("/site", express.static(siteDirectory, {
    etag: true,
    maxAge: config.environment === "production" ? "1h" : 0,
    index: false
  }));
  app.use("/uploads", express.static(uploadDirectory, {
    etag: true,
    immutable: config.environment === "production",
    maxAge: config.environment === "production" ? "1y" : 0,
    index: false,
    fallthrough: false
  }));
  app.get("/app", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path.join(siteDirectory, "app-production.html"));
  });
  app.get("/admin", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path.join(siteDirectory, "admin-production.html"));
  });
  if (!["production", "staging"].includes(config.environment)) {
    app.get("/demo", (_req: Request, res: Response) => {
      res.sendFile(path.join(siteDirectory, "index.html"));
    });
  }
  app.get("/", (_req: Request, res: Response) => {
    res.redirect(config.environment === "production" ? "/app" : "/demo");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
