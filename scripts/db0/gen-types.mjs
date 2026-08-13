#!/usr/bin/env node
// WP-DB0 — regenerate `rentrix-app/src/types/database.ts` from the migrations.
//
//   node scripts/db0/gen-types.mjs           # write the file
//   node scripts/db0/gen-types.mjs --check   # fail if the file is out of date
//   node scripts/db0/gen-types.mjs --stdout  # print instead of writing

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT, createDatabase, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';
import { generateTypes } from './lib/gen-types.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const toStdout = args.includes('--stdout');
const TARGET = join(ROOT, 'rentrix-app', 'src', 'types', 'database.ts');

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}); refusing to generate types.`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}
const schema = await introspect(db);
await db.close();

const generated = generateTypes({ schema });

if (toStdout) {
  process.stdout.write(generated);
  process.exit(0);
}

if (check) {
  let current = '';
  try {
    current = await readFile(TARGET, 'utf8');
  } catch {
    /* missing file counts as drift */
  }
  if (current !== generated) {
    console.error('Schema/type drift: rentrix-app/src/types/database.ts does not match the migration chain.');
    console.error('Run `pnpm db0:gen-types` and commit the result.');
    process.exit(1);
  }
  console.log('database.ts matches the migration chain.');
  process.exit(0);
}

await writeFile(TARGET, generated);
console.log(
  `Wrote ${TARGET}\n  ${schema.tables.length} tables, ${schema.views.length} views, ` +
    `${schema.functions.length} functions, ${schema.enums.length} enums.`,
);
