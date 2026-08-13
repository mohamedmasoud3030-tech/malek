#!/usr/bin/env node
// ============================================================================
// WP-05 GAP-018 — structural reproduction of the three reported subledger↔GL
// variances, on an ephemeral PGlite database built from the migration chain.
//
//   node scripts/wp05/reproduce-variances.mjs [--json <path>] [--quiet]
//
// Why this exists
//   The reported figures come from a hosted Supabase project that this
//   repository's CI (and any offline workstation) cannot read. Rather than
//   assert conclusions about data we cannot see, this harness reproduces the
//   *shape* of each variance from first principles on a clean database:
//   it seeds only real, schema-valid source records, posts GL through the
//   canonical kernel (post_journal_event), and then asks the GAP-018
//   diagnostics to classify what it finds.
//
//   A passing run proves the reason-code classifier maps each variance shape
//   to the correct cause and that no correction is ever posted.
//
// This script writes nothing outside the ephemeral database and the optional
// --json report path.
// ============================================================================

import { writeFile } from 'node:fs/promises';

import { createDatabase, replay } from '../db0/lib/replay.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;

const log = (...parts) => {
  if (!quiet) console.log(...parts);
};

const COMPANY_A = 'c0000000-0000-4000-8000-0000000000a1';
const COMPANY_B = 'c0000000-0000-4000-8000-0000000000b2';
const AS_OF = '2026-07-31';

const OWNER_A = 'c1000000-0000-4000-8000-0000000000a1';
const PROPERTY_A = 'c2000000-0000-4000-8000-0000000000a1';
const UNIT_A = 'c3000000-0000-4000-8000-0000000000a1';
const TENANT_A = 'c4000000-0000-4000-8000-0000000000a1';
const CONTRACT_A = 'c5000000-0000-4000-8000-0000000000a1';
const AGREEMENT_A = 'c6000000-0000-4000-8000-0000000000a1';
const PROP_OWNER_A = 'c7000000-0000-4000-8000-0000000000a1';

const OWNER_B = 'c1000000-0000-4000-8000-0000000000b2';
const PROPERTY_B = 'c2000000-0000-4000-8000-0000000000b2';

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}); cannot reproduce variances.`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}
log('Migration chain replayed into ephemeral PGlite.\n');

async function exec(sql, params) {
  try {
    return await db.query(sql, params);
  } catch (error) {
    const where = error?.where ? `\n  where: ${error.where}` : '';
    throw new Error(`SQL failed: ${error?.message ?? error}${where}\n  sql: ${sql.trim().split('\n')[0]}…`);
  }
}

async function post(company, sourceId, effectiveDate, lines) {
  const jsonLines = JSON.stringify(
    lines.map((l) => ({ account_no: l.no, debit: l.debit ?? 0, credit: l.credit ?? 0 })),
  );
  await exec(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'wp05_repro',
       'source_id', $2::text,
       'event_id', $2::text,
       'effective_date', $3::date,
       'description', 'WP-05 GAP-018 reproduction fixture',
       'lines', (
         select jsonb_agg(jsonb_build_object(
           'account_id', (select a.id from public.accounts a where a.company_id = $1::uuid and a.no = l->>'account_no'),
           'debit', (l->>'debit')::numeric,
           'credit', (l->>'credit')::numeric
         ))
         from jsonb_array_elements($4::jsonb) l
       )
     ))`,
    [company, sourceId, effectiveDate, jsonLines],
  );
}

// ---------------------------------------------------------------------------
// Base fixture: two companies, provisioned charts of accounts, one open period
// ---------------------------------------------------------------------------
for (const [id, name, slug] of [
  [COMPANY_A, 'WP05 Repro Company A', 'wp05-repro-a'],
  [COMPANY_B, 'WP05 Repro Company B', 'wp05-repro-b'],
]) {
  await exec(
    `insert into public.companies (id, name, slug, currency, is_active)
     values ($1, $2, $3, 'OMR', true) on conflict (id) do nothing`,
    [id, name, slug],
  );
  await exec('select public.provision_company_chart_of_accounts($1)', [id]);
  await exec(
    `insert into public.accounting_periods (company_id, name, start_date, end_date, status)
     values ($1, '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
     on conflict do nothing`,
    [id],
  );
}

