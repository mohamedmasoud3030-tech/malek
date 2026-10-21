#!/usr/bin/env node
/**
 * MALEK — SQL signature documentation guard.
 *
 * Operating documents that tell a human or an accountant to run a function are written by hand, and
 * the schema moves. A wrong argument list in a sign-off packet is worse than no packet: the operator
 * follows it, the call fails, and the review stalls — or, if the names are similar enough, it silently
 * runs something else.
 *
 * This guard replays the migration chain into PGlite, reads `pg_get_function_identity_arguments`, and
 * compares every function signature declared between `<!-- sql-signatures:start -->` and
 * `<!-- sql-signatures:end -->` markers in the marked documentation files.
 *
 * What it checks: the function exists and its argument list matches exactly (after whitespace
 * normalisation). What it does not check: return types, default values, or that the document's prose
 * description of the function is correct.
 *
 * Usage:
 *   node scripts/check-sql-signature-docs.mjs
 *   node scripts/check-sql-signature-docs.mjs --json .gate/sql-signature-docs.json
 *
 * Exit codes: 0 = all documented signatures match, 1 = drift, 2 = usage/environment error.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import { createDatabase, replay } from './db0/lib/replay.mjs';

const MARKED_DOCUMENTS = ['docs/accounting/S08_SIGN_OFF_PACKET_AR.md'];
const START = '<!-- sql-signatures:start -->';
const END = '<!-- sql-signatures:end -->';

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex !== -1 ? args[jsonIndex + 1] : null;

function normaliseArguments(value) {
  return value
    // The document writes "(args)"; pg_get_function_identity_arguments returns "args".
    .replace(/^\s*\(/, '')
    .replace(/\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

/** Extracts `| \`fn\` | \`(args) → ret\` |` rows between the markers. */
function extractDeclarations(markdown) {
  const declarations = [];
  let inside = false;
  for (const line of markdown.split('\n')) {
    if (line.includes(START)) {
      inside = true;
      continue;
    }
    if (line.includes(END)) {
      inside = false;
      continue;
    }
    if (!inside) continue;
    // Capture up to the FIRST closing paren so a trailing return type cannot prevent a match.
    const match = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|\s*`(\([^`]*?\))/i);
    if (!match) continue;
    declarations.push({ name: match[1], arguments: normaliseArguments(match[2]) });
  }
  return declarations;
}

const declarations = [];
const missingDocuments = [];
for (const file of MARKED_DOCUMENTS) {
  const absolute = resolve(process.cwd(), file);
  if (!existsSync(absolute)) {
    missingDocuments.push(file);
    continue;
  }
  for (const declaration of extractDeclarations(readFileSync(absolute, 'utf8'))) {
    declarations.push({ ...declaration, document: file });
  }
}

if (missingDocuments.length > 0) {
  console.error(`Document(s) not found: ${missingDocuments.join(', ')}`);
  process.exit(2);
}
if (declarations.length === 0) {
  console.error('No marked SQL signature declarations found. Did the document markers move?');
  process.exit(2);
}

const db = await createDatabase();
const replayResult = await replay(db, { stopOnError: false });
if (replayResult.failures.length > 0) {
  console.error(`Migration replay failed (${replayResult.failures.length}); cannot verify signatures.`);
  process.exit(2);
}

const rows = await db.query(`
  select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
`);
await db.close();

const actual = new Map();
for (const row of rows.rows) {
  const key = row.name;
  if (!actual.has(key)) actual.set(key, []);
  actual.get(key).push(normaliseArguments(row.args));
}

const results = declarations.map((declaration) => {
  const candidates = actual.get(declaration.name);
  if (!candidates) {
    return { ...declaration, status: 'MISSING_FUNCTION' };
  }
  if (candidates.includes(declaration.arguments)) {
    return { ...declaration, status: 'MATCH' };
  }
  if (candidates.some((candidate) => candidate.startsWith(declaration.arguments.split(' ')[0]))) {
    return { ...declaration, status: 'ARGUMENT_DRIFT', actual: candidates };
  }
  return { ...declaration, status: 'UNKNOWN_OVERLOAD', actual: candidates };
});

const failures = results.filter((result) => result.status !== 'MATCH');

if (jsonPath) {
  mkdirSync(resolve(process.cwd(), dirname(jsonPath)), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), jsonPath),
    `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), checked: results.length, failures, results }, null, 2)}\n`,
  );
}

console.log('SQL signature documentation guard');
console.log(`  documents checked : ${MARKED_DOCUMENTS.length}`);
console.log(`  signatures checked: ${results.length}`);

if (failures.length === 0) {
  console.log('  PASS — every documented signature matches the replayed schema.');
  process.exit(0);
}

console.error(`  FAIL — ${failures.length} documented signature(s) do not match the schema:`);
for (const failure of failures) {
  console.error(`    ${failure.document}`);
  console.error(`      ${failure.name}${failure.arguments}  -> ${failure.status}`);
  if (failure.actual) console.error(`      schema has: ${failure.actual.join(' | ')}`);
}
console.error('');
console.error('Fix the document (or the migration). An operator will copy these signatures verbatim.');
process.exit(1);
