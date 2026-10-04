import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260901000021_browser_rpc_canonical_identity_guards.sql',
);

test('browser RPC guard locates a full BEGIN line for LF and CRLF function definitions', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /def := replace\(def, E'\\r\\n', E'\\n'\);/);

  const db = new PGlite();
  try {
    for (const [label, newline] of [['LF', '\n'], ['CRLF', '\r\n']]) {
      const body = `${newline}begin${newline}  return;${newline}end;${newline}`;
      await db.exec(`create or replace function public.guard_line_ending_probe() returns void language plpgsql as $body$${body}$body$;`);
      const { rows: [{ definition }] } = await db.query(
        "select pg_get_functiondef('public.guard_line_ending_probe()'::regprocedure) as definition",
      );
      if (label === 'CRLF') {
        assert.ok(definition.includes('\r\nbegin\r\n'));
        assert.equal(definition.includes('\nbegin\n'), false);
      }
      const normalized = definition.replaceAll('\r\n', '\n');

      assert.ok(
        normalized.includes('\nbegin\n') || normalized.includes('\nBEGIN\n'),
        `${label} definition should expose a complete BEGIN line after the migration's normalization`,
      );
    }
  } finally {
    await db.close();
  }
});

test('co-ownership migration matches mixed-line-ending anchors and retains its fail-closed precondition', async () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260909000018_owner_expense_coownership_allocation_authority.sql',
  );
  const migration = await readFile(migrationPath, 'utf8');
  assert.equal((migration.match(/d := replace\(d, E'\\r\\n', E'\\n'\);/g) ?? []).length, 3);
  assert.equal((migration.match(/needle := replace\(needle, E'\\r\\n', E'\\n'\);/g) ?? []).length, 3);
  assert.match(migration, /OWNER_EXPENSE_COOWNERSHIP_STATEMENT_PRECONDITION/);

  const db = new PGlite();
  try {
    const body = '\r\nbegin\r\n  if true then\r\n    perform 1;\n    perform 2;\r\n  end if;\r\nend;\r\n';
    await db.exec(`create function public.mixed_anchor_probe() returns void language plpgsql as $body$${body}$body$;`);
    const { rows: [{ definition }] } = await db.query(
      "select pg_get_functiondef('public.mixed_anchor_probe()'::regprocedure) as definition",
    );
    const needle = '    perform 1;\r\n    perform 2;';

    assert.ok(definition.includes('    perform 1;\n    perform 2;'));
    assert.equal(definition.includes(needle), false);

    const normalizedDefinition = definition.replaceAll('\r\n', '\n');
    const normalizedNeedle = needle.replaceAll('\r\n', '\n');
    assert.equal(normalizedDefinition.split(normalizedNeedle).length - 1, 1);
    assert.equal(normalizedDefinition.split('    perform MISSING;\n    perform 2;').length - 1, 0);
  } finally {
    await db.close();
  }
});
