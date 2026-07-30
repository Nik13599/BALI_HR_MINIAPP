import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, transaction } from "../server/db.js";

const databaseUrl = process.env.DATABASE_URL || "";
const target = String(process.env.ROLLBACK_TO || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!/^\d{3}_[a-z0-9_]+\.up\.sql$/.test(target)) {
  throw new Error("ROLLBACK_TO must be an applied .up.sql filename to keep");
}
if (process.env.CONFIRM_ROLLBACK !== "YES") {
  throw new Error("Set CONFIRM_ROLLBACK=YES after verifying a current backup");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "migrations");
const db = createPool(databaseUrl);

async function run(): Promise<void> {
  const applied = await db.query<{ filename: string }>(
    `select filename from public.bali_schema_migrations
      order by filename desc`
  );
  if (!applied.rows.some(row => row.filename === target)) {
    throw new Error(`Rollback target is not applied: ${target}`);
  }
  const toRollback = applied.rows
    .map(row => row.filename)
    .filter(filename => filename > target);
  for (const filename of toRollback) {
    const rollbackFile = filename.replace(/\.up\.sql$/, ".down.sql");
    const sql = await fs.readFile(path.join(directory, rollbackFile), "utf8");
    await transaction(db, async client => {
      await client.query(sql);
      await client.query(
        `delete from public.bali_schema_migrations where filename = $1`,
        [filename]
      );
    });
    console.log(`rolled back ${filename} with ${rollbackFile}`);
  }
  console.log(`rollback complete; current target is ${target}`);
}

run()
  .finally(() => db.end())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
