# Next

This is the prioritized work list after the 2026-07-12 financial, migration, frontend-hardening, and governance updates.

## Priority 0 — release-candidate evidence

1. Freeze one release-candidate SHA and run the complete CI-equivalent suite.
2. Reconcile `supabase/migrations/` with the target environment's migration ledger using read-only checks; confirm zero unexplained versions and zero unintended pending migrations.
3. Verify live definitions and privileges for financial RPCs, report RPCs, RLS policies, triggers, foreign keys, and helper-function grants.
4. Run authenticated role-boundary tests for ADMIN, MANAGER, and USER, including direct denied RPC calls.
5. Browser-verify the full financial journey:
   - create/activate contract,
   - generate invoice and balanced journal entries,
   - record payment,
   - display payment-backed receipt,
   - void the receipt,
   - reconcile invoice, contract balance, tenant balance, cash flow, VAT, and financial summary.
6. Verify that QA cleanup/reversal entries are complete, balanced, and limited to their intended QA identifiers.
7. Archive command output, database evidence, browser traces/screenshots, test record IDs, and expected totals against the release-candidate SHA.

## Priority 1 — production UX evidence

- Verify every critical route with real authenticated data.
- Complete Arabic RTL checks across navigation, tables, forms, dialogs, sheets, reports, and generated documents.
- Complete mobile, tablet, and desktop responsive checks.
- Verify loading, empty, permission-denied, validation, and backend-error states.
- Verify configured company currency, decimals, locale, timezone, and date formatting.
- Verify receipt/invoice printing, PDF generation, and CSV exports.
- Verify bank-account, statement-line, import, match, suggested-match, and ignore flows.

## Priority 2 — reporting convergence

- Wire validated report RPCs one screen at a time.
- Add parity tests before replacing client/service aggregation.
- Keep `public.payments` as the receipt/collection source and exclude deleted/VOID rows.
- Validate daily collection, overdue, aged receivables, income statement, balance sheet, trial balance, rent roll, owner statement, and tenant statement totals against seeded scenarios.
- Remove or formally retain unused RPC overloads only after caller and dependency proof.

## Priority 3 — accounting/product completion

Implement the approved policies in the decision records before claiming complete property-management accounting:

1. Office management-fee calculation, VAT, exclusions, overrides, approvals, reversals, and owner payout lifecycle.
2. Master-lease fixed owner obligations independent of tenant collections.
3. Daily, weekly, and open-ended contracts with checkout invoicing and proration.
4. Utility posting and split responsibility across tenant, owner, office, and suspense.
5. Maintenance cost assignment to tenant, owner, office, or split paths.
6. Tenant deposit ledger and deferred/accrual treatment.
7. Operation-level permissions and denied-action UX for all sensitive financial operations.

## Priority 4 — later enhancements

- Bank-file upload and format mapping.
- Duplicate-detection and advanced reconciliation rules.
- Security-deposit management UI and statements.
- Deferred-revenue reporting.
- Multi-currency support.
- Lower-risk form-validation consistency and cosmetic cleanup.

## Closed or superseded

Do not reopen these as current blockers without new evidence:

- The legacy `tenant_balances → tenants` foreign-key issue: the repository now contains the guarded `people(id)` repair.
- Missing role-helper grants and the three first-cycle RPC/trigger failures: repair migrations are present.
- Sessions RLS ownership: corrected to `sessions.user_id`.
- Orphaned enum cleanup and baseline capture: completed and documented.
- Contract lifecycle direct-write gap: guarded atomic lifecycle RPCs are now represented.
- QA posted-ledger deletion: handled through financially neutral reversal entries rather than mutation of posted history.
