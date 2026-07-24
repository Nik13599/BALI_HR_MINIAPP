import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const site = path.join(root, 'site');
const required = [
  'index.html',
  'admin.html',
  'admin-production.html',
  'config.js',
  'store.js',
  'bali-rebuild-user-v1.js',
  'bali-rebuild-user-v1.css',
  'bali-rebuild-admin-v1.js',
  'bali-rebuild-admin-v1.css'
];

const missing = required.filter(file => !fs.existsSync(path.join(site, file)));
if (missing.length) {
  console.error('Missing rebuild files:\n' + missing.map(file => ` - site/${file}`).join('\n'));
  process.exit(1);
}

const syntaxErrors = [];
for (const file of required.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join(site, file)], { encoding:'utf8' });
  if (result.status !== 0) syntaxErrors.push({ file, output:result.stderr || result.stdout });
}
if (syntaxErrors.length) {
  for (const error of syntaxErrors) console.error(`Syntax error in site/${error.file}:\n${error.output}`);
  process.exit(1);
}

const index = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(site, 'admin-production.html'), 'utf8');
if (index.includes('bali-production-loader-11.js')) throw new Error('Legacy user loader is still connected');
if (!index.includes('bali-rebuild-user-v1.js')) throw new Error('Clean user rebuild is not connected');
if (admin.includes('admin.js?v=')) throw new Error('Legacy admin runtime is still connected');
if (!admin.includes('bali-rebuild-admin-v1.js')) throw new Error('Clean admin rebuild is not connected');

console.log(`Validated clean rebuild: ${required.length} files; legacy UI loaders disconnected.`);
