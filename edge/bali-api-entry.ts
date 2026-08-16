import process from "node:process";
import express from "express";

const denoEnv = (globalThis as any).Deno?.env;
const runtimeEnv = {
  ...process.env,
  BALI_ENV: "production",
  DATABASE_URL: denoEnv?.get("SUPABASE_DB_URL") || process.env.SUPABASE_DB_URL || "",
  SESSION_SECRET: denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY") || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  TRUST_PROXY: "1",
  PORT: "8000"
};

const [{ createApp }, { loadConfig }, { createPool }] = await Promise.all([
  import("../server/app.js"),
  import("../server/config.js"),
  import("../server/db.js")
]);

const config = loadConfig(runtimeEnv);
const db = createPool(config.databaseUrl, 1);
await db.query("select 1");
const bali = createApp(db, config);
const edge = express();

edge.use((req, res) => {
  const prefixes = ["/functions/v1/bali-api", "/bali-api"];
  for (const prefix of prefixes) {
    if (req.url === prefix) req.url = "/";
    else if (req.url.startsWith(`${prefix}/`)) req.url = req.url.slice(prefix.length);
  }
  return bali(req, res);
});

edge.listen(8000, () => console.log("BALI Edge API listening on 8000"));
