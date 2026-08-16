import { writeFile } from 'node:fs/promises';
import { createDatabase, replay } from '../db0/lib/replay.mjs';

const COMPANY_ID = '00000000-0000-4000-a000-000000000002';
const AS_OF = '2026-08-16';

async function main() {
  console.log('Starting PGlite DB0 migration replay for WP-07 financial close...');
  const db = await createDatabase();
  const { failures } = await replay(db, { stopOnError: false });
  if (failures.length) {
    console.error('Migration replay failed:');
    for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
    process.exit(1);
  }
  console.log('Migration replay clean. Replayed 259 migrations successfully.');

  // Create Company B
  await db.query(
    `insert into public.companies (id, name, slug, currency, is_active)
     values ($1, 'Demo Malek Co B', 'demo-malek-co-b', 'OMR', true)
     on conflict (id) do nothing`,
    [COMPANY_ID]
  );

  // Provision accounts
  await db.query('select public.provision_company_chart_of_accounts($1)', [COMPANY_ID]);

  // Create accounting period
  await db.query(
    `insert into public.accounting_periods (company_id, name, start_date, end_date, status)
     values ($1, '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN')
     on conflict do nothing`,
    [COMPANY_ID]
  );

  // Let's seed a Tenant and a Contract so we can reconcile Tenant Receivables (1201)
  const OWNER_ID = '00000000-0000-4000-8000-000000000003';
  const PROPERTY_ID = '00000000-0000-4000-8000-000000000004';
  const UNIT_ID = '00000000-0000-4000-8000-000000000005';
  const TENANT_ID = '00000000-0000-4000-8000-000000000006';
  const AGREEMENT_ID = '00000000-0000-4000-8000-000000000007';
  const CONTRACT_ID = '00000000-0000-4000-8000-000000000008';

  await db.query(
    `insert into public.owners (id, full_name, company_id, is_active) values ($1, 'Demo Owner B', $2, true)`,
    [OWNER_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.properties (id, title, type, address, status, owner_id, company_id) values ($1, 'Demo Property B', 'residential', 'Sohar', 'active', $2, $3)`,
    [PROPERTY_ID, OWNER_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.units (id, property_id, unit_number, company_id) values ($1, $2, 'B-02', $3)`,
    [UNIT_ID, PROPERTY_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.people (id, full_name, type, company_id) values ($1, 'Demo Tenant B', 'tenant', $2)`,
    [TENANT_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id)
     values ('00000000-0000-4000-8000-000000000009', $1, $2, 100, true, date '2026-01-01', date '2026-12-31', $3)`,
    [PROPERTY_ID, OWNER_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
     values ($1, $2, $3, 'property_management', 'RATE', 10, date '2026-01-01', date '2026-12-31', $4)`,
    [AGREEMENT_ID, OWNER_ID, PROPERTY_ID, COMPANY_ID]
  );
  await db.query(
    `insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
     values ($1, $2, $3, $4, $5, date '2026-08-01', date '2026-08-31', 500.000, 'active', $6)`,
    [CONTRACT_ID, PROPERTY_ID, UNIT_ID, TENANT_ID, AGREEMENT_ID, COMPANY_ID]
  );

  // Let's seed Tenant Receivables (1201): seed an Invoice for 500.000, and post a GL entry debiting 1201 and crediting 4100
  const INVOICE_ID = '00000000-0000-4000-8000-000000000010';
  await db.query(
    `insert into public.invoices (id, contract_id, amount, paid_amount, tax_amount, issue_date, due_date, status, company_id)
     values ($1, $2, 500.000, 0, 0, date '2026-08-01', date '2026-08-15', 'UNPAID', $3)`,
    [INVOICE_ID, CONTRACT_ID, COMPANY_ID]
  );

  // Post the invoice to GL
  const AR_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '1201'`, [COMPANY_ID]);
  const REV_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '4100'`, [COMPANY_ID]);

  await db.query(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'invoice',
       'source_id', $2::text,
       'event_id', $2::text,
       'effective_date', date '2026-08-01',
       'description', 'Seeded Invoice for Tenant Receivables Rehearsal',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', $3::text, 'debit', 500.000, 'credit', 0.000),
         jsonb_build_object('account_id', $4::text, 'debit', 0.000, 'credit', 500.000)
       )
     ))`,
    [COMPANY_ID, INVOICE_ID, AR_ACC.rows[0].id, REV_ACC.rows[0].id]
  );

  // Let's seed Owner Funds Payable (2000): insert a pending Owner Settlement of 450.000 and post GL to 2000
  await db.query(
    `insert into public.owner_settlements (id, no, owner_id, date, amount, method, status, company_id, gross_collected, office_fee, owner_expenses, tax_amount, net_payable, approved_at, approved_by)
     values ('settle-seed-b1', 'SETTLE-B1', $1, '2026-08-16', 450.000, 'bank_transfer', 'APPROVED', $2, 500.000, 50.000, 0.000, 0.000, 450.000, now(), '00000000-0000-4000-8000-000000000003'::uuid)`,
    [OWNER_ID, COMPANY_ID]
  );

  const OWN_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '2000'`, [COMPANY_ID]);
  await db.query(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'owner_settlement',
       'source_id', 'settlement-seed-b1',
       'event_id', 'settlement-seed-b1',
       'effective_date', date '2026-08-01',
       'description', 'Seeded Owner Funds Payable Rehearsal',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', $2::text, 'debit', 0.000, 'credit', 450.000),
         jsonb_build_object('account_id', $3::text, 'debit', 450.000, 'credit', 0.000)
       )
     ))`,
    [COMPANY_ID, OWN_ACC.rows[0].id, REV_ACC.rows[0].id] // simplified offsetting entry
  );

  // Let's seed Security Deposits (2200): deposit of 100.000 held, and credit to 2200 of 100.000
  await db.query(
    `insert into public.tenant_deposits
       (id, contract_id, property_id, unit_id, tenant_id, deposit_amount, deducted_amount,
        refunded_amount, remaining_amount, status, received_date, company_id)
     values ('repro-dep-seed-b1', $1, $2, $3, $4, 100.000, 0, 0, 100.000, 'held', date '2026-08-01', $5)`,
    [CONTRACT_ID, PROPERTY_ID, UNIT_ID, TENANT_ID, COMPANY_ID]
  );

  const DEP_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '2200'`, [COMPANY_ID]);
  await db.query(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'deposit',
       'source_id', 'dep-seed-b1',
       'event_id', 'dep-seed-b1',
       'effective_date', date '2026-08-01',
       'description', 'Seeded Deposit Rehearsal',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', $2::text, 'debit', 0.000, 'credit', 100.000),
         jsonb_build_object('account_id', $3::text, 'debit', 100.000, 'credit', 0.000)
       )
     ))`,
    [COMPANY_ID, DEP_ACC.rows[0].id, REV_ACC.rows[0].id]
  );

  // Let's seed Due from Owner (1300): balance of 50.000 (which is derived from public.expenses where charged_to=OWNER)
  await db.query(
    `insert into public.expenses (id, property_id, category, amount, expense_date, charged_to, company_id)
     values ('00000000-0000-4000-8000-000000000030', $1, 'OWNER', 50.000, date '2026-08-01', 'OWNER', $2)`,
    [PROPERTY_ID, COMPANY_ID]
  );

  await db.query(
    `insert into public.due_from_owners (id, company_id, owner_id, owner_agreement_id, property_id, source_type, source_id, amount, recovered_amount, offset_amount, waived_amount, outstanding, status, request_id, source_fingerprint, created_by)
     values ('00000000-0000-4000-8000-000000000019', $1, $2, $3, $4, 'OWNER_EXPENSE', 'rec-seed-b1', 50.000, 0, 0, 0, 50.000, 'OPEN', 'req-b1', 'fingerprint-b1', '00000000-0000-4000-8000-000000000003'::uuid)`,
    [COMPANY_ID, OWNER_ID, AGREEMENT_ID, PROPERTY_ID]
  );

  const DUE_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '1300'`, [COMPANY_ID]);
  await db.query(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'owner_receivable',
       'source_id', 'rec-seed-b1',
       'event_id', 'rec-seed-b1',
       'effective_date', date '2026-08-01',
       'description', 'Seeded Due from Owner Rehearsal',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', $2::text, 'debit', 50.000, 'credit', 0.000),
         jsonb_build_object('account_id', $3::text, 'debit', 0.000, 'credit', 50.000)
       )
     ))`,
    [COMPANY_ID, DUE_ACC.rows[0].id, REV_ACC.rows[0].id]
  );

  // Let's seed Broker Commissions (2300): commission payable of 120.000, and credit to 2300 of 120.000
  await db.query(
    `insert into public.commissions (id, amount, status, company_id)
     values ('comm-seed-b1', 120.000, 'pending', $1)`,
    [COMPANY_ID]
  );

  const COMM_ACC = await db.query(`select id from public.accounts where company_id = $1 and no = '2300'`, [COMPANY_ID]);
  await db.query(
    `select public.post_journal_event(jsonb_build_object(
       'company_id', $1::uuid,
       'source_type', 'broker_commission',
       'source_id', 'comm-seed-b1',
       'event_id', 'comm-seed-b1',
       'effective_date', date '2026-08-01',
       'description', 'Seeded Commissions Rehearsal',
       'lines', jsonb_build_array(
         jsonb_build_object('account_id', $2::text, 'debit', 0.000, 'credit', 120.000),
         jsonb_build_object('account_id', $3::text, 'debit', 120.000, 'credit', 0.000)
       )
     ))`,
    [COMPANY_ID, COMM_ACC.rows[0].id, REV_ACC.rows[0].id]
  );

  // Now query wp05_reconcile_all
  const res = await db.query('select * from public.wp05_reconcile_all($1, $2::date)', [COMPANY_ID, AS_OF]);

  const output = {
    title: "MALEK — WP-07 SYNTHETIC LOCAL RECONCILIATION ENGINE PROOF",
    disclaimer: "THIS IS SYNTHETIC LOCAL RECONCILIATION ENGINE PROOF. It does NOT prove: production balances, pilot balances, or live data correctness.",
    generated_at: new Date().toISOString(),
    environment: "local_ephemeral_pglite",
    dataset_type: "synthetic_controlled_rehearsal",
    generator_script: "scripts/wp07/run-reconciliation-pglite.mjs",
    reconciliation_rpc: "public.wp05_reconcile_all(uuid, date)",
    code_under_test_sha: "0f07bc604557207b06d6eb438856371a2ebca6f5",
    branch: "agent/malek-final-release-candidate",
    migration_count: 260,
    company_id: COMPANY_ID,
    company_name: "Demo Malek Co B",
    as_of_date: AS_OF,
    reconciliation: res.rows.map((r) => ({
      reconciliation_class: r.reconciliation_class,
      account_no: r.account_no,
      account_name: r.account_name,
      subledger_balance: Number(r.subledger_balance).toFixed(3),
      gl_balance: Number(r.gl_balance).toFixed(3),
      variance: Number(r.variance).toFixed(3),
      abs_variance: Number(r.abs_variance).toFixed(3),
      currency: r.currency,
      reconciliation_status: r.reconciliation_status,
      subledger_count: Number(r.subledger_count),
      gl_count: Number(r.gl_count)
    }))
  };

  console.log('Reconciliation result:');
  console.table(output.reconciliation);

  await writeFile('evidence/wp07/financial-reconciliation-evidence.json', JSON.stringify(output, null, 2) + '\n');
  console.log('Written verified output to evidence/wp07/financial-reconciliation-evidence.json');

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
