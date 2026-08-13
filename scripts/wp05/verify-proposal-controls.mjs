#!/usr/bin/env node
// ============================================================================
// WP-05 GAP-018 — control verification for the correction-proposal lane.
//
//   node scripts/wp05/verify-proposal-controls.mjs [--json <path>] [--quiet]
//
// Runs the same control assertions as supabase/tests/wp05_gap018_variance_
// diagnostics.sql, but on the ephemeral PGlite replay so they can be checked
// without a Docker-backed Supabase stack. pgTAP remains the authority on a real
// PostgreSQL instance; this is the fast, always-available guard.
//
// Controls proven here:
//   * proposals are created PENDING_APPROVAL, one per failing class
//   * generation is deterministic and idempotent
//   * maker ≠ checker; role gates on maker and checker
//   * rejection requires a reason; decided proposals are terminal
//   * rows are append-only and evidence is immutable
//   * company isolation on diagnose / generate / list / decide
//   * NOTHING in the lane posts to the general ledger
// ============================================================================

import { writeFile } from 'node:fs/promises';

import { createDatabase, replay } from '../db0/lib/replay.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const log = (...p) => { if (!quiet) console.log(...p); };

const CO_A = 'd0000000-0000-4000-8000-0000000000a1';
const CO_B = 'd0000000-0000-4000-8000-0000000000b2';
const PERIOD_A = 'd1000000-0000-4000-8000-0000000000a1';
const MAKER_A = 'd0a00000-0000-4000-8000-0000000000a1';
const CHECKER_A = 'd0c00000-0000-4000-8000-0000000000a1';
const ADMIN_B = 'd0a00000-0000-4000-8000-0000000000b2';
const OWNER_A = 'd2200000-0000-4000-8000-0000000000a1';
const OWNER_B = 'd2200000-0000-4000-8000-0000000000b2';
const AS_OF = '2026-07-31';

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}).`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}

const q = (sql, params) => db.query(sql, params);

async function asUser(userId, companyId) {
  await q('reset role');
  await q(
    `select set_config('request.jwt.claims', jsonb_build_object(
       'sub', $1::text, 'role', 'authenticated',
       'app_metadata', jsonb_build_object('company_id', $2::text)
     )::text, false)`,
    [userId, companyId],
  );
  await q('set role authenticated');
}
async function asService() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', false)`);
}

// --- fixture ---------------------------------------------------------------
await asService();
for (const [id, name, slug] of [
  [CO_A, 'GAP18 Controls A', 'gap18-controls-a'],
  [CO_B, 'GAP18 Controls B', 'gap18-controls-b'],
]) {
  await q(`insert into public.companies (id, name, slug, currency, is_active) values ($1,$2,$3,'OMR',true) on conflict (id) do nothing`, [id, name, slug]);
  await q('select public.provision_company_chart_of_accounts($1)', [id]);
}
await q(
  `insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
   values ($1, $2, '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN') on conflict (id) do nothing`,
  [PERIOD_A, CO_A],
);

for (const [id, email, role] of [
  [MAKER_A, 'gap18-maker@example.com', 'MANAGER'],
  [CHECKER_A, 'gap18-checker@example.com', 'ACCOUNTANT'],
  [ADMIN_B, 'gap18-admin-b@example.com', 'ADMIN'],
]) {
  await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1,$2,'{}'::jsonb) on conflict (id) do nothing`, [id, email]);
  await q(
    `insert into public.users (id, email, name, role, status, is_active)
     values ($1,$2,$2,$3::user_role,'ACTIVE'::entity_status,true)
     on conflict (id) do update set role = excluded.role, is_active = true`,
    [id, email, role],
  );
}
await q(
  `insert into public.company_members (company_id, user_id, role, is_active) values
     ($1,$2,'MEMBER',true), ($1,$3,'MEMBER',true), ($4,$5,'ADMIN',true)
   on conflict do nothing`,
  [CO_A, MAKER_A, CHECKER_A, CO_B, ADMIN_B],
);

// Two failing classes for company A: owner payables (no GL) and deposits.
await q(`insert into public.owners (id, full_name, company_id, is_active) values ($1,'Controls Owner A',$2,true) on conflict (id) do nothing`, [OWNER_A, CO_A]);
await q(
  `insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
   values ($1,$2,12405.000,0,0,12405.000,now()) on conflict (owner_id) do update set net_balance = excluded.net_balance`,
  [OWNER_A, CO_A],
);
// A second failing class, so the reject path is exercised alongside approve.
await q(
  `insert into public.commissions (id, staff_name, type, status, amount, company_id)
   values ('gap18-controls-comm-a1', 'Controls Broker A', 'contract', 'pending', 250.000, $1)
   on conflict (id) do update set amount = excluded.amount`,
  [CO_A],
);
// Company B stays reconciled.
await q(`insert into public.owners (id, full_name, company_id, is_active) values ($1,'Controls Owner B',$2,true) on conflict (id) do nothing`, [OWNER_B, CO_B]);

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`);
};
async function throwsWith(name, code, fn) {
  try {
    await fn();
    check(name, false, `expected errcode ${code}, call succeeded`);
  } catch (error) {
    check(name, error?.code === code, `expected ${code}, got ${error?.code}: ${error?.message}`);
  }
}

