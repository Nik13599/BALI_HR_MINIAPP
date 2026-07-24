import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const site = path.join(root, 'site');
const required = new Set([
  'index.html',
  'admin.html',
  'admin-production.html',
  'bali-production-loader-11.js'
]);

function addLocal(reference) {
  const clean = String(reference || '').split('?')[0].replace(/^\.\//, '');
  if (!clean || /^https?:/i.test(clean) || clean.startsWith('//')) return;
  required.add(clean);
}

function scanText(file) {
  const text = fs.readFileSync(path.join(site, file), 'utf8');
  for (const match of text.matchAll(/(?:load|optional|loadStyle)\(\s*["']([^"']+)["']/g)) addLocal(match[1]);
  for (const match of text.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)) addLocal(match[1]);
}

scanText('index.html');
scanText('admin.html');
scanText('admin-production.html');
scanText('bali-production-loader-11.js');

const missing = [...required].filter(file => !fs.existsSync(path.join(site, file)));
if (missing.length) {
  console.error('Missing production files:\n' + missing.map(file => ` - site/${file}`).join('\n'));
  process.exit(1);
}

const jsFiles = [...required].filter(file => file.endsWith('.js'));
const syntaxErrors = [];
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(site, file)], { encoding: 'utf8' });
  if (result.status !== 0) syntaxErrors.push({ file, output: result.stderr || result.stdout });
}
if (syntaxErrors.length) {
  for (const error of syntaxErrors) console.error(`Syntax error in site/${error.file}:\n${error.output}`);
  process.exit(1);
}

const loader = fs.readFileSync(path.join(site, 'bali-production-loader-11.js'), 'utf8');
const version = loader.match(/const version\s*=\s*["']([^"']+)/)?.[1] || '';
if (!/^bali-production-\d+$/.test(version)) {
  console.error(`Invalid production version in loader: ${version || '(missing)'}`);
  process.exit(1);
}

console.log(`Validated ${required.size} production files; ${jsFiles.length} JavaScript files passed node --check; build ${version}.`);