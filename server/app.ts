import { randomUUID } from "node:crypto";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Request, Response } from "express";
import { createAuthRouter } from "./routes/auth.js";
import { createClanRouter } from "./routes/clans.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPeopleRouter } from "./routes/people.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { optionalAdmin, optionalUser } from "./middleware/auth.js";
import type { AppConfig, Queryable } from "./types.js";

const siteDirectory = path.resolve(process.cwd(), "site");

export function createApp(db: Queryable, config: AppConfig) {
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
        scriptSrc: ["'self'", "'unsafe-inline'", "https://telegram.org"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(optionalUser(db, config));
  app.use(optionalAdmin(db, config));

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, environment: config.environment });
  });
  app.get("/api/v1/config/public", (_req, res) => {
    res.json({
      environment: config.environment,
      telegramBotUrl: config.telegramBotUrl,
      demoAvailable: !["production", "staging"].includes(config.environment)
    });
  });
  app.use("/api/v1/auth", createAuthRouter(db, config));
  app.use("/api/v1/clans", createClanRouter(db));
  app.use("/api/v1/people", createPeopleRouter(db));
  app.use("/api/v1/admin", createAdminRouter(db));

  app.use("/site", express.static(siteDirectory, {
    etag: true,
    maxAge: config.environment === "production" ? "1h" : 0,
    index: false
  }));
  app.get("/app", (_req: Request, res: Response) => {
    res.sendFile(path.join(siteDirectory, "telegram-app.html"));
  });
  app.get("/admin", (_req: Request, res: Response) => {
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