await exec(
  `insert into public.owners (id, full_name, company_id, is_active) values
     ($1, 'Repro Owner A', $2, true), ($3, 'Repro Owner B', $4, true)
   on conflict (id) do nothing`,
  [OWNER_A, COMPANY_A, OWNER_B, COMPANY_B],
);
await exec(
  `insert into public.properties (id, title, type, address, status, owner_id, company_id) values
     ($1, 'Repro Property A', 'residential', 'Muscat', 'active', $2, $3),
     ($4, 'Repro Property B', 'residential', 'Muscat', 'active', $5, $6)
   on conflict (id) do nothing`,
  [PROPERTY_A, OWNER_A, COMPANY_A, PROPERTY_B, OWNER_B, COMPANY_B],
);
await exec(
  `insert into public.units (id, property_id, unit_number, company_id)
   values ($1, $2, 'A-01', $3) on conflict (id) do nothing`,
  [UNIT_A, PROPERTY_A, COMPANY_A],
);
await exec(
  `insert into public.people (id, full_name, type, company_id)
   values ($1, 'Repro Tenant A', 'tenant', $2) on conflict (id) do nothing`,
  [TENANT_A, COMPANY_A],
);
await exec(
  `insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id)
   values ($1, $2, $3, 100, true, date '2026-01-01', date '2026-12-31', $4)
   on conflict (id) do nothing`,
  [PROP_OWNER_A, PROPERTY_A, OWNER_A, COMPANY_A],
);
await exec(
  `insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
   values ($1, $2, $3, 'property_management', 'RATE', 5, date '2026-01-01', date '2026-12-31', $4)
   on conflict (id) do nothing`,
  [AGREEMENT_A, OWNER_A, PROPERTY_A, COMPANY_A],
);
await exec(
  `insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
   values ($1, $2, $3, $4, $5, date '2026-01-01', date '2026-12-31', 1000, 'active', $6)
   on conflict (id) do nothing`,
  [CONTRACT_A, PROPERTY_A, UNIT_A, TENANT_A, AGREEMENT_A, COMPANY_A],
);

log('Base fixture created: 2 companies, 18-account COA each, open period 2026-07.\n');

// ---------------------------------------------------------------------------
// Variance 1 — OWNER PAYABLES: subledger 12,405.000 vs GL 0.000
//
// Shape: owner_balances carries a net payable, but account 2000 has no posted
// journal line at all. Owner payable recognised operationally, never in the GL.
// ---------------------------------------------------------------------------
await exec(
  `insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
   values ($1, $2, 13050.000, 645.000, 0, 12405.000, now())
   on conflict (owner_id) do update set net_balance = excluded.net_balance`,
  [OWNER_A, COMPANY_A],
);
// No GL posting to 2000 for company A. That is the defect being reproduced.

// ---------------------------------------------------------------------------
// Variance 2 — SECURITY DEPOSITS: subledger 50.000 vs GL 100.000
//
// Shape: a 100.000 deposit was received and correctly credited to 2200, then
// 50.000 was applied against damages in the subledger. The application never
// produced the offsetting debit to 2200, so the liability stayed at 100.000.
// ---------------------------------------------------------------------------
await exec(
  `insert into public.tenant_deposits
     (id, contract_id, property_id, unit_id, tenant_id, deposit_amount, deducted_amount,
      refunded_amount, remaining_amount, status, received_date, company_id)
   values ('wp05-repro-dep-a1', $1, $2, $3, $4, 100.000, 50.000, 0, 50.000, 'held', date '2026-07-02', $5)
   on conflict (id) do update set remaining_amount = excluded.remaining_amount`,
  [CONTRACT_A, PROPERTY_A, UNIT_A, TENANT_A, COMPANY_A],
);
await post(COMPANY_A, 'repro-dep-receipt-a1', '2026-07-02', [
  { no: '1111', debit: 100.0 },
  { no: '2200', credit: 100.0 },
]);
// Deliberately absent: debit 2200 / credit 4300 for the 50.000 application.

