// Guardian data-integrity and financial-reconciliation checks.
//
// Runs read-only SQL assertions on the replayed schema. On an empty ephemeral
// database most queries return zero rows (which is the desired invariant); the
// important property is that the *queries are valid* and would catch corruption
// on any populated database. Guardian also seeds a controlled scenario to prove
// the detectors actually fire.

import { createDatabase, replay } from '../../db0/lib/replay.mjs';
import { finding, SEVERITY } from './findings.mjs';

const COMPANY_A = 'a1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'b1000000-0000-4000-8000-00000000000b';

// Each detector is a (id, severity, title, sql, remediation). SQL must return
// a column `evidence` (text) describing the offending row(s), or zero rows.
const DETECTORS = [
  {
    id: 'DG-DATA-001',
    severity: SEVERITY.HIGH,
    category: 'data',
    title: 'Orphan records: rows with company_id not present in companies',
    remediation: 'Backfill or remove the rows; ensure company_id FK is enforced.',
    buildSQL: (table) =>
      `select '${table}' as tbl, count(*)::text as evidence from public.${table} t
        where not exists (select 1 from public.companies c where c.id = t.company_id)
        having count(*) > 0`,
    tables: ['properties', 'units', 'contracts', 'invoices', 'payments', 'receipts',
      'expenses', 'owners', 'people', 'receipt_allocations', 'invoice_credits',
      'deposit_transactions', 'journal_lines', 'journal_batches', 'commissions'],
  },
  {
    id: 'DG-DATA-002',
    severity: SEVERITY.CRITICAL,
    category: 'data',
    title: 'Cross-company relationship: child row company_id differs from parent',
    remediation: 'Rows must inherit company_id from their parent; fix the data and add a trigger/CHECK.',
    sql: `
      select 'properties->owner' as rel, count(*)::text as evidence
        from public.properties p
        join public.owners o on o.id = p.owner_id
       where p.company_id <> o.company_id
      having count(*) > 0
      union all
      select 'units->property', count(*)::text
        from public.units u
        join public.properties p on p.id = u.property_id
       where u.company_id <> p.company_id
      having count(*) > 0
      union all
      select 'contracts->property', count(*)::text
        from public.contracts c
        join public.properties p on p.id = c.property_id
       where c.company_id <> p.company_id
      having count(*) > 0
      union all
      select 'invoices->contract', count(*)::text
        from public.invoices i
        join public.contracts c on c.id = i.contract_id
       where i.company_id <> c.company_id
      having count(*) > 0
      union all
      select 'payments->invoice', count(*)::text
        from public.payments pay
        join public.invoices i on i.id = pay.invoice_id
       where pay.company_id <> i.company_id
      having count(*) > 0
      union all
      select 'receipt_allocations->receipt', count(*)::text
        from public.receipt_allocations ra
        join public.receipts r on r.id = ra.receipt_id
       where ra.company_id <> r.company_id
      having count(*) > 0
    `,
  },
  {
    id: 'DG-DATA-003',
    severity: SEVERITY.HIGH,
    category: 'data',
    title: 'Duplicate business records: same company_id and document number',
    remediation: 'Enforce unique (company_id, no) on invoices and receipts.',
    sql: `
      select 'invoices' as tbl, no as evidence, count(*)::text as n
        from public.invoices
       where no is not null and deleted_at is null
       group by company_id, no having count(*) > 1
      union all
      select 'receipts', no, count(*)::text
        from public.receipts
       where no is not null and deleted_at is null
       group by company_id, no having count(*) > 1
    `,
  },
  {
    id: 'DG-FIN-010',
    severity: SEVERITY.CRITICAL,
    category: 'financial',
    title: 'Invoice overpayment: paid_amount + credited_amount exceeds amount',
    remediation: 'Payment/credit application must clamp to outstanding; investigate double-posting.',
    sql: `
      select id::text as evidence,
             format('amount=%s paid=%s credited=%s', amount, paid_amount, credited_amount)
        from public.invoices
       where deleted_at is null
         and coalesce(paid_amount,0) + coalesce(credited_amount,0) - amount > 0.001
    `,
  },
  {
    id: 'DG-FIN-011',
    severity: SEVERITY.CRITICAL,
    category: 'financial',
    title: 'Unbalanced posted journal batch (debits <> credits)',
    remediation: 'Posted GL batches must balance to 0.001 OMR. A posted unbalanced batch indicates a posting bug.',
    sql: `
      select b.id::text as evidence,
             format('debit=%s credit=%s diff=%s',
                    coalesce(s.dr,0), coalesce(s.cr,0),
                    coalesce(s.dr,0) - coalesce(s.cr,0))
        from public.journal_batches b
        join (
          select batch_id, sum(debit) as dr, sum(credit) as cr
            from public.journal_lines group by batch_id
        ) s on s.batch_id = b.id
       where b.status = 'POSTED'
         and abs(coalesce(s.dr,0) - coalesce(s.cr,0)) > 0.001
    `,
  },
  {
    id: 'DG-FIN-012',
    severity: SEVERITY.HIGH,
    category: 'financial',
    title: 'Negative money amounts in financial tables',
    remediation: 'Amounts on invoices/payments/receipts must be positive; reversals use explicit reversal rows.',
    sql: `
      select 'invoices' as tbl, id::text as evidence, amount::text
        from public.invoices where amount < 0
      union all select 'payments', id::text, amount::text from public.payments where amount < 0
      union all select 'receipts', id::text, amount::text from public.receipts where amount < 0
      union all select 'receipt_allocations', id::text, amount::text from public.receipt_allocations where amount < 0
      union all select 'expenses', id::text, amount::text from public.expenses where amount < 0
    `,
  },
  {
    id: 'DG-FIN-013',
    severity: SEVERITY.HIGH,
    category: 'financial',
    title: 'Posted invoice with zero/negative total',
    remediation: 'Invoices must have a positive amount before posting.',
    sql: `
      select id::text as evidence, format('amount=%s status=%s', amount, status)
        from public.invoices
       where document_status = 'POSTED' and amount <= 0
    `,
  },
  {
    id: 'DG-DATA-004',
    severity: SEVERITY.MEDIUM,
    category: 'data',
    title: 'Impossible state: invoice paid but no payment/receipt allocation',
    remediation: 'A PAID/POSTED invoice should have matching payments or credits; investigate status drift.',
    sql: `
      select i.id::text as evidence,
             format('status=%s paid=%s alloc=%s credits=%s',
                    i.status, i.paid_amount,
                    coalesce(pa.alloc,0), coalesce(cr.credits,0))
        from public.invoices i
        left join (select invoice_id, sum(amount) as alloc from public.receipt_allocations group by invoice_id) pa
               on pa.invoice_id = i.id
        left join (select invoice_id, sum(amount) as credits from public.invoice_credits
                    where status='ACTIVE' group by invoice_id) cr
               on cr.invoice_id = i.id
       where i.document_status = 'POSTED' and i.deleted_at is null
         and (i.status in ('PAID','PARTIALLY_PAID'))
         and coalesce(i.paid_amount,0) > 0.001
         and coalesce(pa.alloc,0) + coalesce(cr.credits,0) < 0.001
    `,
  },
];

