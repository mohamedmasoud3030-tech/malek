/**
 * Phase 3A-1B — shared two-company PGlite fixture for invoice/payment/receipt/VOID
 * execution suites.
 *
 * Layout: company → admin → accounts (company-scoped assignment) → owner →
 * property → agreement → unit → tenant → contract → invoices.
 *
 * Company A is fully provisioned (chart 1111/1201/4000/2100 assigned to A,
 * VAT 5% enabled). Company B is deliberately UNPROVISIONED (no accounts) — every
 * cross-company/account-isolation path must fail loudly (require_company_account_id
 * P0001), never silently borrow A's chart.
 */
import type { PGlite } from '@electric-sql/pglite';

export const COMPANY_A = 'c31b0000-0000-4000-8000-000000000001';
export const COMPANY_B = 'c31b0000-0000-4000-8000-000000000002';
export const ADMIN_A = 'a31b0000-0000-4000-8000-000000000001';
export const ADMIN_B = 'a31b0000-0000-4000-8000-000000000002';
export const OWNER_A = 'b31b0000-0000-4000-8000-000000000001';
export const OWNER_B = 'b31b0000-0000-4000-8000-000000000002';
export const PROPERTY_A = 'd31b0000-0000-4000-8000-000000000001';
export const PROPERTY_B = 'd31b0000-0000-4000-8000-000000000002';
export const UNIT_A = 'e31b0000-0000-4000-8000-000000000001';
export const UNIT_B = 'e31b0000-0000-4000-8000-000000000002';
export const TENANT_A = 'f31b0000-0000-4000-8000-000000000001';
export const TENANT_B = 'f31b0000-0000-4000-8000-000000000002';
export const AGREEMENT_A = 'aa31b000-0000-4000-8000-000000000001';
export const AGREEMENT_B = 'aa31b000-0000-4000-8000-000000000002';
export const CONTRACT_A = 'cc31b000-0000-4000-8000-000000000001';
export const CONTRACT_B = 'cc31b000-0000-4000-8000-000000000002';
export const INVOICE_A1 = '1a31b000-0000-4000-8000-000000000001';
export const INVOICE_A2 = '2a31b000-0000-4000-8000-000000000001';
export const INVOICE_B1 = 'bb31b000-0000-4000-8000-000000000001';

export const ACCOUNT_NOS_A = ['1111', '1201', '4000', '2100'] as const;