// ---------------------------------------------------------------------------
// Variance 3 — TENANT RECEIVABLES: subledger 3,100.000 vs GL -7,230.000
//
// Shape: open invoices total 3,100.000. The GL carries the invoice debits but
// also 10,330.000 of credits posted straight to 1201 by collection events that
// never had an originating invoice debit, driving the debit-normal receivable
// account to a net credit balance.
// ---------------------------------------------------------------------------
const invoices = [
  ['c8000000-0000-4000-8000-0000000000a1', 1200.0, 0.0, '2026-07-03'],
  ['c8000000-0000-4000-8000-0000000000a2', 1500.0, 0.0, '2026-07-05'],
  ['c8000000-0000-4000-8000-0000000000a3', 400.0, 0.0, '2026-07-09'],
];
for (const [id, amount, paid, issue] of invoices) {
  await exec(
    `insert into public.invoices (id, contract_id, amount, paid_amount, tax_amount, issue_date, due_date, status, company_id)
     values ($1, $2, $3, $4, 0, $5::date, $5::date + 14, 'UNPAID', $6)
     on conflict (id) do update set amount = excluded.amount`,
    [id, CONTRACT_A, amount, paid, issue, COMPANY_A],
  );
  await post(COMPANY_A, `repro-inv-${id}`, issue, [
    { no: '1201', debit: amount },
    { no: '4100', credit: amount },
  ]);
}
// Collections credited to 1201 with no matching invoice debit.
await post(COMPANY_A, 'repro-unmatched-collection-1', '2026-07-15', [
  { no: '1111', debit: 6000.0 },
  { no: '1201', credit: 6000.0 },
]);
await post(COMPANY_A, 'repro-unmatched-collection-2', '2026-07-20', [
  { no: '1111', debit: 4330.0 },
  { no: '1201', credit: 4330.0 },
]);

// ---------------------------------------------------------------------------
// Control: company B is fully reconciled, to prove isolation and no false
// positives.
// ---------------------------------------------------------------------------
await exec(
  `insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
   values ($1, $2, 700.000, 0, 0, 700.000, now())
   on conflict (owner_id) do update set net_balance = excluded.net_balance`,
  [OWNER_B, COMPANY_B],
);
await post(COMPANY_B, 'repro-owner-b1', '2026-07-10', [
  { no: '1111', debit: 700.0 },
  { no: '2000', credit: 700.0 },
]);

log('Fixtures seeded for three variance shapes plus a reconciled control company.\n');

// ---------------------------------------------------------------------------
// Observe
// ---------------------------------------------------------------------------
const recon = await exec('select * from public.wp05_reconcile_all($1, $2::date)', [COMPANY_A, AS_OF]);
const diag = await exec('select * from public.wp05_variance_diagnostics($1, $2::date)', [COMPANY_A, AS_OF]);
const controlRecon = await exec('select * from public.wp05_reconcile_all($1, $2::date)', [COMPANY_B, AS_OF]);

const num = (v) => Number(v);
const fmt = (v) => num(v).toFixed(3).padStart(12);

log('Reconciliation — company A, as of ' + AS_OF);
log('-'.repeat(104));
log(
  'class'.padEnd(20) + 'acct'.padEnd(7) + 'subledger'.padStart(12) + 'gl'.padStart(13) +
  'variance'.padStart(13) + '  status  reason_code',
);
log('-'.repeat(104));
const byClass = new Map(diag.rows.map((r) => [r.reconciliation_class, r]));
for (const row of recon.rows) {
  const d = byClass.get(row.reconciliation_class);
  log(
    row.reconciliation_class.padEnd(20) + String(row.account_no).padEnd(7) +
    fmt(row.subledger_balance) + fmt(row.gl_balance) + fmt(row.variance) +
    '  ' + String(row.reconciliation_status).padEnd(6) + '  ' + (d?.reason_code ?? '-'),
  );
}
log('');

for (const d of diag.rows.filter((r) => r.reconciliation_status === 'FAIL')) {
  log(`${d.reconciliation_class} (${d.reason_code}) → ${d.proposal_type}`);
  log(`  ${d.reason_detail}`);
  log(`  action: ${d.recommended_action}`);
  log('');
}

