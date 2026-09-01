import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('./pilot-demo-seed.mjs', import.meta.url), 'utf8');

test('pilot seed fails closed against production and requires explicit QA mutation approval', () => {
  assert.match(source, /Refusing to seed the MALEK pilot demo against Production/);
  assert.match(source, /QA_MUTATION_APPROVED !== '1'/);
  assert.match(source, /\['local', 'qa'\]/);
});

test('pilot financial activity stays behind canonical RPC commands', () => {
  for (const rpc of [
    'create_contract_atomic_v2',
    'submit_contract_for_approval_atomic',
    'approve_contract_atomic',
    'activate_contract_with_agreement_snapshot_atomic',
    'generate_invoices_from_active_contracts',
    'record_invoice_payment_atomic',
    'create_expense_with_journal_atomic',
  ]) assert.ok(source.includes(rpc), `missing canonical RPC ${rpc}`);

  assert.doesNotMatch(source, /service\.from\(['"](?:payments|receipts|journal_entries|journal_lines|expenses)['"]\)\.insert/);
});

test('pilot dataset contains the promised presentation shape', () => {
  assert.match(source, /const owners = \[/);
  assert.match(source, /const properties = \[/);
  assert.match(source, /const units = \[/);
  assert.match(source, /const tenants = \[/);
  assert.match(source, /paidRatio: 1/);
  assert.match(source, /paidRatio: 0\.5/);
  assert.match(source, /paidRatio: 0/);
  assert.match(source, /charged_to: 'OWNER'/);
  assert.match(source, /charged_to: 'COMPANY'/);
});
