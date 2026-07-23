#!/usr/bin/env python3
"""
P0 fix assembler — regenerates supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql
from the live latest function bodies + assert-driven surgical patches.

Every patch pattern is asserted to match EXACTLY ONCE; a drifted source body
aborts the build instead of emitting a wrong migration.

Run:  python3 scripts/p0/assemble_p0_fix.py   (from repo root)
Requires the extracted latest bodies — regenerate with scripts/p0/extract_rpt_bodies.py first.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BODIES = ROOT / 'supabase' / '.p0-tmp-bodies'
OUT = ROOT / 'supabase' / 'migrations' / '20260724120000_p0_company_isolation_reports_rls.sql'
EVIDENCE = ROOT / 'evidence' / 'p0' / 'company-id-surface.json'


def load(name: str) -> str:
    path = BODIES / f'{name}.sql'
    if not path.exists():
        sys.exit(f'missing extracted body: {path} (run extract_rpt_bodies.py)')
    return path.read_text()


def rep(text: str, old: str, new: str, tag: str) -> str:
    assert old in text, f'PATTERN-MISS [{tag}]: {old[:90]!r}'
    assert text.count(old) == 1, f'PATTERN-NONUNIQUE [{tag}]: {old[:90]!r} x{text.count(old)}'
    return text.replace(old, new)


HEADER = """-- ============================================================================
-- P0 — Company Isolation Hardening (multi-tenant leak closure)
-- ============================================================================
-- Evidence: docs/audits/P0_MULTI_TENANT_VERIFICATION_20260723.md
-- Approved P0 fix set (behaviorally confirmed before this migration):
--   F-RPT  13 report RPCs derive the caller company (JWT) and filter every
--          source table by it. Business logic is otherwise unchanged — numeric
--          parity gate: rentrix-app/src/p0/p0-multi-tenant-isolation.test.ts.
--   F-RLS  Uniform RESTRICTIVE policy `p0_tenant_isolation` per tenant table.
--          Existing permissive role policies are untouched; PostgreSQL ANDs
--          restrictive policies with permissive ones. Column DEFAULT
--          public.current_company_id() keeps `with check` compatible with
--          direct client inserts (controllers already stamp company_id;
--          rows that omit it now auto-stamp from the caller context).
--   F-AGMT owner_agreements gains company_id (additive + backfill from owners).
--   F-SET  create_owner_settlement_draft_atomic rejects owners/properties that
--          do not belong to the caller's company (closes the T7 cross-tenant
--          draft creation proven on replayed main).
-- Invariants: no DROP TABLE/COLUMN, no data deletion, SECURITY DEFINER kept
-- with pinned search_path, REVOKE/GRANT baseline preserved.
-- Rollback: supabase/rollback/20260724_rollback_p0_company_isolation.sql
-- ============================================================================

begin;
"""

HELPER = """
-- ── 0) strict company-context helper ────────────────────────────────────────
create or replace function public.require_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if public.current_company_id() is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode = '42501';
  end if;
  return public.current_company_id();
end;
$fn$;

revoke all on function public.require_company_id() from public, anon;
grant execute on function public.require_company_id() to authenticated, service_role;
"""

AGMT = """
-- ── 1) owner_agreements.company_id (additive + backfill + FK + index) ───────
alter table public.owner_agreements add column if not exists company_id uuid;

update public.owner_agreements oa
   set company_id = o.company_id
  from public.owners o
 where oa.owner_id = o.id
   and oa.company_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'owner_agreements_company_id_fkey') then
    alter table public.owner_agreements
      add constraint owner_agreements_company_id_fkey foreign key (company_id) references public.companies(id);
  end if;
end $$;

