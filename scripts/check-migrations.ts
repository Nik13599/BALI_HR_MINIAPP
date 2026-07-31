import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "migrations");

async function run(): Promise<void> {
  const names = await fs.readdir(directory);
  const upFiles = names.filter(name => name.endsWith(".up.sql")).sort();
  const downFiles = new Set(names.filter(name => name.endsWith(".down.sql")));
  if (!upFiles.length) throw new Error("No versioned migrations were found");
  const versions = new Set<string>();
  const report: Array<{ filename: string; checksum: string; rollback: string }> = [];
  for (const filename of upFiles) {
    const match = /^(\d{3})_[a-z0-9_]+\.up\.sql$/.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    if (versions.has(match[1])) throw new Error(`Duplicate migration version: ${match[1]}`);
    versions.add(match[1]);
    const rollback = filename.replace(/\.up\.sql$/, ".down.sql");
    if (!downFiles.has(rollback)) throw new Error(`Rollback file is missing: ${rollback}`);
    const [upSql, downSql] = await Promise.all([
      fs.readFile(path.join(directory, filename), "utf8"),
      fs.readFile(path.join(directory, rollback), "utf8")
    ]);
    for (const [kind, sql] of [["up", upSql], ["down", downSql]] as const) {
      if (/^\s*(begin|commit|rollback)\s*;/im.test(sql)) {
        throw new Error(`${filename} ${kind} contains transaction control; the runner owns transactions`);
      }
      if (!sql.trim()) throw new Error(`${filename} ${kind} is empty`);
    }
    report.push({
      filename,
      checksum: createHash("sha256").update(upSql).digest("hex"),
      rollback
    });
  }
  console.log(JSON.stringify({ ok: true, migrations: report }, null, 2));
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
