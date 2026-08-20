#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = baseIndex >= 0 ? args[baseIndex + 1] : 'origin/main';

const protectedPatterns = [
  /^supabase\//,
  /^rentrix-app\/src\/types\/database\.ts$/,
];

function changedFiles() {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  return output.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
}

function hasDatabaseChangeApproval() {
  if (process.env.ALLOW_DB_CHANGE === '1') return true;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return false;
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const labels = event?.pull_request?.labels ?? [];
    return labels.some((label) => String(label?.name ?? '').toLowerCase() === 'database-change');
  } catch {
    return false;
  }
}

const files = changedFiles();
const protectedChanges = files.filter((file) => protectedPatterns.some((pattern) => pattern.test(file)));

if (protectedChanges.length === 0) {
  console.log('DB freeze: PASS — no protected database contract files changed.');
  process.exit(0);
}

if (hasDatabaseChangeApproval()) {
  console.log('DB freeze: APPROVED — protected database files changed under explicit database-change authorization.');
  for (const file of protectedChanges) console.log(`  ${file}`);
  process.exit(0);
}

console.error('DB freeze: FAIL — protected database files changed without explicit database-change authorization.');
console.error('Normal frontend/redesign/test/docs work must not modify the canonical database contract.');
console.error('If this is an intentional database PR, add the `database-change` PR label (or set ALLOW_DB_CHANGE=1 in an authorized DB workflow).');
for (const file of protectedChanges) console.error(`  ${file}`);
process.exit(1);