export async function runIntegrityChecks() {
  const findings = [];
  const db = await createDatabase();
  const r = await replay(db, { stopOnError: false });
  if (r.failures.length) {
    for (const f of r.failures.length) {
      findings.push(finding({
        id: 'DG-MIG-001', severity: SEVERITY.CRITICAL, category: 'migration',
        title: `Migration ${f.file} fails to replay`, evidence: f.error,
      }));
    }
    await db.close();
    return { findings, detectorsRun: 0, violations: 0 };
  }

  let detectorsRun = 0;
  let violations = 0;

  for (const d of DETECTORS) {
    let sql = d.sql;
    if (!sql && d.buildSQL) {
      const parts = [];
      for (const t of d.tables) {
        const exists = await db.query(
          `select to_regclass($1) is not null as ok`, [`public.${t}`],
        );
        if (exists.rows[0]?.ok) parts.push(d.buildSQL(t));
      }
      sql = parts.join('\nunion all\n');
    }
    if (!sql) continue;
    detectorsRun++;
    try {
      const res = await db.query(sql);
      if (res.rows.length) {
        violations += res.rows.length;
        for (const row of res.rows.slice(0, 10)) {
          findings.push(finding({
            id: d.id,
            severity: d.severity,
            category: d.category,
            title: d.title,
            evidence: Object.entries(row).map(([k, v]) => `${k}=${v}`).join(' | '),
            remediation: d.remediation,
          }));
        }
      }
    } catch (error) {
      findings.push(finding({
        id: 'DG-INT-DETECTOR',
        severity: SEVERITY.MEDIUM,
        category: 'data',
        title: `Integrity detector ${d.id} query failed`,
        evidence: String(error?.message ?? error).split('\n')[0],
        detail: 'Detector SQL must stay valid against the current schema.',
      }));
    }
  }

  await db.close();
  return { findings, detectorsRun, violations };
}
