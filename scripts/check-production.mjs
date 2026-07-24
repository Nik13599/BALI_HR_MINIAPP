import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const site = path.join(root, 'site');
const required = [
  'index.html',
  'bali-app-6.html',
  'admin.html',
  'admin-production.html',
  'config.js',
  'store.js',
  'bali-rebuild-user-v1.js',
  'bali-rebuild-user-v1.css',
  'bali-rebuild-contact-actions-v1.js',
  'bali-rebuild-admin-bootstrap-v1.js',
  'bali-rebuild-admin-v1.css',
  'bali-rebuild-admin-v2.css',
  'bali-rebuild-admin-v2.js'
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
const userEntry = fs.readFileSync(path.join(site, 'bali-app-6.html'), 'utf8');
const admin = fs.readFileSync(path.join(site, 'admin-production.html'), 'utf8');
const config = fs.readFileSync(path.join(site, 'config.js'), 'utf8');

if (!index.includes('bali-app-6.html')) throw new Error('Legacy /site/ entry does not redirect to R6');
if (userEntry.includes('bali-production-loader-11.js')) throw new Error('Legacy user loader is connected to R6');
if (!userEntry.includes('bali-rebuild-user-v1.js') || !userEntry.includes('bali-rebuild-contact-actions-v1.js')) throw new Error('R6 user rebuild is incomplete');
if (!userEntry.includes('id="baliR6Badge"') || !userEntry.includes('data-bali-entry="R6"')) throw new Error('R6 diagnostic marker is missing');
if (!config.includes('/site/bali-app-6.html')) throw new Error('Application config does not point to R6');
if (admin.includes('admin.js?v=') || admin.includes('bali-rebuild-admin-v1.js')) throw new Error('Legacy admin runtime is still connected');
if (!admin.includes('bali-rebuild-admin-v2.js') || !admin.includes('bali-rebuild-admin-bootstrap-v1.js') || !admin.includes('bali-rebuild-admin-v2.css')) throw new Error('Complete admin rebuild is incomplete');

console.log(`Validated cache-isolated R6 build: ${required.length} files; legacy UI runtimes disconnected.`);