const controlFailures = controlRecon.rows.filter((r) => r.reconciliation_status === 'FAIL');
log(
  `Control company B: ${controlRecon.rows.length - controlFailures.length}/${controlRecon.rows.length} classes PASS` +
  (controlFailures.length
    ? ` (FAIL: ${controlFailures.map((r) => r.reconciliation_class).join(', ')})`
    : ''),
);

// ---------------------------------------------------------------------------
// Assertions — the reproduction is only useful if it is checkable
// ---------------------------------------------------------------------------
const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`);
};

log('\nAssertions');
log('-'.repeat(104));

const owner = byClass.get('OWNER_PAYABLES');
check(
  'Owner payables reproduces 12405.000 vs 0.000',
  num(owner.subledger_balance) === 12405 && num(owner.gl_balance) === 0,
  `got ${owner.subledger_balance} vs ${owner.gl_balance}`,
);
check(
  'Owner payables classified GL_NO_POSTINGS_FOR_ACCOUNT',
  owner.reason_code === 'GL_NO_POSTINGS_FOR_ACCOUNT',
  `got ${owner.reason_code}`,
);

const dep = byClass.get('SECURITY_DEPOSITS');
check(
  'Security deposits reproduces 50.000 vs 100.000',
  num(dep.subledger_balance) === 50 && num(dep.gl_balance) === 100,
  `got ${dep.subledger_balance} vs ${dep.gl_balance}`,
);
check(
  'Security deposits classified SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL',
  dep.reason_code === 'SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL',
  `got ${dep.reason_code}`,
);
check(
  'Security deposit evidence carries the 50.000 unposted application',
  num(dep.evidence.deposit_applied_total) === 50,
  `got ${dep.evidence.deposit_applied_total}`,
);

const tr = byClass.get('TENANT_RECEIVABLES');
check(
  'Tenant receivables reproduces 3100.000 vs -7230.000',
  num(tr.subledger_balance) === 3100 && num(tr.gl_balance) === -7230,
  `got ${tr.subledger_balance} vs ${tr.gl_balance}`,
);
check(
  'Tenant receivables classified GL_CONTRA_BALANCE_ON_DEBIT_NORMAL',
  tr.reason_code === 'GL_CONTRA_BALANCE_ON_DEBIT_NORMAL',
  `got ${tr.reason_code}`,
);
check(
  'Tenant receivable evidence shows credits exceeding debits',
  num(tr.evidence.gl_credits) > num(tr.evidence.gl_debits),
  `debits ${tr.evidence.gl_debits}, credits ${tr.evidence.gl_credits}`,
);

check(
  'Control company B has no variance (no false positives, isolation holds)',
  controlFailures.length === 0,
  controlFailures.map((r) => r.reconciliation_class).join(', '),
);

// Proof: nothing in this lane ever posted to the GL.
const proofA = await exec('select public.wp05_assert_no_unapproved_correction_postings($1) as p', [COMPANY_A]);
const proof = proofA.rows[0].p;
check(
  'No GL batch originates from the correction-proposal lane',
  proof.success === true && proof.proposal_sourced_gl_batches === 0,
  JSON.stringify(proof),
);

const sources = await exec(
  `select distinct source_type from public.journal_batches where company_id = $1 order by 1`,
  [COMPANY_A],
);
check(
  'Only fixture source types exist in the GL',
  sources.rows.every((r) => r.source_type === 'wp05_repro'),
  sources.rows.map((r) => r.source_type).join(', '),
);

const failed = checks.filter((c) => !c.ok);
log('');
log('='.repeat(104));
log(`${checks.length - failed.length}/${checks.length} assertions passed.`);

if (jsonPath) {
  await writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        generated_by: 'scripts/wp05/reproduce-variances.mjs',
        environment: 'ephemeral PGlite built from supabase/migrations',
        note: 'Structural reproduction. Balances are seeded fixtures, not hosted production data.',
        as_of: AS_OF,
        company_a: COMPANY_A,
        company_b_control: COMPANY_B,
        reconciliation: recon.rows,
        diagnostics: diag.rows,
        control: controlRecon.rows,
        unapproved_posting_proof: proof,
        assertions: checks,
        passed: checks.length - failed.length,
        total: checks.length,
      },
      null,
      2,
    )}\n`,
  );
  log(`JSON report written to ${jsonPath}`);
}

await db.close();
process.exit(failed.length ? 1 : 0);