create index if not exists owner_agreements_company_id_idx on public.owner_agreements (company_id);
"""


def build_function_fixes() -> dict[str, str]:
    bodies: dict[str, str] = {}

    t = load('rpt_cash_flow')
    t = rep(t, "  v_receipts numeric;\n  v_expenses numeric;\n",
            "  v_receipts numeric;\n  v_expenses numeric;\n  v_company_id uuid := public.require_company_id();\n", 'cf.decl')
    t = rep(t, "  WHERE payment_date BETWEEN p_from_date AND p_to_date\n    AND deleted_at IS NULL",
            "  WHERE payment_date BETWEEN p_from_date AND p_to_date\n    AND company_id = v_company_id\n    AND deleted_at IS NULL", 'cf.pay')
    t = rep(t, "  WHERE expense_date BETWEEN p_from_date AND p_to_date\n    AND deleted_at IS NULL",
            "  WHERE expense_date BETWEEN p_from_date AND p_to_date\n    AND company_id = v_company_id\n    AND deleted_at IS NULL", 'cf.exp')
    bodies['rpt_cash_flow'] = t

    t = load('rpt_dashboard_overview')
    t = rep(t, "  v_result jsonb;\nbegin\n",
            "  v_result jsonb;\n  v_company_id uuid := public.require_company_id();\nbegin\n", 'db.decl')
    t = rep(t, "from public.properties where deleted_at is null),",
            "from public.properties where deleted_at is null and company_id = v_company_id),", 'db.props')
    t = rep(t, "from public.units where deleted_at is null),",
            "from public.units where deleted_at is null and company_id = v_company_id),", 'db.units')
    t = rep(t, "from public.contracts\n        where deleted_at is null\n          and upper(coalesce(status::text, '')) = 'ACTIVE'\n      ),",
            "from public.contracts\n        where deleted_at is null and company_id = v_company_id\n          and upper(coalesce(status::text, '')) = 'ACTIVE'\n      ),", 'db.active')
    t = rep(t, "from public.contracts\n        where deleted_at is null\n          and upper(coalesce(status::text, '')) = 'ACTIVE'\n          and btrim",
            "from public.contracts\n        where deleted_at is null and company_id = v_company_id\n          and upper(coalesce(status::text, '')) = 'ACTIVE'\n          and btrim", 'db.expiring')
    t = rep(t, "from public.units\n        where deleted_at is null\n          and lower(coalesce(status::text, '')) in ('available', 'vacant')",
            "from public.units\n        where deleted_at is null and company_id = v_company_id\n          and lower(coalesce(status::text, '')) in ('available', 'vacant')", 'db.vacant')
    t = rep(t, "from public.invoices\n        where deleted_at is null\n          and upper(coalesce(status::text, '')) = 'OVERDUE'",
            "from public.invoices\n        where deleted_at is null and company_id = v_company_id\n          and upper(coalesce(status::text, '')) = 'OVERDUE'", 'db.overdue')
    t = re.sub(r"\nalter function public\.rpt_dashboard_overview[\s\S]*$", "\n", t)
    bodies['rpt_dashboard_overview'] = t

    t = load('rpt_daily_collection')
    t = rep(t, "  v_rows jsonb;\n  v_total numeric := 0;\nbegin\n",
            "  v_rows jsonb;\n  v_total numeric := 0;\n  v_company_id uuid := public.require_company_id();\nbegin\n", 'dc.decl')
    t = rep(t, "from public.payments p\n    where p.deleted_at is null",
            "from public.payments p\n    where p.deleted_at is null and p.company_id = v_company_id", 'dc.pay')
    t = re.sub(r"\nalter function public\.rpt_daily_collection[\s\S]*$", "\n", t)
    bodies['rpt_daily_collection'] = t

    t = load('rpt_vat_return')
    t = rep(t, "DECLARE\n  v_result jsonb;\n",
            "DECLARE\n  v_result jsonb;\n  v_company_id uuid := public.require_company_id();\n", 'vat.decl')
    t = rep(t, "  FROM public.invoices\n  WHERE issue_date BETWEEN p_from_date AND p_to_date\n    AND deleted_at IS NULL",
            "  FROM public.invoices\n  WHERE issue_date BETWEEN p_from_date AND p_to_date\n    AND company_id = v_company_id\n    AND deleted_at IS NULL", 'vat.inv')
    bodies['rpt_vat_return'] = t

    t = load('rpt_financial_summary')
    cidi = 'public.current_company_id()'
    t = rep(t, "WHERE payment.deleted_at IS NULL",
            f"WHERE payment.deleted_at IS NULL\n          AND payment.company_id = {cidi}", 'fs.pay')
    t = rep(t, "WHERE expense.deleted_at IS NULL",
            f"WHERE expense.deleted_at IS NULL\n          AND expense.company_id = {cidi}", 'fs.exp')
    t = rep(t, "WHERE invoice.deleted_at IS NULL\n          AND invoice.issue_date BETWEEN p_from AND p_to",
            f"WHERE invoice.deleted_at IS NULL\n          AND invoice.company_id = {cidi}\n          AND invoice.issue_date BETWEEN p_from AND p_to", 'fs.rev')
    t = t.replace("FROM public.invoices AS invoice\n        WHERE invoice.deleted_at IS NULL\n          AND invoice.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')",
                  f"FROM public.invoices AS invoice\n        WHERE invoice.deleted_at IS NULL\n          AND invoice.company_id = {cidi}\n          AND invoice.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')")
    assert t.count(cidi) == 6, f'fs filter count = {t.count(cidi)} (expected 6)'
    t = rep(t, "FROM public.contracts AS contract_record\n        WHERE contract_record.deleted_at IS NULL",
            f"FROM public.contracts AS contract_record\n        WHERE contract_record.deleted_at IS NULL\n          AND contract_record.company_id = {cidi}", 'fs.contracts')
    t = rep(t, "FROM public.units AS unit_record\n        WHERE unit_record.deleted_at IS NULL\n      ), 0) AS total_units,",
            f"FROM public.units AS unit_record\n        WHERE unit_record.deleted_at IS NULL\n          AND unit_record.company_id = {cidi}\n      ), 0) AS total_units,", 'fs.units-total')
    t = rep(t, "FROM public.units AS unit_record\n        WHERE unit_record.deleted_at IS NULL\n          AND unit_record.status = 'occupied'",
            f"FROM public.units AS unit_record\n        WHERE unit_record.deleted_at IS NULL\n          AND unit_record.company_id = {cidi}\n          AND unit_record.status = 'occupied'", 'fs.units-occ')
    bodies['rpt_financial_summary'] = t

    t = load('rpt_trial_balance')
    t = rep(t, "  v_total_credits numeric := 0;\nBEGIN\n",
            "  v_total_credits numeric := 0;\n  v_company_id uuid := public.require_company_id();\nBEGIN\n", 'tb.decl')
    t = rep(t, "    FROM public.payments\n   WHERE deleted_at IS NULL\n     AND (status IS NULL OR upper(status) <> 'VOID')\n     AND payment_date <= p_as_of;",
            "    FROM public.payments\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id\n     AND (status IS NULL OR upper(status) <> 'VOID')\n     AND payment_date <= p_as_of;", 'tb.cash')
    assert t.count("    FROM public.invoices\n   WHERE deleted_at IS NULL") == 3
    t = t.replace("    FROM public.invoices\n   WHERE deleted_at IS NULL",
                  "    FROM public.invoices\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id")
    t = rep(t, "    FROM public.expenses\n   WHERE deleted_at IS NULL",
            "    FROM public.expenses\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id", 'tb.exp')
    t = rep(t, "    FROM public.owner_settlements\n   WHERE (status IS NULL OR status <> 'CANCELLED')",
            "    FROM public.owner_settlements\n   WHERE company_id = v_company_id\n     AND (status IS NULL OR status <> 'CANCELLED')", 'tb.settle')
    bodies['rpt_trial_balance'] = t

    t = load('rpt_income_statement')
    t = rep(t, "  v_expense_rows jsonb;\nBEGIN\n",
            "  v_expense_rows jsonb;\n  v_company_id uuid := public.require_company_id();\nBEGIN\n", 'is.decl')
    t = rep(t, "    FROM public.invoices\n   WHERE deleted_at IS NULL",
            "    FROM public.invoices\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id", 'is.rev')
    t = rep(t, "        FROM public.expenses\n       WHERE deleted_at IS NULL",
            "        FROM public.expenses\n       WHERE deleted_at IS NULL\n         AND company_id = v_company_id", 'is.cat')
    t = rep(t, "    FROM public.expenses\n   WHERE deleted_at IS NULL",
            "    FROM public.expenses\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id", 'is.exp')
    bodies['rpt_income_statement'] = t

    t = load('rpt_balance_sheet')
    t = rep(t, "  v_equity_rows jsonb;\nBEGIN\n",
            "  v_equity_rows jsonb;\n  v_company_id uuid := public.require_company_id();\nBEGIN\n", 'bs.decl')
    t = rep(t, "    FROM public.payments\n   WHERE deleted_at IS NULL",
            "    FROM public.payments\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id", 'bs.cash')
    assert t.count("    FROM public.invoices\n   WHERE deleted_at IS NULL") == 2
    t = t.replace("    FROM public.invoices\n   WHERE deleted_at IS NULL",
                  "    FROM public.invoices\n   WHERE deleted_at IS NULL\n     AND company_id = v_company_id")
    t = rep(t, "    FROM public.owner_settlements\n   WHERE (status IS NULL OR status <> 'CANCELLED')",
            "    FROM public.owner_settlements\n   WHERE company_id = v_company_id\n     AND (status IS NULL OR status <> 'CANCELLED')", 'bs.settle')
    bodies['rpt_balance_sheet'] = t

    t = load('rpt_owner_statement')
    t = rep(t, "  v_total_net numeric := 0;\nBEGIN\n",
            "  v_total_net numeric := 0;\n  v_company_id uuid := public.require_company_id();\nBEGIN\n", 'os.decl')
    t = rep(t, "FROM public.owners WHERE id = p_owner_id AND deleted_at IS NULL;",
            "FROM public.owners WHERE id = p_owner_id AND company_id = v_company_id AND deleted_at IS NULL;", 'os.owner')
    t = rep(t, "WHERE oa.owner_id = p_owner_id\n    AND oa.starts_on <= p_to",
            "WHERE oa.owner_id = p_owner_id\n    AND oa.company_id = v_company_id\n    AND oa.starts_on <= p_to", 'os.agreement')
    t = rep(t, "    WHERE c.deleted_at IS NULL\n  ), payment_rows AS (",
            "    WHERE c.deleted_at IS NULL AND c.company_id = v_company_id\n  ), payment_rows AS (", 'os.contracts')
    t = rep(t, "    WHERE p.deleted_at IS NULL AND upper(COALESCE(p.status, '')) <> 'VOID'\n      AND COALESCE(p.payment_date, public._safe_date(p.date_time::text)) BETWEEN p_from AND p_to",
            "    WHERE p.deleted_at IS NULL AND p.company_id = v_company_id AND upper(COALESCE(p.status, '')) <> 'VOID'\n      AND COALESCE(p.payment_date, public._safe_date(p.date_time::text)) BETWEEN p_from AND p_to", 'os.payments')
    t = rep(t, "    WHERE s.owner_id::text = p_owner_id::text AND public._safe_date(s.date) BETWEEN p_from AND p_to",
            "    WHERE s.owner_id::text = p_owner_id::text AND s.company_id = v_company_id AND public._safe_date(s.date) BETWEEN p_from AND p_to", 'os.settlements')
    bodies['rpt_owner_statement'] = t

    t = load('rpt_tenant_statement')
    t = rep(t, "join properties pr on pr.id=u.property_id where c.id=p_contract_id::text;",
            "join properties pr on pr.id=u.property_id where c.id=p_contract_id::text\n    and c.company_id = public.current_company_id();", 'ts.contract')
    t = rep(t, "    from invoices i where i.contract_id=p_contract_id::text",
            "    from invoices i where i.contract_id=p_contract_id::text and i.company_id = public.current_company_id()", 'ts.invoices')
    t = rep(t, "    from receipts r where r.contract_id=p_contract_id::text and r.status='POSTED'",
            "    from receipts r where r.contract_id=p_contract_id::text and r.status='POSTED' and r.company_id = public.current_company_id()", 'ts.receipts')
    bodies['rpt_tenant_statement'] = t

    t = load('rpt_aged_receivables')
    t = rep(t, "      AND i.deleted_at IS NULL\n      AND public._safe_date(i.due_date) <= p_as_of",
            "      AND i.deleted_at IS NULL\n      AND i.company_id = public.current_company_id()\n      AND public._safe_date(i.due_date) <= p_as_of", 'ar.inv')
    bodies['rpt_aged_receivables'] = t

    t = load('rpt_overdue_invoices')
    t = rep(t, "    AND i.deleted_at IS NULL\n    AND public._safe_date(i.due_date) < p_as_of",
            "    AND i.deleted_at IS NULL\n    AND i.company_id = public.current_company_id()\n    AND public._safe_date(i.due_date) < p_as_of", 'oi.inv')
    bodies['rpt_overdue_invoices'] = t

    t = load('rpt_rent_roll')
    t = rep(t, "      WHERE i.contract_id = c.id AND i.deleted_at IS NULL",
            "      WHERE i.contract_id = c.id AND i.deleted_at IS NULL\n        AND i.company_id = public.current_company_id()", 'rr.inv')
    t = rep(t, "  WHERE u.deleted_at IS NULL;",
            "  WHERE u.deleted_at IS NULL\n    AND u.company_id = public.current_company_id();", 'rr.units')
    bodies['rpt_rent_roll'] = t

    t = load('create_owner_settlement_draft_atomic')
    guard = (
        "  if least(v_gross, v_fee, v_expenses, v_tax) < 0 then raise exception 'Settlement amounts cannot be negative.'; end if;\n"
        "\n"
        "  -- P0 (F-SET): the settlement target must belong to the caller's company.\n"
        "  if not exists (\n"
        "    select 1 from public.owners o\n"
        "    where o.id::text = v_owner_id and o.company_id = v_company_id and o.deleted_at is null\n"
        "  ) then\n"
        "    raise exception 'Settlement target owner is not in your company.' using errcode = '42501';\n"
        "  end if;\n"
        "  if v_property_id is not null and not exists (\n"
        "    select 1 from public.properties p\n"
        "    where p.id::text = v_property_id and p.company_id = v_company_id and p.deleted_at is null\n"
        "  ) then\n"
        "    raise exception 'Settlement target property is not in your company.' using errcode = '42501';\n"
        "  end if;"
    )
    t = rep(t,
            "  if least(v_gross, v_fee, v_expenses, v_tax) < 0 then raise exception 'Settlement amounts cannot be negative.'; end if;",
            guard, 'set.guard')
    bodies['create_owner_settlement_draft_atomic'] = t

    # ── F-WR / F-AGR: write-path cross-tenant guards (CONFIRMED in operation
    # matrix + precision probes: REST UPDATE/DELETE/spoof-INSERT succeeded
    # cross-company pre-P0; RPC write paths trusted payload ids) ─────────────

    t = load('record_invoice_payment_atomic')
    t = rep(t, "  v_result jsonb;\nBEGIN",
            "  v_result jsonb;\n  v_company_id uuid;\nBEGIN", 'rip.declare')
    t = rep(t,
            "  IF NOT coalesce(public.is_admin_or_manager(), false) THEN\n"
            "    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'\n"
            "      USING ERRCODE = '42501';\n"
            "  END IF;",
            "  IF NOT coalesce(public.is_admin_or_manager(), false) THEN\n"
            "    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'\n"
            "      USING ERRCODE = '42501';\n"
            "  END IF;\n"
            "\n"
            "  -- P0 (F-WR): bind the operation to the caller's company.\n"
            "  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;\n"
            "  IF v_company_id IS NULL THEN\n"
            "    RAISE EXCEPTION 'Company context is required (no company_id claim in JWT).' USING ERRCODE = '42501';\n"
            "  END IF;", 'rip.company')
    t = rep(t,
            "    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL\n"
            "  FOR UPDATE;",
            "    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL\n"
            "    AND coalesce(to_jsonb(invoice_record)->>'company_id', '') = v_company_id::text\n"
            "  FOR UPDATE;", 'rip.invoice-scope')
    bodies['record_invoice_payment_atomic'] = t

    t = load('post_receipt_atomic')
    t = rep(t,
            "    WHERE invoice_record.id::text = v_invoice_id_text\n"
            "    FOR UPDATE;",
            "    WHERE invoice_record.id::text = v_invoice_id_text\n"
            "      AND coalesce((to_jsonb(invoice_record)->>'company_id')::text, '') = v_company_id::text\n"
            "    FOR UPDATE;", 'pr.invoice-scope')
    t = rep(t,
            "  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');",
            "  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');\n"
            "  -- P0 (F-WR): the receipt contract must belong to the caller's company.\n"
            "  IF v_receipt_contract_id IS NOT NULL AND NOT EXISTS (\n"
            "    SELECT 1 FROM public.contracts contract_record\n"
            "    WHERE contract_record.id::text = v_receipt_contract_id::text\n"
            "      AND contract_record.company_id = v_company_id\n"
            "      AND contract_record.deleted_at IS NULL\n"
            "  ) THEN\n"
            "    RAISE EXCEPTION 'غير مصرح: العقد لا ينتمي إلى شركتك.' USING ERRCODE = '42501';\n"
            "  END IF;", 'pr.contract-scope')
    bodies['post_receipt_atomic'] = t

    t = load('update_contract_balance_from_allocation')
    t = rep(t, "  v_unit_id text;\nBEGIN",
            "  v_unit_id text;\n  v_company_id uuid;\nBEGIN", 'ucba.declare')
    t = rep(t,
            "    c.unit_id::text\n  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id",
            "    c.unit_id::text,\n    c.company_id\n  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id, v_company_id", 'ucba.select')
    t = rep(t,
            "    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at\n",
            "    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id\n", 'ucba.cols')
    t = rep(t,
            "    v_total_invoiced - v_total_paid,\n    now()\n  )",
            "    v_total_invoiced - v_total_paid,\n    now(),\n    v_company_id\n  )", 'ucba.vals')
    # c.company_id is selected above, so it must be grouped (fixes runtime
    # 42803 caught by the release gate: the WHERE pins a single contract, so
    # grouping by company_id is identity-preserving).
    t = rep(t,
            "  GROUP BY c.tenant_id, c.unit_id;",
            "  GROUP BY c.tenant_id, c.unit_id, c.company_id;", 'ucba.groupby')
    bodies['update_contract_balance_from_allocation'] = t

    t = load('create_owner_agreement_atomic')
    # Revival repair (chain-verified): the VALUES list feeds the uuid column a
    # raw text expression — cast it so the revived RPC actually works.
    t = rep(t, "    payload->>'property_id',", "    (payload->>'property_id')::uuid,", 'agr.property-cast')
    t = rep(t,
            "  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;",
            "  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;\n"
            "\n"
            "  -- P0 (F-AGR): revived by F-AGMT (owner_agreements.company_id); the\n"
            "  -- agreement must not bind a foreign owner/property to the caller's\n"
            "  -- company stamp.\n"
            "  IF v_company_id IS NULL THEN\n"
            "    RAISE EXCEPTION 'Company context is required (no company_id claim in JWT).' USING ERRCODE = '42501';\n"
            "  END IF;\n"
            "  IF NOT EXISTS (\n"
            "    SELECT 1 FROM public.owners o\n"
            "    WHERE o.id = (payload->>'owner_id')::uuid AND o.company_id = v_company_id AND o.deleted_at IS NULL\n"
            "  ) THEN\n"
            "    RAISE EXCEPTION 'Agreement owner is not in your company.' USING ERRCODE = '42501';\n"
            "  END IF;\n"
            "  IF NOT EXISTS (\n"
            "    SELECT 1 FROM public.properties pr\n"
            "    WHERE pr.id::text = payload->>'property_id' AND pr.company_id = v_company_id AND pr.deleted_at IS NULL\n"
            "  ) THEN\n"
            "    RAISE EXCEPTION 'Agreement property is not in your company.' USING ERRCODE = '42501';\n"
            "  END IF;", 'agr.guards')
    bodies['create_owner_agreement_atomic'] = t

    return bodies


def build_tenant_sections() -> str:
    surf = json.loads(EVIDENCE.read_text())
    tables = sorted(r['table_name'] for r in surf['companyIdColumns'])
    assert len(tables) >= 50, f'suspicious tenant table count: {len(tables)}'
    tables.append('owner_agreements')  # F-AGMT column added above.
    out = ["\n-- ── 2) company_id column defaults (auto-stamp on direct inserts) ────────\n"]
    for tbl in tables:
        out.append(f'alter table public."{tbl}" alter column company_id set default public.current_company_id();')
    out.append("\n-- ── 3) uniform RESTRICTIVE tenant-isolation policies ────────────────────\n")
    for tbl in tables:
        out.append(f'alter table public."{tbl}" enable row level security;')
        out.append(f'drop policy if exists p0_tenant_isolation on public."{tbl}";')
        out.append(
            f'create policy p0_tenant_isolation on public."{tbl}" as restrictive\n'
            '  using (company_id = public.current_company_id())\n'
            '  with check (company_id = public.current_company_id());'
        )
    # companies self-row: keyed by id, not company_id.
    out.append("alter table public.companies enable row level security;")
    out.append("drop policy if exists p0_tenant_isolation on public.companies;")
    out.append(
        "create policy p0_tenant_isolation on public.companies as restrictive\n"
        "  using (id = public.current_company_id());"
    )
    return '\n'.join(out) + '\n'


def main() -> None:
    bodies = build_function_fixes()
    report_order = [
        'rpt_cash_flow', 'rpt_dashboard_overview', 'rpt_daily_collection', 'rpt_vat_return',
        'rpt_financial_summary', 'rpt_trial_balance', 'rpt_income_statement', 'rpt_balance_sheet',
        'rpt_owner_statement', 'rpt_tenant_statement', 'rpt_aged_receivables',
        'rpt_overdue_invoices', 'rpt_rent_roll',
    ]
    parts = [HEADER, HELPER, AGMT, build_tenant_sections(),
             "\n-- ── 4) report RPCs: company derivation + explicit company filters ─────\n"]
    parts += [f"\n-- [P0] {n}\n{bodies[n].strip()}\n" for n in report_order]
    # Preserve pre-P0 effective security attributes: 20260713000006 upgrades
    # rpt_tenant_statement to SECURITY DEFINER via ALTER FUNCTION after its
    # last CREATE body (see evidence/p0/fn-effective-attrs.json). Without this
    # appendix the replacement body would silently downgrade it to INVOKER.
    parts += [
        "\n-- [P0] attribute parity: pre-P0 effective attrs (20260713000006)\n"
        "alter function public.rpt_tenant_statement(uuid) security definer;\n"
        "alter function public.rpt_tenant_statement(uuid) set search_path = public, pg_temp;\n"
    ]
    parts.append(f"\n-- [P0] settlement draft isolation guard (F-SET)\n{bodies['create_owner_settlement_draft_atomic'].strip()}\n")
    parts.append("\n-- ── 5) write-path guards (F-WR/F-AGR) — close the cross-tenant writes\n")
    parts.append("-- confirmed in evidence/p0/cause/operation-matrix.json + precision-probes.json\n")
    for n in ['record_invoice_payment_atomic', 'post_receipt_atomic',
              'update_contract_balance_from_allocation', 'create_owner_agreement_atomic']:
        parts.append(f"\n-- [P0] {n}\n{bodies[n].strip()}\n")
    parts.append('\ncommit;\n')
    OUT.write_text(''.join(parts))
    print(f'writes {OUT.name}: {OUT.stat().st_size} bytes; report fns: {len(report_order)}')


if __name__ == '__main__':
    main()
