import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(join(__dirname, 'check-frontend-db-reviewed-dynamics.mjs'), 'utf8');

test('reviewed dynamic gate is fail-closed and inventory-counted', () => {
  assert.match(script, /if \(!REVIEWED\.has\(key\)\) errors\.push\(`Unreviewed dynamic contract/);
  assert.match(script, /count !== expectedCount/);
  assert.match(script, /0 unreviewed dynamic contracts/);
});

test('generic receipt helper is constrained to explicit relations and columns', () => {
  for (const relation of ['invoices', 'contracts', 'units', 'properties', 'people']) {
    assert.match(script, new RegExp(`\\b${relation}: \\[`));
  }
  assert.match(script, /validateRelationColumns\(database, relation, columns, errors\)/);
});

test('scanner noise and type-asserted literal targets are not silently accepted', () => {
  assert.match(script, /isCommentOnlyDynamic/);
  assert.match(script, /assertedLiteral/);
  assert.match(script, /is missing from database\.ts/);
});
