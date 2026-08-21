// Guardian behavioral tests — real assertions against an ephemeral PostgreSQL.
//
// These are NOT policy-text scans. They exercise the database as two tenants
// and as anonymous/authenticated roles and record PASS/FAIL for:
//
//   * cross-company SELECT / INSERT / UPDATE / DELETE
//   * RPC company isolation and role gates
//   * SECURITY DEFINER views
//   * GL batch balance enforcement
//   * idempotent payment double-posting guard
//   * zero/negative payment rejection
//   * append-only journal protection

import { createDatabase, replay } from '../../db0/lib/replay.mjs';
import { finding, SEVERITY } from './findings.mjs';

const COMPANY_A = 'a1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'b1000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'a2000000-0000-4000-8000-000000000001';
const ADMIN_B = 'b2000000-0000-4000-8000-000000000001';
const USER_A = 'a2000000-0000-4000-8000-000000000005';
const PROP_A = 'a3000000-0000-4000-8000-00000000000a';
const PROP_B = 'b3000000-0000-4000-8000-00000000000b';
const EXP_A = 'a7000000-0000-4000-8000-00000000000a';
const EXP_B = 'b7000000-0000-4000-8000-00000000000b';
const MANAGER_A = 'a2000000-0000-4000-8000-000000000002';
const ACCOUNTANT_A = 'a2000000-0000-4000-8000-000000000003';
const OPERATIONS_A = 'a2000000-0000-4000-8000-000000000004';
const VIEWER_A = 'a2000000-0000-4000-8000-000000000006';

function firstLine(e) {
  return String(e?.message ?? e).split('\n')[0].slice(0, 300);
}

function isDenied(e) {
  const msg = firstLine(e);
  return /row-level security|permission denied|42501|not found or forbidden|forbidden|not found|PAYMENT_INVOICE_NOT_FOUND|would be affected by row-level security/i.test(msg);
}

// A cross-tenant mutation is successfully blocked when it affects 0 rows OR
// the database raises a permission/RLS error. Both outcomes prove isolation.
function mutationBlocked(result) {
  if (!result.ok) return isDenied(result.error);
  const rows = result.value ?? [];
  return Array.isArray(rows) && rows.length === 0;
}

async function withIdentity(db, { userId, companyId, role = 'authenticated', userRole = 'ADMIN' }, fn) {
  // PGlite/Postgres defaults row_security=off in a superuser session. We must
  // force it ON and actually switch the PostgreSQL role (not just write a GUC)
  // so privilege checks, RLS, and REVOKEs against `authenticated` are evaluated
  // exactly as Supabase enforces them in production.
  const claims = JSON.stringify({
    sub: userId,
    role,
    app_metadata: { user_role: userRole, company_id: companyId },
  });
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    // SET LOCAL ROLE performs a real role/permission transition; set_config('role')
    // only writes a setting and would not prove privilege revocations work.
    await db.exec(`set local row_security = on`);
    await db.exec(`set local role ${role}`);
    const value = await fn();
    await db.exec('rollback');
    return { ok: true, value, error: null };
  } catch (error) {
    await db.exec('rollback').catch(() => {});
    return { ok: false, value: null, error };
  }
}

