#!/usr/bin/env python3
"""P0 rollback generator — supabase/rollback/20260724_rollback_p0_company_isolation.sql.

Builds the rollback from the SAME sources as the fix migration:
  - policy/default target lists parsed from the fix migration itself,
  - pre-P0 function bodies from supabase/.p0-tmp-bodies/ (extracted from the
    pre-P0 migration chain),
  - pre-P0 effective attributes appendix for rpt_tenant_statement
    (20260713000006 upgraded it to SECURITY DEFINER via ALTER FUNCTION after
    its last CREATE body — evidence/p0/fn-effective-attrs.json).
Guarantees: 19/19 functions have a rollback path (18 restores + 1 drop of the
P0-created helper) and the schema fingerprint after rollback is identical to
pre-P0 main (proved by rentrix-app/src/p0/p0-forward-rollback.test.ts).
"""
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIX = open(os.path.join(REPO, 'supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql')).read()
BODIES = os.path.join(REPO, 'supabase/.p0-tmp-bodies')
OUT = os.path.join(REPO, 'supabase/rollback/20260724_rollback_p0_company_isolation.sql')

pol = re.findall(r'create policy p0_tenant_isolation on public\.?"?([A-Za-z0-9_\-]+)"?', FIX)
dflt = re.findall(r'alter table public\.?"?([A-Za-z0-9_\-]+)"? alter column company_id set default', FIX)


def q(t: str) -> str:
    return f'"{t}"' if not re.fullmatch(r'[a-z0-9_]+', t) else t


L = []
L += [
    '-- ============================================================================',
    '-- Rollback: P0 — Company Isolation Hardening (20260724120000)',
    '-- Date: 2026-07-24',
    '-- Purpose: revert the P0 migration to the EXACT pre-P0 schema fingerprint.',
    '--          Verified against evidence/p0/rls-enabled-prefix.json: all 56',
    '--          touched tables already had RLS ENABLED pre-P0, so only the P0',
    '--          objects are reverted:',
    '--            1. 56 restrictive p0_tenant_isolation policies dropped',
    '--            2. 55 company_id column DEFAULTs dropped',
    '--            3. 18 pre-P0 function bodies restored byte-for-byte from the',
    '--               pre-P0 migration chain (13 report RPCs + settlement draft +',
    '--               4 F-WR/F-AGR write-path functions)',
    '--            4. public.require_company_id() — created BY the P0 migration —',
    '--               dropped with its exact signature (no pre-P0 body exists).',
    '--            5. owner_agreements.company_id (+FK +index) — created BY the',
    '--               P0 migration — dropped (objects the migration itself added).',
    '--            6. rpt_tenant_statement attributes restored to SECURITY DEFINER',
    '--               (pre-P0 effective state per 20260713000006 / evidence:',
    '--               fn-effective-attrs.json).',
    '--          Coverage: 19/19 (evidence/p0/fn-coverage.json); fingerprint',
    '--          equivalence proved by src/p0/p0-forward-rollback.test.ts.',
    '-- WARNING: running this re-opens every cross-company read/write path and',
    '--          the T7 settlement spoof proven in evidence/p0/cause/ and',
    '--          docs/audits/P0_MULTI_TENANT_VERIFICATION_20260723.md',
    '-- ============================================================================',
    '',
    'begin;',
    '',
    '-- ── 1) drop P0 restrictive policies (pre-P0 permissive policies untouched) ──',
]
for t in pol:
    L.append(f'drop policy if exists p0_tenant_isolation on public.{q(t)};')
L += [
    '',
    '-- ── 2) drop P0 company_id column defaults (columns themselves stay) ──',
]
for t in dflt:
    L.append(f'alter table public.{q(t)} alter column company_id drop default;')
L += [
    '',
    '-- ── 3) drop objects the P0 migration itself created ───────────────────────',
    'drop function if exists public.require_company_id();',
    'alter table public.owner_agreements drop constraint if exists owner_agreements_company_id_fkey;',
    'drop index if exists public.owner_agreements_company_id_idx;',
    'alter table public.owner_agreements drop column if exists company_id;',
    '',
    '-- ── 4) restore pre-P0 function bodies (verbatim from the pre-P0 chain) ──',
    '',
]
order = [
    'rpt_cash_flow', 'rpt_dashboard_overview', 'rpt_daily_collection', 'rpt_vat_return',
    'rpt_financial_summary', 'rpt_trial_balance', 'rpt_income_statement', 'rpt_balance_sheet',
    'rpt_owner_statement', 'rpt_tenant_statement', 'rpt_aged_receivables', 'rpt_overdue_invoices',
    'rpt_rent_roll', 'create_owner_settlement_draft_atomic',
    'record_invoice_payment_atomic', 'post_receipt_atomic',
    'update_contract_balance_from_allocation', 'create_owner_agreement_atomic',
]
for fn in order:
    body = open(os.path.join(BODIES, f'{fn}.sql')).read().strip()
    assert re.search(r'create\s+or\s+replace\s+function', body, re.I), fn
    assert 'P0 (' not in body, f'{fn} must be the PRE-P0 body'
    L.append(f'-- restore: {fn}')
    L.append(body)
    if fn == 'rpt_tenant_statement':
        L.append('-- pre-P0 effective attributes (20260713000006: ALTER FUNCTION … SECURITY DEFINER)')
        L.append('alter function public.rpt_tenant_statement(uuid) security definer;')
        L.append('alter function public.rpt_tenant_statement(uuid) set search_path = public, pg_temp;')
    L.append('')
L.append('commit;')
open(OUT, 'w').write('\n'.join(L) + '\n')
print(f'wrote {OUT}: {os.path.getsize(OUT)} bytes; {len(pol)} policy drops; {len(dflt)} default drops; {len(order)} restores + 1 fn drop + 1 column drop + attr appendix')
