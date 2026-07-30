import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required for a PostgreSQL backup");
const outputDirectory = path.resolve(process.env.BACKUP_DIRECTORY || "backups");
const uploadDirectory = path.resolve(process.env.BALI_UPLOAD_DIR || "var/uploads");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputPath = path.join(outputDirectory, `bali-${stamp}.dump`);
const uploadBackupPath = path.join(outputDirectory, `bali-${stamp}.uploads`);

async function command(binary: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${binary} exited with ${code}`)));
  });
}

async function sha256File(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const input = fs.createReadStream(filename);
    input.on("error", reject);
    input.on("data", chunk => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

async function mediaManifest(root: string): Promise<Array<{ file: string; bytes: number; sha256: string }>> {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fsPromises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(root);
  files.sort();
  return Promise.all(files.map(async file => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    bytes: (await fsPromises.stat(file)).size,
    sha256: await sha256File(file)
  })));
}

async function run(): Promise<void> {
  await fsPromises.mkdir(outputDirectory, { recursive: true });
  await command(process.env.PG_DUMP_BIN || "pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--file=${outputPath}`,
    databaseUrl
  ]);
  await command(process.env.PG_RESTORE_BIN || "pg_restore", ["--list", outputPath]);
  const checksum = await sha256File(outputPath);
  const stat = await fsPromises.stat(outputPath);
  const uploads = await mediaManifest(uploadDirectory);
  if (uploads.length) {
    await fsPromises.cp(uploadDirectory, uploadBackupPath, {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  }
  const manifest = {
    ok: true,
    backup: outputPath,
    bytes: stat.size,
    sha256: checksum,
    verifiedWithPgRestore: true,
    uploads: uploads.length ? uploadBackupPath : null,
    uploadFiles: uploads,
    createdAt: new Date().toISOString()
  };
  await fsPromises.writeFile(`${outputPath}.json`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
