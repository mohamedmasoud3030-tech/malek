#!/usr/bin/env node
// Privileged-key exposure scan.
//
// Proves the browser/client surface never ships a service-role key, private
// key, or Production-only secret. This is the lowest-cost proof that the
// client cannot impersonate the server. It does not connect to any database.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const CLIENT_ROOTS = [
  join(ROOT, 'rentrix-app', 'src'),
  join(ROOT, 'rentrix-app', 'public'),
  join(ROOT, 'rentrix-app', 'index.html'),
];

const ALLOWED_TEST_MARKERS = new Set([
  'rentrix-app/src/lib/supabase-client-boundary.test.ts',
  'rentrix-app/src/lib/env-validation.test.ts',
]);

const FORBIDDEN = [
  { id: 'SERVICE_ROLE_KEY', pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { id: 'sb_secret', pattern: /sb_secret_/ },
  { id: 'service_role_jwt_role', pattern: /["']role["']\s*:\s*["']service_role["']/ },
  { id: 'BEGIN_PRIVATE_KEY', pattern: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { id: 'openai_key', pattern: /OPENAI_API_KEY/ },
  { id: 'sk_proj', pattern: /sk-proj-/ },
  { id: 'service_role_createClient', pattern: /createClient\([^)]*SERVICE_ROLE/i },
];

const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report']);

function walk(entry, files = []) {
  const stats = statSync(entry);
  if (stats.isDirectory()) {
    if (SKIP_DIR.has(entry.split('/').pop())) return files;
    for (const child of readdirSync(entry)) walk(join(entry, child), files);
    return files;
  }
  if (/\.(test|spec)\./i.test(entry)) return files;
  if (/\.(ts|tsx|js|jsx|mjs|cjs|html|json|svg|txt|md)$/i.test(entry)) files.push(entry);
  return files;
}

const files = CLIENT_ROOTS.flatMap((root) => {
  try {
    return walk(root);
  } catch {
    return [];
  }
});

const findings = [];
for (const file of files) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (ALLOWED_TEST_MARKERS.has(rel)) continue;
  const text = readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) {
      findings.push({ file: rel, rule: rule.id });
    }
  }
}

const supabaseClient = readFileSync(join(ROOT, 'rentrix-app', 'src', 'lib', 'supabase.ts'), 'utf8');
const envSource = readFileSync(join(ROOT, 'rentrix-app', 'src', 'lib', 'env.ts'), 'utf8');

const contractFindings = [];
if (!/env\.supabaseAnonKey/.test(supabaseClient)) {
  contractFindings.push('supabase.ts does not construct the browser client from env.supabaseAnonKey');
}
if (/SERVICE_ROLE|service_role|sb_secret_/.test(supabaseClient)) {
  contractFindings.push('supabase.ts references a privileged key');
}
if (!/VITE_SUPABASE_ANON_KEY/.test(envSource)) {
  contractFindings.push('env.ts does not read the public anon key');
}
if (/SERVICE_ROLE|sb_secret_/.test(envSource)) {
  contractFindings.push('env.ts references a privileged key');
}

const failed = findings.length + contractFindings.length;
console.log('Privileged-key exposure scan');
console.log('='.repeat(60));
console.log(`Client files scanned : ${files.length}`);
console.log(`Forbidden markers    : ${findings.length}`);
console.log(`Client contract      : ${contractFindings.length ? 'FAIL' : 'PASS'}`);

if (findings.length) {
  console.log('\nForbidden markers in browser/client files:');
  for (const finding of findings) console.log(`  ${finding.rule}  ${finding.file}`);
}
if (contractFindings.length) {
  console.log('\nClient construction contract:');
  for (const finding of contractFindings) console.log(`  - ${finding}`);
}

if (failed) {
  console.log('\nFAIL — privileged material is visible to the client.');
  process.exit(1);
}

console.log('\nPASS — browser client uses only the public anon key.');
process.exit(0);