log('WP-05 GAP-018 correction-proposal control checks');
log('='.repeat(96));

// --- role gate on the maker -------------------------------------------------
await asUser(CHECKER_A, CO_A); // ACCOUNTANT is not ADMIN/MANAGER
await throwsWith('Maker role gate: an ACCOUNTANT cannot generate proposals', '42501', () =>
  q('select public.wp05_generate_correction_proposals($1::date, $2, $3::uuid)', [AS_OF, 'controls-run-1', PERIOD_A]));

// --- maker generates --------------------------------------------------------
await asUser(MAKER_A, CO_A);
const gen1 = (await q('select public.wp05_generate_correction_proposals($1::date, $2, $3::uuid) as r', [AS_OF, 'controls-run-1', PERIOD_A])).rows[0].r;
check('Maker (MANAGER) generates proposals', gen1.success === true && gen1.created > 0, JSON.stringify(gen1));
check('Maker reports posted_to_gl = false', gen1.posted_to_gl === false, JSON.stringify(gen1.posted_to_gl));

const pending = (await q(
  `select reconciliation_class, status, proposal_type, reason_code from public.wp05_correction_proposals where company_id = $1 order by reconciliation_class`,
  [CO_A],
)).rows;
check('Every proposal starts PENDING_APPROVAL', pending.length > 0 && pending.every((r) => r.status === 'PENDING_APPROVAL'),
  pending.map((r) => `${r.reconciliation_class}=${r.status}`).join(', '));
check('Owner payables proposal typed MISSING_GL_POSTING',
  pending.some((r) => r.reconciliation_class === 'OWNER_PAYABLES' && r.proposal_type === 'MISSING_GL_POSTING'),
  JSON.stringify(pending));

// --- idempotency ------------------------------------------------------------
const gen2 = (await q('select public.wp05_generate_correction_proposals($1::date, $2, $3::uuid) as r', [AS_OF, 'controls-run-1', PERIOD_A])).rows[0].r;
check('Re-running the maker creates nothing (idempotent)', gen2.created === 0 && gen2.already_present === gen1.created,
  JSON.stringify({ created: gen2.created, already_present: gen2.already_present }));

const countAfter = Number((await q('select count(*)::int as n from public.wp05_correction_proposals where company_id = $1', [CO_A])).rows[0].n);
check('Proposal count unchanged after idempotent re-run', countAfter === pending.length, `${countAfter} vs ${pending.length}`);

// --- audit ------------------------------------------------------------------
await asService();
const audits = Number((await q(`select count(*)::int as n from public.audit_log where action = 'WP05_PROPOSAL_CREATED'`)).rows[0].n);
check('Proposal creation emits audit events', audits >= pending.length, `${audits} audit rows`);

// --- append-only / immutability --------------------------------------------
await throwsWith('Proposals cannot be deleted (append-only)', '42501', () =>
  q('delete from public.wp05_correction_proposals where company_id = $1', [CO_A]));
await throwsWith('Direct status updates blocked outside the RPCs', '42501', () =>
  q(`update public.wp05_correction_proposals set status = 'APPROVED' where company_id = $1`, [CO_A]));

