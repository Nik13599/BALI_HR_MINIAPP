import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool, one } from "./db.js";
import { hashPassword } from "./security.js";

const config = loadConfig();
const db = createPool(config.databaseUrl);

async function bootstrapAdmin(): Promise<void> {
  if (!config.adminBootstrapEmail || !config.adminBootstrapPassword) return;
  const existing = await one(db, `select id from public.admin_users where email = $1`, [
    config.adminBootstrapEmail
  ]);
  if (existing) return;
  const passwordHash = await hashPassword(config.adminBootstrapPassword);
  await db.query(
    `insert into public.admin_users(email, password_hash, role)
     values ($1,$2,'superadmin')`,
    [config.adminBootstrapEmail, passwordHash]
  );
  console.log(`Bootstrap administrator created for ${config.adminBootstrapEmail}`);
}

async function start(): Promise<void> {
  await db.query("select 1");
  await bootstrapAdmin();
  const app = createApp(db, config);
  const server = app.listen(config.port, () => {
    console.log(`BALI server listening on :${config.port} (${config.environment})`);
  });
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(async () => {
      await db.end();
      process.exit(0);
    });
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch(async error => {
  console.error(error);
  await db.end();
  process.exit(1);
});
