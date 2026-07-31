import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const tests = readdirSync(path.resolve("tests"))
  .filter(file => file.endsWith("-smoke.mjs"))
  .sort();

let failures = 0;
for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join("tests", test)], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) failures += 1;
}

if (failures > 0) {
  console.error(`${failures} of ${tests.length} demo smoke tests failed`);
  process.exit(1);
}
console.log(`${tests.length} demo smoke tests passed`);
