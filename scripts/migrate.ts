import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../server/config.js";
import { createPool, transaction } from "../server/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "migrations");
const config = loadConfig();
const db = createPool(config.databaseUrl);

async function run(): Promise<void> {
  await db.query(`
    create table if not exists public.bali_schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
  const files = (await fs.readdir(directory))
    .filter(name => name.endsWith(".up.sql"))
    .sort();
  for (const filename of files) {
    const sql = await fs.readFile(path.join(directory, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const result = await transaction(db, async client => {
      const applied = await client.query<{ checksum: string }>(
        `select checksum from public.bali_schema_migrations where filename = $1 for update`,
        [filename]
      );
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${filename} has changed; create a new migration instead`);
        }
        return "skipped";
      }
      await client.query(sql);
      await client.query(
        `insert into public.bali_schema_migrations(filename, checksum) values ($1,$2)`,
        [filename, checksum]
      );
      return "applied";
    });
    if (result === "skipped") {
      console.log(`skip ${filename}`);
      continue;
    }
    console.log(`applied ${filename}`);
  }
}

run()
  .then(() => db.end())
  .catch(async error => {
    console.error(error);
    await db.end();
    process.exit(1);
  });
