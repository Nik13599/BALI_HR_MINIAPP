import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const nativeDirectory = path.resolve(scriptsDirectory, "..");
const repositoryDirectory = path.resolve(nativeDirectory, "..");
const source = path.join(repositoryDirectory, "site");
const destination = path.join(nativeDirectory, "www", "site");

if (!existsSync(source)) throw new Error(`BALI site directory not found: ${source}`);
mkdirSync(path.dirname(destination), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
console.log(`BALI web assets copied to ${destination}`);
