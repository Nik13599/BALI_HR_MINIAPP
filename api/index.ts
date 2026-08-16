import type { Request, Response } from "express";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { createPool, one } from "../server/db.js";
import { hashPassword } from "../server/security.js";

const config = loadConfig();
const db = createPool(config.databaseUrl);
const app = createApp(db, config);

let initialization: Promise<void> | null = null;

async function initialize(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await db.query("select 1");
      if (!config.adminBootstrapEmail || !config.adminBootstrapPassword) return;
      const existing = await one(db, "select id from public.admin_users where email = $1", [
        config.adminBootstrapEmail
      ]);
      if (existing) return;
      const passwordHash = await hashPassword(config.adminBootstrapPassword);
      await db.query(
        `insert into public.admin_users(email, password_hash, role)
         values ($1,$2,'superadmin')
         on conflict (email) do nothing`,
        [config.adminBootstrapEmail, passwordHash]
      );
    })();
  }
  return initialization;
}

export default async function handler(req: Request, res: Response) {
  try {
    await initialize();
    return app(req, res);
  } catch (error) {
    console.error("BALI Vercel initialization failed", error);
    if (!res.headersSent) {
      return res.status(503).json({
        error: "service_unavailable",
        message: "BALI backend is not ready"
      });
    }
  }
}
