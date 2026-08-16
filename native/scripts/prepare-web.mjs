import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const nativeDirectory = path.resolve(scriptsDirectory, "..");
const repositoryDirectory = path.resolve(nativeDirectory, "..");
const source = path.join(repositoryDirectory, "site");
const destination = path.join(nativeDirectory, "www", "site");
const rootAssetsSource = path.join(source, "assets");
const rootAssetsDestination = path.join(nativeDirectory, "www", "assets");

const requiredMatch3Assets = [
  "assets/match3/headphones.webp",
  "assets/match3/martini.webp",
  "assets/match3/palm.webp",
  "assets/match3/turntable.webp",
  "assets/match3/disco.webp",
  "assets/match3/mask.webp",
  "assets/match3/lotus.webp",
  "assets/match3/triangle.webp",
  "assets/match3/background.webp",
  "assets/match3/reward.webp",
];

if (!existsSync(source)) throw new Error(`BALI site directory not found: ${source}`);
for (const relativePath of requiredMatch3Assets) {
  const absolutePath = path.join(source, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Required BALI Match asset is missing: ${relativePath}`);
  }
}

mkdirSync(path.dirname(destination), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

// stable27 home-reference-page-beta4.js intentionally uses ./assets/* from the document root.
// Keep that contract in Capacitor and MobileConfig builds while also retaining ./site/assets/*.
if (existsSync(rootAssetsSource)) {
  rmSync(rootAssetsDestination, { recursive: true, force: true });
  cpSync(rootAssetsSource, rootAssetsDestination, { recursive: true });
}

for (const relativePath of requiredMatch3Assets) {
  const copiedPath = path.join(destination, relativePath);
  if (!existsSync(copiedPath)) {
    throw new Error(`Required BALI Match asset was not bundled: ${relativePath}`);
  }
  const rootCopiedPath = path.join(nativeDirectory, "www", relativePath);
  if (!existsSync(rootCopiedPath)) {
    throw new Error(`Required stable27 root asset was not bundled: ${relativePath}`);
  }
}

console.log(`BALI web assets copied to ${destination}`);
console.log(`BALI stable27 root assets copied to ${rootAssetsDestination}`);
console.log(`BALI Match assets verified: ${requiredMatch3Assets.length}`);