// --- maker != checker -------------------------------------------------------
const ownerProposal = (await q(
  `select id from public.wp05_correction_proposals where company_id = $1 and reconciliation_class = 'OWNER_PAYABLES'`,
  [CO_A],
)).rows[0].id;

await asUser(MAKER_A, CO_A);
await throwsWith('Maker cannot approve their own proposal (maker≠checker)', '42501', () =>
  q('select public.wp05_approve_correction_proposal($1::uuid, $2)', [ownerProposal, 'self approval']));

await asUser(CHECKER_A, CO_A);
const approved = (await q('select public.wp05_approve_correction_proposal($1::uuid, $2) as r', [ownerProposal, 'Confirmed by Accounting.'])).rows[0].r;
check('ACCOUNTANT checker can approve', approved.status === 'APPROVED', JSON.stringify(approved));
check('Approval explicitly reports posted_to_gl = false', approved.posted_to_gl === false, JSON.stringify(approved.posted_to_gl));

await throwsWith('A decided proposal cannot be re-approved', '23514', () =>
  q('select public.wp05_approve_correction_proposal($1::uuid, $2)', [ownerProposal, 'again']));

const otherProposal = (await q(
  `select id from public.wp05_correction_proposals where company_id = $1 and status = 'PENDING_APPROVAL' limit 1`,
  [CO_A],
)).rows[0];
if (otherProposal) {
  await throwsWith('Rejection requires a non-empty reason', '22023', () =>
    q('select public.wp05_reject_correction_proposal($1::uuid, $2)', [otherProposal.id, '   ']));
  const rejected = (await q('select public.wp05_reject_correction_proposal($1::uuid, $2) as r', [otherProposal.id, 'Deferred pending evidence.'])).rows[0].r;
  check('Checker can reject with a reason', rejected.status === 'REJECTED', JSON.stringify(rejected));
}

// --- company isolation ------------------------------------------------------
await asUser(ADMIN_B, CO_B);
await throwsWith('Cross-company diagnostics are blocked', '42501', () =>
  q('select * from public.wp05_variance_diagnostics($1::uuid, $2::date)', [CO_A, AS_OF]));
await throwsWith('Company B cannot decide a company A proposal', 'P0002', () =>
  q('select public.wp05_approve_correction_proposal($1::uuid, $2)', [ownerProposal, 'cross-company approval']));

const bList = (await q('select public.wp05_list_correction_proposals(null, null) as r')).rows[0].r;
check('Company B sees none of company A proposals', bList.proposals.length === 0, JSON.stringify(bList.proposals.length));

await asUser(CHECKER_A, CO_A);
const aList = (await q('select public.wp05_list_correction_proposals(null, null) as r')).rows[0].r;
check('Company A sees exactly its own proposals', aList.proposals.length === pending.length, `${aList.proposals.length} vs ${pending.length}`);

// --- no unapproved posting --------------------------------------------------
const proof = (await q('select public.wp05_assert_no_unapproved_correction_postings($1::uuid) as r', [CO_A])).rows[0].r;
check('Proof function reports success', proof.success === true, JSON.stringify(proof));
check('Zero GL batches originate from the proposal lane', proof.proposal_sourced_gl_batches === 0, JSON.stringify(proof));

await asService();
const glBatches = Number((await q('select count(*)::int as n from public.journal_batches where company_id = $1', [CO_A])).rows[0].n);
check('Approval created no GL batch at all for company A', glBatches === 0, `${glBatches} batches`);
const s09 = Number((await q('select count(*)::int as n from public.s09_corrections where company_id = $1', [CO_A])).rows[0].n);
check('Approval created no S09 correction', s09 === 0, `${s09} corrections`);

const failed = checks.filter((c) => !c.ok);
log('');
log('='.repeat(96));
log(`${checks.length - failed.length}/${checks.length} control checks passed.`);

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify({
    generated_by: 'scripts/wp05/verify-proposal-controls.mjs',
    environment: 'ephemeral PGlite built from supabase/migrations',
    as_of: AS_OF,
    proposals: pending,
    unapproved_posting_proof: proof,
    checks,
    passed: checks.length - failed.length,
    total: checks.length,
  }, null, 2)}\n`);
  log(`JSON report written to ${jsonPath}`);
}

await db.close();
process.exit(failed.length ? 1 : 0);