export async function seedPhase3a1bFixture(db: PGlite, options?: { skipGeneratedInvoiceGuard?: boolean }) {
  void options;
  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Phase3A-1B Company A', 'phase3a1b-a'),
      ('${COMPANY_B}', 'Phase3A-1B Company B', 'phase3a1b-b');

    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin-a@phase3a1b.test'),
      ('${ADMIN_B}', 'admin-b@phase3a1b.test');

    insert into public.users (id, email, name, role, status) values
      ('${ADMIN_A}', 'admin-a@phase3a1b.test', 'Admin A', 'ADMIN', 'ACTIVE'),
      ('${ADMIN_B}', 'admin-b@phase3a1b.test', 'Admin B', 'ADMIN', 'ACTIVE');

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER_A}', 'Owner A', 'Owner A', '${COMPANY_A}'),
      ('${OWNER_B}', 'Owner B', 'Owner B', '${COMPANY_B}');

    insert into public.properties (id, title, name, type, address, company_id) values
      ('${PROPERTY_A}', 'Property A', 'Property A', 'residential', 'Sohar', '${COMPANY_A}'),
      ('${PROPERTY_B}', 'Property B', 'Property B', 'residential', 'Sohar', '${COMPANY_B}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) values
      ('${PROPERTY_A}', '${OWNER_A}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_A}'),
      ('${PROPERTY_B}', '${OWNER_B}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_B}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) values
      ('${AGREEMENT_A}', '${OWNER_A}', '${PROPERTY_A}', 'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31', '${COMPANY_A}'),
      ('${AGREEMENT_B}', '${OWNER_B}', '${PROPERTY_B}', 'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31', '${COMPANY_B}');

    insert into public.units (id, property_id, name, unit_number, company_id) values
      ('${UNIT_A}', '${PROPERTY_A}', 'Unit A', 'A-1', '${COMPANY_A}'),
      ('${UNIT_B}', '${PROPERTY_B}', 'Unit B', 'B-1', '${COMPANY_B}');

    insert into public.people (id, full_name, type, company_id) values
      ('${TENANT_A}', 'Tenant A', 'tenant', '${COMPANY_A}'),
      ('${TENANT_B}', 'Tenant B', 'tenant', '${COMPANY_B}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) values
      ('${CONTRACT_A}', '${PROPERTY_A}', '${UNIT_A}', '${TENANT_A}', date '2026-01-01', date '2026-12-31', 1000, 'active', '${AGREEMENT_A}', '${COMPANY_A}'),
      ('${CONTRACT_B}', '${PROPERTY_B}', '${UNIT_B}', '${TENANT_B}', date '2026-01-01', date '2026-12-31', 700, 'active', '${AGREEMENT_B}', '${COMPANY_B}');

    -- Seeded invoices sit in the PREVIOUS period (June) so the monthly invoice
    -- generator (current period = July) is not short-circuited by period dedup.
    -- invoices_contract_issue_date_unique enforces (contract_id, issue_date), so
    -- the two company-A invoices get distinct issue dates.
    insert into public.invoices
      (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, tax_rate, status, company_id) values
      ('${INVOICE_A1}', '${CONTRACT_A}', date '2026-06-01', date '2026-06-30', 1000, 0, 0, 0, 'UNPAID', '${COMPANY_A}'),
      ('${INVOICE_A2}', '${CONTRACT_A}', date '2026-06-15', date '2026-07-15', 500, 0, 0, 0, 'UNPAID', '${COMPANY_A}'),
      ('${INVOICE_B1}', '${CONTRACT_B}', date '2026-06-15', date '2026-07-15', 800, 0, 0, 0, 'UNPAID', '${COMPANY_B}');

    -- Company A: VAT enabled @5% (scoped row; singleton_key is NOT NULL UNIQUE so
    -- exactly one non-singleton row is possible — that models company A's row).
    -- Company B intentionally has NO settings row: the scoped VAT read finds
    -- nothing and tax rate falls back to 0 (the production no-row behavior).
    insert into public.company_settings (singleton_key, company_id, vat_enabled, vat_rate) values
      (false, '${COMPANY_A}', true, 5.0);

    -- Company A owns the canonical chart numbers; B is deliberately left without
    -- accounts so account resolution must fail loudly for B, never fall back to A.
    update public.accounts set company_id = '${COMPANY_A}' where no in ('1111', '1201', '4000', '2100');
  `);
}

/** Call a jsonb-taking RPC inside the current JWT context. */
export async function rpcJsonb(db: PGlite, name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)]);
  return (rows[0] as { result: Record<string, unknown> }).result;
}

export async function queryOne(db: PGlite, sql: string, params?: unknown[]) {
  const { rows } = await db.query(sql, params ?? []);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function journalBalance(db: PGlite, sourceId: string, companyId: string) {
  const { rows } = await db.query(
    `select
       coalesce(sum(case when type = 'DEBIT' then amount else 0 end), 0)::numeric as debit,
       coalesce(sum(case when type = 'CREDIT' then amount else 0 end), 0)::numeric as credit,
       coalesce(bool_and(company_id = $2::uuid), true) as company_ok,
       count(*)::int as count
     from public.journal_entries
     where source_id::text = $1`,
    [sourceId, companyId],
  );
  const row = rows[0] as { debit: string | number; credit: string | number; company_ok: boolean; count: number };
  return { debit: Number(row.debit), credit: Number(row.credit), companyOk: row.company_ok, count: row.count };
}
