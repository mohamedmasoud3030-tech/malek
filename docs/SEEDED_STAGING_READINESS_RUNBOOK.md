# Seeded Staging Readiness Runbook

This runbook defines the safe, reproducible staging checks needed after the local readiness gates pass. It is intentionally staging-first and read-only-by-default; mutating financial journeys require a seeded staging dataset and explicit approval for that run.

## Required environment

| Variable | Purpose | Required for |
| --- | --- | --- |
| `E2E_BASE_URL` | Staging or preview app URL | Authenticated browser smoke |
| `E2E_TEST_EMAIL` | Seeded low-risk test user email | Authenticated browser smoke |
| `E2E_TEST_PASSWORD` | Seeded low-risk test user password | Authenticated browser smoke |
| `SUPABASE_DB_URL` | Approved read-only Postgres URL | Supabase live readiness |
| `RENTRIX_STAGING_SEED_ID` | Human-readable seed batch id | Evidence correlation |

## Seeded data requirements

The staging seed must be safe to mutate and reset. Do not use production tenants, owners, contracts, or real payment records.

| Seed entity | Required shape |
| --- | --- |
| Admin/operator user | Can view readiness surfaces and run allowed test actions. |
| Manager user | Can create invoices, record payments, export operational reports, and manage tenants/contracts, but cannot void receipts, approve/pay settlements, or give final reconciliation approval unless explicitly granted. |
| Accountant user | Can create invoices, record payments, void with reason, manage settlements/reconciliation/reports, and perform financial adjustments according to assigned permissions. |
| Read-only/viewer user | Cannot perform financial operations used in denied-action checks. |
| Property/unit/tenant/owner | Linked enough to create an active contract and generated invoice. |
| Active contract | Has predictable rent, due date, and billing cycle for invoice generation. |
| Bank account/statement line | Safe statement line for reconciliation matching tests. |
| Report period | Known date range containing only seeded financial activity for total reconciliation. |

## Ordered staging verification

1. Run CI checks for the release commit: install, typecheck, lint, build, test, `test:financials`, and `typecheck:test`.
2. Run `pnpm e2e` against the staging URL with `E2E_BASE_URL`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD`.
3. Run `pnpm supabase:live-readiness` with an approved read-only `SUPABASE_DB_URL` and archive the output.
4. In seeded staging only, run invoice -> payment -> receipt -> void receipt/payment -> report proof -> statement proof -> audit proof and record the generated ids.
5. Run backend authorization evidence for financial RPC/RLS/grants using read-only inspection plus a denied-action app/browser check for the read-only/user role.
6. Capture screenshots for login, dashboard shell, invoices, receipts, reports, and bank reconciliation at desktop/tablet/mobile breakpoints.
7. Reset or mark the seed batch according to the staging data policy, then attach the seed id and rollback/reset notes to the release evidence ledger.

## Stop conditions

Stop the release readiness claim if any of these occur:

- The target URL is production and the planned check mutates data.
- Seed credentials are missing, shared with a real user, or not scoped to staging.
- `SUPABASE_DB_URL` is not read-only or the operator cannot identify the target project.
- Payment/receipt/report/statement totals do not reconcile after voiding within the approved 0.01 currency-unit tolerance.
- Frontend permission denial is not backed by backend RLS/RPC/grant evidence.
- A product/accounting decision is missing, superseded, or not implemented for the flow being claimed ready.