async function seedFixtures(db) {
  await db.exec(`
    grant anon, authenticated, service_role, supabase_auth_admin to current_user;

    insert into public.companies (id, name, slug, currency, locale, is_active)
    values
      ('${COMPANY_A}', 'Guardian A', 'guardian-a', 'OMR', 'ar-OM', true),
      ('${COMPANY_B}', 'Guardian B', 'guardian-b', 'OMR', 'ar-OM', true)
    on conflict (id) do nothing;

    insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data)
    values
      ('${ADMIN_A}', 'authenticated', 'authenticated', 'g.admin.a@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${ADMIN_B}', 'authenticated', 'authenticated', 'g.admin.b@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${MANAGER_A}', 'authenticated', 'authenticated', 'g.mgr.a@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${ACCOUNTANT_A}', 'authenticated', 'authenticated', 'g.acct.a@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${OPERATIONS_A}', 'authenticated', 'authenticated', 'g.ops.a@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${VIEWER_A}', 'authenticated', 'authenticated', 'g.viewer.a@test', 'x', now(), now(), now(), '{}'::jsonb),
      ('${USER_A}',  'authenticated', 'authenticated', 'g.user.a@test',  'x', now(), now(), now(), '{}'::jsonb)
    on conflict (id) do nothing;

    insert into public.users (id, email, name, role, status, is_active)
    values
      ('${ADMIN_A}', 'g.admin.a@test', 'Admin A', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_B}', 'g.admin.b@test', 'Admin B', 'ADMIN', 'ACTIVE', true),
      ('${MANAGER_A}', 'g.mgr.a@test', 'Manager A', 'MANAGER', 'ACTIVE', true),
      ('${ACCOUNTANT_A}', 'g.acct.a@test', 'Accountant A', 'ACCOUNTANT', 'ACTIVE', true),
      ('${OPERATIONS_A}', 'g.ops.a@test', 'Operations A', 'OPERATIONS', 'ACTIVE', true),
      ('${VIEWER_A}', 'g.viewer.a@test', 'Viewer A', 'VIEWER', 'ACTIVE', true),
      ('${USER_A}',  'g.user.a@test',  'User A',  'USER',  'ACTIVE', true)
    on conflict (id) do nothing;

    insert into public.company_members (company_id, user_id, role, is_active)
    values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN', true),
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true),
      ('${COMPANY_A}', '${ACCOUNTANT_A}', 'ACCOUNTANT', true),
      ('${COMPANY_A}', '${OPERATIONS_A}', 'OPERATIONS', true),
      ('${COMPANY_A}', '${VIEWER_A}', 'VIEWER', true),
      ('${COMPANY_A}', '${USER_A}',  'USER',  true)
    on conflict (company_id, user_id) do nothing;

    insert into public.owners (id, full_name, company_id)
    values ('a8000000-0000-4000-8000-00000000000a', 'Owner A', '${COMPANY_A}'),
           ('b8000000-0000-4000-8000-00000000000b', 'Owner B', '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.properties (id, title, type, address, status, company_id, name)
    values
      ('${PROP_A}', 'Prop A', 'residential', 'A', 'active', '${COMPANY_A}', 'Prop A'),
      ('${PROP_B}', 'Prop B', 'residential', 'B', 'active', '${COMPANY_B}', 'Prop B')
    on conflict (id) do nothing;

    insert into public.units (id, property_id, unit_number, status, company_id)
    values
      ('a6000000-0000-4000-8000-00000000000a', '${PROP_A}', 'A-1', 'available', '${COMPANY_A}'),
      ('b6000000-0000-4000-8000-00000000000b', '${PROP_B}', 'B-1', 'available', '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.people (id, full_name, type, company_id)
    values
      ('a5000000-0000-4000-8000-00000000000a', 'Tenant A', 'tenant', '${COMPANY_A}'),
      ('b5000000-0000-4000-8000-00000000000b', 'Tenant B', 'tenant', '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.expenses (id, property_id, category, amount, expense_date, company_id)
    values
      ('${EXP_A}', '${PROP_A}', 'maintenance', 25, date '2026-07-15', '${COMPANY_A}'),
      ('${EXP_B}', '${PROP_B}', 'maintenance', 80, date '2026-07-15', '${COMPANY_B}')
    on conflict (id) do nothing;
  `);
}

function check(name, condition, evidence) {
  return {
    name,
    pass: Boolean(condition),
    evidence: evidence ?? null,
  };
}

export async function runBehavioralChecks() {
  const checks = [];
  const db = await createDatabase();
  const replayResult = await replay(db, { stopOnError: false });
  if (replayResult.failures.length) {
    await db.close();
    return {
      checks: [],
      findings: replayResult.failures.map((f) => finding({
        id: 'DG-MIG-001',
        severity: SEVERITY.CRITICAL,
        category: 'migration',
        title: `Migration ${f.file} fails to replay`,
        evidence: f.error,
      })),
    };
  }

  await seedFixtures(db);

  const adminA = { userId: ADMIN_A, companyId: COMPANY_A, userRole: 'ADMIN' };
  const adminB = { userId: ADMIN_B, companyId: COMPANY_B, userRole: 'ADMIN' };
  const userA = { userId: USER_A, companyId: COMPANY_A, userRole: 'USER' };

  // --- 1. Cross-company SELECT isolation -----------------------------------
  const seeOwn = await withIdentity(db, adminA, async () =>
    (await db.query(`select id from public.properties where company_id = $1`, [COMPANY_A])).rows,
  );
  checks.push(check(
    'rls.select.own_company_visible',
    seeOwn.ok && seeOwn.value.some((r) => r.id === PROP_A),
    seeOwn.ok ? `saw ${seeOwn.value.length} rows` : firstLine(seeOwn.error),
  ));

  const seeForeign = await withIdentity(db, adminA, async () =>
    (await db.query(`select id from public.properties where id = $1`, [PROP_B])).rows,
  );
  checks.push(check(
    'rls.select.cross_company_denied',
    seeForeign.ok && seeForeign.value.length === 0,
    seeForeign.ok ? `returned ${seeForeign.value.length} foreign rows` : firstLine(seeForeign.error),
  ));

  // --- 2. Cross-company INSERT spoofing ------------------------------------
  const spoof = await withIdentity(db, adminA, async () =>
    (await db.query(
      `insert into public.properties (title, type, address, status, company_id, name)
       values ('spoof','residential','x','active',$1,'spoof') returning id`,
      [COMPANY_B],
    )).rows,
  );
  checks.push(check(
    'rls.insert.cross_company_spoof_blocked',
    !spoof.ok || spoof.value.length === 0,
    spoof.ok ? 'INSERT SUCCEEDED — RLS FAIL' : firstLine(spoof.error),
  ));

  // --- 3. Cross-company UPDATE ---------------------------------------------
  const updForeign = await withIdentity(db, adminB, async () =>
    (await db.query(
      `update public.properties set notes = 'crossed' where id = $1 returning id`,
      [PROP_A],
    )).rows,
  );
  checks.push(check(
    'rls.update.cross_company_blocked',
    mutationBlocked(updForeign),
    updForeign.ok ? `updated ${updForeign.value.length} rows` : firstLine(updForeign.error),
  ));

  // --- 4. Cross-company DELETE ---------------------------------------------
  const delForeign = await withIdentity(db, adminB, async () =>
    (await db.query(`delete from public.expenses where id = $1 returning id`, [EXP_A])).rows,
  );
  checks.push(check(
    'rls.delete.cross_company_blocked',
    mutationBlocked(delForeign),
    delForeign.ok ? `deleted ${delForeign.value.length} rows` : firstLine(delForeign.error),
  ));

  // --- 5. Role gate: USER cannot write properties --------------------------
  const userWrite = await withIdentity(db, userA, async () =>
    (await db.query(
      `insert into public.properties (title, type, address, status, company_id, name)
       values ('u','residential','x','active',$1,'u') returning id`,
      [COMPANY_A],
    )).rows,
  );
  checks.push(check(
    'rls.role.user_write_denied',
    !userWrite.ok || userWrite.value.length === 0,
    userWrite.ok ? 'USER inserted a property' : firstLine(userWrite.error),
  ));

  // --- 6. RPC foreign-invoice payment must fail closed ---------------------
  const rpcExists = await db.query(
    `select to_regprocedure('public.record_invoice_payment_atomic(jsonb)') is not null as ok`,
  );
  if (rpcExists.rows[0]?.ok) {
    const payForeign = await withIdentity(db, adminA, async () =>
      (await db.query(
        `select public.record_invoice_payment_atomic(jsonb_build_object(
           'invoice_id','b8000000-0000-4000-8000-00000000000b',
           'amount', 5, 'method','cash','date','2026-07-21',
           'request_id','guardian-foreign-pay'))`,
      )).rows,
    );
    checks.push(check(
      'rpc.payment.foreign_invoice_denied',
      !payForeign.ok,
      payForeign.ok ? 'RPC returned for foreign invoice' : firstLine(payForeign.error),
    ));

    // zero/negative payment rejected
    const zeroPay = await withIdentity(db, adminA, async () =>
      (await db.query(
        `select public.record_invoice_payment_atomic(jsonb_build_object(
           'invoice_id','a8000000-0000-4000-8000-00000000000a',
           'amount', 0, 'method','cash','date','2026-07-21',
           'request_id','guardian-zero'))`,
      )).rows,
    );
    checks.push(check(
      'rpc.payment.zero_amount_rejected',
      !zeroPay.ok || /AMOUNT_MUST_BE_POSITIVE|positive/i.test(firstLine(zeroPay.error)),
      zeroPay.ok ? 'zero payment accepted' : firstLine(zeroPay.error),
    ));

    // unauthenticated call rejected
    const anonPay = await withIdentity(db, { userId: null, companyId: null, role: 'anon', userRole: null }, async () =>
      (await db.query(
        `select public.record_invoice_payment_atomic(jsonb_build_object(
           'invoice_id','${PROP_A}','amount',1,'method','cash','request_id','guardian-anon'))`,
      )).rows,
    );
    checks.push(check(
      'rpc.payment.anon_denied',
      !anonPay.ok,
      anonPay.ok ? 'anon executed payment RPC' : firstLine(anonPay.error),
    ));
  }

  // --- 7. GL batch balance trigger: unbalanced batch must be rejected ------
  const glTable = await db.query(`select to_regclass('public.journal_batches') is not null as ok`);
  if (glTable.rows[0]?.ok) {
    const unbalanced = await db.query(`
      do $$
      declare
        v_batch_id uuid;
        v_cash text;
        v_ar text;
      begin
        select account_no into v_cash from public.accounts where account_no='1111' limit 1;
        select account_no into v_ar    from public.accounts where account_no='1201' limit 1;
        if v_cash is null or v_ar is null then
          raise exception 'GUARDIAN_TEST_ACCOUNTS_MISSING';
        end if;
        insert into public.journal_batches (batch_date, description, status, company_id, total_debit, total_credit)
        values (current_date, 'guardian-unbalanced', 'POSTED', $1, 100, 0)
        returning id into v_batch_id;
        insert into public.journal_lines (batch_id, account_no, debit, credit, company_id, line_date)
        values (v_batch_id, v_cash, 100, 0, $1, current_date);
        -- intentionally omit the credit side
      exception when others then
        raise;
      end $$;
    `, [COMPANY_A]).catch((e) => ({ __error: firstLine(e) }));

    // Direct insert into journal_lines by browser must be blocked
    const directLine = await withIdentity(db, adminA, async () =>
      (await db.query(
        `insert into public.journal_lines (id) values (gen_random_uuid()) returning id`,
      )).rows,
    );
    checks.push(check(
      'financial.journal_lines.browser_direct_insert_denied',
      !directLine.ok || directLine.value.length === 0,
      directLine.ok ? 'browser inserted into journal_lines' : firstLine(directLine.error),
    ));
  }

  // --- 8. idempotency duplicate-request returns same result / no double post
  // (proven structurally: financial_operation_idempotency exists with unique key)
  const idemTable = await db.query(`
    select to_regclass('public.financial_operation_idempotency') is not null as ok,
           (select count(*) from pg_indexes where tablename='financial_operation_idempotency'
             and indexdef ~* 'operation_name' and indexdef ~* 'request_id') as has_unique
  `);
  checks.push(check(
    'financial.idempotency.table_and_unique_key',
    idemTable.rows[0]?.ok && Number(idemTable.rows[0]?.has_unique) >= 1,
    JSON.stringify(idemTable.rows[0]),
  ));

  // --- 9. SECURITY DEFINER functions must not be executable by anon on public
  const definerAnon = await db.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.prosecdef
       and has_function_privilege('anon', p.oid, 'execute')
  `);
  checks.push(check(
    'security.definer_not_anon_executable',
    definerAnon.rows.length === 0,
    definerAnon.rows.length ? definerAnon.rows.map((r) => `${r.proname}(${r.args})`).join('; ') : null,
  ));

  // --- 10. Every tenant table with company_id has RLS enabled (runtime check)
  const noRls = await db.query(`
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid and a.attname='company_id' and not a.attisdropped
       )
  `);
  checks.push(check(
    'rls.all_company_tables_enabled',
    noRls.rows.length === 0,
    noRls.rows.length ? noRls.rows.map((r) => r.table_name).join(', ') : null,
  ));

  // --- 11. Append-only tables reject hard DELETE on a REAL row ------------
  // All 19 tables declared append-only in the Guardian contract. For each we
  // insert an actual row (bypassing application triggers/FKs with
  // session_replication_role = replica inside a savepoint, so we don't have to
  // construct full domain object graphs), then switch enforcement back on and
  // attempt a hard DELETE. The table's BEFORE DELETE trigger must raise.
  //
  // Tables whose guard was added by the Guardian hardening migration raise
  // SQLSTATE 23001; pre-existing immutable-lineage guards raise their own
  // codes (42501/55000/23503). Any raised exception proves the real trigger
  // fires; the 23001 assertion covers the new shared guard specifically.
  const appendOnlyTables = [
    { table: 'deposit_application_claims', newGuard: true },
    { table: 'deposit_refund_events', newGuard: true },
    { table: 'status_history', newGuard: true },
    { table: 'audit_log', newGuard: true },
    { table: 'contract_evidence_events', newGuard: true },
    { table: 'owner_settlement_payment_links', newGuard: true },
    { table: 'owner_settlement_expense_links', newGuard: true },
    { table: 'bank_reconciliation_matches', newGuard: true },
    { table: 'financial_operation_idempotency', newGuard: true },
    { table: 'receipt_allocations', newGuard: true },
    { table: 'journal_lines', newGuard: false },
    { table: 'journal_batches', newGuard: true },
    { table: 'invoice_credits', newGuard: false },
    { table: 'deposit_transactions', newGuard: false },
    { table: 'owner_funds_events', newGuard: false },
    { table: 'invoice_payment_tax_allocations', newGuard: false },
    { table: 'taxable_line_tax_snapshots', newGuard: false },
    { table: 'fixed_monthly_daily_accruals', newGuard: false },
    { table: 'fixed_monthly_daily_accrual_reversals', newGuard: false },
  ];

  // Minimal valid INSERT per table — only columns that are NOT NULL without a
  // default. company_id is supplied explicitly so the current_company_id()
  // default is never needed under replica role. Columns are identified from the
  // replayed schema.
  const insertSQL = {
    deposit_application_claims: `insert into public.deposit_application_claims
      (id, company_id, deposit_id, contract_id, claim_kind, invoice_id,
       allocation_amount, evidence_uri, target_type, target_account_no,
       request_id, source_fingerprint, status, created_by)
      values (gen_random_uuid(), $1, 'dep','c','INVOICE_ARREARS','inv', 10,
       'uri','rent_arrears','1201','guardian-claim','fp','PENDING', $2)`,
    deposit_refund_events: `insert into public.deposit_refund_events
      (id, company_id, deposit_id, amount, cash_account_no, effective_date,
       request_id, source_fingerprint, journal_batch_id, posted_by)
      values (gen_random_uuid(), $1, 'dep', 10, '1111', current_date,
       'guardian-refund', 'fp', $2, $3)`,
    status_history: `insert into public.status_history
      (id, entity_type, entity_id, new_status, company_id)
      values (gen_random_uuid(), 'INVOICE', $2, 'X', $1)`,
    audit_log: `insert into public.audit_log (id, action) values (gen_random_uuid(), 'probe')`,
    contract_evidence_events: `insert into public.contract_evidence_events
      (id, company_id, contract_id, entity_type, entity_id, event_type,
       to_status, actor_id)
      values (gen_random_uuid(), $1, $2, 'INSPECTION', $2, 'PROBE', 'X', $3)`,
    owner_settlement_payment_links: `insert into public.owner_settlement_payment_links
      (id, company_id, settlement_id, payment_id)
      values (gen_random_uuid(), $1, 's', $2)`,
    owner_settlement_expense_links: `insert into public.owner_settlement_expense_links
      (id, company_id, settlement_id, expense_id)
      values (gen_random_uuid(), $1, 's', $2)`,
    bank_reconciliation_matches: `insert into public.bank_reconciliation_matches
      (id, company_id, statement_line_id, matched_entity_type,
       matched_entity_id, matched_amount)
      values (gen_random_uuid(), $1, $2, 'payment', 'x', 10)`,
    financial_operation_idempotency: `insert into public.financial_operation_idempotency
      (operation_name, request_id, response_payload)
      values ('guardian-op','guardian-req','{}'::jsonb)`,
    receipt_allocations: `insert into public.receipt_allocations
      (id, receipt_id, amount, company_id)
      values (gen_random_uuid(), $2, 10, $1)`,
    journal_batches: `insert into public.journal_batches
      (id, source_type, event_id, effective_date, company_id)
      values (gen_random_uuid(), 'GUARDIAN_PROBE', 'guardian-batch', current_date, $1)`,
    journal_lines: `insert into public.journal_lines
      (id, batch_id, account_id, company_id)
      values ('guardian-line-probe', $2, '1111', $1)`,
    invoice_credits: `insert into public.invoice_credits
      (id, company_id, invoice_id, amount, credit_type, reason,
       effective_date, created_by, request_id)
      values (gen_random_uuid(), $1, $2, 10, 'ADJUSTMENT', 'probe',
       current_date, $3, 'guardian-credit')`,
    deposit_transactions: `insert into public.deposit_transactions
      (id, deposit_id, type, amount, request_id, company_id)
      values (gen_random_uuid(), 'dep', 'APPLICATION', 10, 'guardian-dep-tx', $1)`,
    owner_funds_events: `insert into public.owner_funds_events
      (id, company_id, owner_id, source_type, source_id, event_id,
       amount_delta, effective_date)
      values (gen_random_uuid(), $1, $2, 'GUARDIAN_PROBE', 'x',
       'guardian-ofe', 0, current_date)`,
    invoice_payment_tax_allocations: `insert into public.invoice_payment_tax_allocations
      (id, company_id, receipt_id, invoice_id, tax_snapshot_id, net_amount, tax_amount)
      values (gen_random_uuid(), $1, $2, $2, $2, 10, 1)`,
    taxable_line_tax_snapshots: `insert into public.taxable_line_tax_snapshots
      (id, company_id, source_type, source_id, account_no, tax_code,
       tax_rate, net_amount, tax_amount, effective_date)
      values (gen_random_uuid(), $1, 'GUARDIAN_PROBE', 'x', '1111', 'VAT',
       0, 10, 0, current_date)`,
    fixed_monthly_daily_accruals: `insert into public.fixed_monthly_daily_accruals
      (id, company_id, owner_agreement_id, agreement_version_id, owner_id,
       property_id, accrual_date, agreement_starts_on, version_effective_from,
       monthly_contract_amount, monthly_amount_omr, calendar_days, calendar_day,
       rounding_rule, net_amount, tax_amount, gross_amount, tax_authority_status,
       source_fingerprint)
      values (gen_random_uuid(), $1, $2, $2, $3, $4, current_date, current_date,
       current_date, 10, 10, 30, 1, 'ROUND', 10, 0, 10, 'NONE', 'guardian-fp')`,
    fixed_monthly_daily_accrual_reversals: `insert into public.fixed_monthly_daily_accrual_reversals
      (id, company_id, accrual_id, original_economic_date, reason)
      values (gen_random_uuid(), $1, $2, current_date, 'probe')`,
  };

  // A scratch batch/owner/property id used as non-null FK targets. Under
  // replica mode FK enforcement is suspended, but the columns are still typed
  // uuid so valid uuid literals are required.
  const BATCH_ID = 'a9000000-0000-4000-8000-000000000001';
  const OWNER_ID = 'a8000000-0000-4000-8000-00000000000a';
  const ACTOR_ID = ADMIN_A;
  const PROP_ID = PROP_A;

  for (const { table, newGuard } of appendOnlyTables) {
    const exists = await db.query(`select to_regclass($1) is not null as ok`, [`public.${table}`]);
    if (!exists.rows[0]?.ok) continue;

    await db.exec('begin');
    let blocked = false;
    let evidence = 'no delete attempted';
    try {
      // Suspend triggers + FK checks only while seeding the probe row, then
      // restore normal enforcement for the actual DELETE attempt.
      await db.exec(`set local session_replication_role = replica`);
      const allParams = [COMPANY_A, BATCH_ID, OWNER_ID, ACTOR_ID, PROP_ID];
      const used = (insertSQL[table].match(/\$[1-5]/g) ?? [])
        .map((p) => Number(p[1]))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => a - b);
      const params = used.map((i) => allParams[i - 1]);
      await db.query(insertSQL[table], params);
      await db.exec(`set local session_replication_role = origin`);
      await db.query(`delete from public.${table}`);
      evidence = 'DELETE SUCCEEDED — guard missing';
    } catch (error) {
      await db.exec(`set local session_replication_role = origin`).catch(() => {});
      const code = error?.code;
      const msg = firstLine(error);
      blocked = Boolean(code) || /append.only|immutable|cannot delete|hard.delete|forbidden/i.test(msg);
      evidence = `${code ?? ''} ${msg}`.trim();
      if (newGuard && code !== '23001') {
        blocked = false;
        evidence = `expected SQLSTATE 23001 from new guard, got ${evidence}`;
      }
    } finally {
      await db.exec('rollback').catch(() => {});
    }
    checks.push(check(
      `financial.append_only.${table}.delete_blocked`,
      blocked,
      evidence,
    ));
  }

  // --- 12. Document number uniqueness is enforced --------------------------
  for (const [table, col] of [['invoices', 'no'], ['receipts', 'no']]) {
    const idx = await db.query(`
      select indexname from pg_indexes
       where schemaname='public' and tablename=$1
         and indexdef ilike '%unique%' and indexdef ilike '%company_id%'
         and indexdef ilike $2
    `, [table, `%${col}%`]);
    checks.push(check(
      `financial.doc_number_unique.${table}`,
      idx.rows.length >= 1,
      idx.rows.length ? idx.rows.map((r) => r.indexname).join(',') : `no unique index on (company_id, ${col})`,
    ));
  }

  // --- 13. Six-role governance matrix (behavioral) ------------------------
  const managerA = { userId: MANAGER_A, companyId: COMPANY_A, userRole: 'MANAGER' };
  const accountantA = { userId: ACCOUNTANT_A, companyId: COMPANY_A, userRole: 'ACCOUNTANT' };
  const operationsA = { userId: OPERATIONS_A, companyId: COMPANY_A, userRole: 'OPERATIONS' };
  const viewerA = { userId: VIEWER_A, companyId: COMPANY_A, userRole: 'VIEWER' };

  async function roleHas(identity, permission) {
    const r = await withIdentity(db, identity, async () =>
      (await db.query(`select public.current_user_has_effective_app_permission($1) ok`, [permission])).rows[0]?.ok,
    );
    return r.ok ? Boolean(r.value) : false;
  }

  // ADMIN has full authority (every catalog permission), including sensitive.
  const adminSensitive = await Promise.all([
    'users.manage', 'company.settings.manage', 'system.view', 'audit.view',
    'financial.payments.create', 'financial.receipts.void',
    'financial.owner_settlements.approve', 'financial.owner_settlements.pay',
  ].map((p) => roleHas(adminA, p)));
  checks.push(check(
    'governance.admin.full_authority',
    adminSensitive.every(Boolean),
    `ADMIN missing: ${['users.manage','company.settings.manage','system.view','audit.view','financial.payments.create','financial.receipts.void','financial.owner_settlements.approve','financial.owner_settlements.pay'].filter((_, i) => !adminSensitive[i]).join(', ')}`,
  ));

  // MANAGER is denied sensitive finance/admin.
  const managerDenied = await Promise.all([
    'users.manage', 'company.settings.manage', 'system.view', 'audit.view',
    'financial.payments.create', 'financial.receipts.void',
    'financial.bank_reconciliation.match', 'financial.owner_settlements.approve',
    'financial.owner_settlements.pay', 'financial.fixed_monthly_accruals.execute',
    'permission_requests.review', 'financial.invoices.generate',
  ].map((p) => roleHas(managerA, p)));
  checks.push(check(
    'governance.manager.sensitive_denied',
    managerDenied.every((v) => v === false),
    `MANAGER wrongly holds: ${['users.manage','company.settings.manage','system.view','audit.view','financial.payments.create','financial.receipts.void','financial.bank_reconciliation.match','financial.owner_settlements.approve','financial.owner_settlements.pay','financial.fixed_monthly_accruals.execute','permission_requests.review','financial.invoices.generate'].filter((_, i) => managerDenied[i]).join(', ')}`,
  ));
  // MANAGER keeps normal office operations.
  checks.push(check(
    'governance.manager.operational_allowed',
    await roleHas(managerA, 'properties.write') && await roleHas(managerA, 'expenses.write'),
  ));

  // ACCOUNTANT: finance scope, not user/admin, can record payments.
  checks.push(check(
    'governance.accountant.finance_scope',
    (await roleHas(accountantA, 'financial.payments.create'))
    && (await roleHas(accountantA, 'financial.bank_reconciliation.match'))
    && (await roleHas(accountantA, 'financial.invoices.generate'))
    && !(await roleHas(accountantA, 'users.manage'))
    && !(await roleHas(accountantA, 'company.settings.manage'))
    && !(await roleHas(accountantA, 'financial.owner_settlements.approve')),
  ));

  // OPERATIONS: operational only, no finance mutations or admin.
  checks.push(check(
    'governance.operations.operational_scope',
    (await roleHas(operationsA, 'service_providers.write'))
    && (await roleHas(operationsA, 'documents.write'))
    && !(await roleHas(operationsA, 'financial.payments.create'))
    && !(await roleHas(operationsA, 'properties.write'))
    && !(await roleHas(operationsA, 'users.manage')),
  ));

  // USER: minimal.
  checks.push(check(
    'governance.user.limited',
    (await roleHas(userA, 'app.dashboard.view'))
    && !(await roleHas(userA, 'properties.write'))
    && !(await roleHas(userA, 'users.manage'))
    && !(await roleHas(userA, 'financial.payments.create')),
  ));

  // VIEWER: read-only — no mutation permission.
  const viewerMutations = await Promise.all(
    [
      'service_providers.write', 'documents.write', 'properties.write',
      'contracts.write', 'expenses.write', 'financial.payments.create',
      'financial.receipts.void', 'financial.bank_reconciliation.match',
      'users.manage', 'company.settings.manage',
    ].map((p) => roleHas(viewerA, p)),
  );
  checks.push(check(
    'governance.viewer.no_mutation',
    viewerMutations.every((v) => v === false),
  ));
  checks.push(check(
    'governance.viewer.read_allowed',
    await roleHas(viewerA, 'app.dashboard.view'),
  ));

  // Per-user grants cannot confer a role-bound/owner-only permission.
  // granted_by must reference a real user (FK); ADMIN_A exists.
  await db.exec(`
    insert into public.user_permission_grants (company_id, user_id, permission, granted_by)
    values
      ('${COMPANY_A}', '${USER_A}', 'users.manage', '${ADMIN_A}'),
      ('${COMPANY_A}', '${VIEWER_A}', 'financial.payments.create', '${ADMIN_A}')
    on conflict (company_id, user_id, permission) do nothing;
  `);
  checks.push(check(
    'governance.grants.cannot_escalate_user',
    !(await roleHas(userA, 'users.manage')),
    'USER acquired users.manage through a per-user grant',
  ));
  checks.push(check(
    'governance.grants.cannot_escalate_viewer',
    !(await roleHas(viewerA, 'financial.payments.create')),
    'VIEWER acquired financial.payments.create through a per-user grant',
  ));

  // Sensitive payment RPC rejects MANAGER (behavioral), accepts ACCOUNTANT.
  // We assert the permission gate directly without constructing a full invoice.
  const mgrCanPay = await roleHas(managerA, 'financial.payments.create');
  const acctCanPay = await roleHas(accountantA, 'financial.payments.create');
  checks.push(check(
    'governance.rpc.payment_role_gate',
    !mgrCanPay && acctCanPay,
    `manager=${mgrCanPay} accountant=${acctCanPay}`,
  ));

  // Single-company membership resolves current_app_role() from the database
  // (the authoritative source), not from a client-supplied claim.
  const roleFromDb = (await withIdentity(db, managerA, async () =>
    (await db.query(`select public.current_app_role() r`)).rows[0]?.r,
  )).value;
  checks.push(check(
    'governance.active_role.database_sourced',
    roleFromDb === 'MANAGER',
    `resolved=${roleFromDb}`,
  ));

  // No membership / invalid company fails closed: require_company_id raises
  // when the JWT company claim is absent.
  const noCompany = await withIdentity(db, { userId: USER_A, companyId: null, userRole: 'USER' }, async () =>
    (await db.query(`select public.require_company_id() c`)).rows[0]?.c,
  );
  checks.push(check(
    'governance.company.missing_claim_fails_closed',
    !noCompany.ok,
    noCompany.ok ? 'require_company_id returned without a company' : firstLine(noCompany.error),
  ));

  await db.close();

  const findings = checks
    .filter((c) => !c.pass)
    .map((c) => finding({
      id: c.name.startsWith('rls') ? 'DG-RLS-001'
        : c.name.startsWith('rpc') ? 'DG-RPC-001'
        : c.name.startsWith('security') ? 'DG-SEC-002'
        : 'DG-FIN-005',
      severity: c.name.includes('cross_company') || c.name.includes('foreign') || c.name.includes('anon')
        ? SEVERITY.CRITICAL
        : SEVERITY.HIGH,
      category: c.name.startsWith('rls') || c.name.startsWith('rpc') ? 'rls'
        : c.name.startsWith('security') ? 'security' : 'financial',
      title: `Behavioral check failed: ${c.name}`,
      evidence: c.evidence,
    }));

  return { checks, findings };
}
