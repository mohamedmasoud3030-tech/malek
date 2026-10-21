/**
 * MALEK — gap evidence registry.
 *
 * Maps each open gap to executable proof units that exist in this repository. A proof unit is either:
 *   - a Vitest file that runs against a real PostgreSQL 18 engine (PGlite) or pure TypeScript logic, or
 *   - a repository script that performs a behavioural check.
 *
 * The registry is deliberately conservative. A gap is only mapped to a unit whose test titles were
 * read and confirmed to exercise that gap's subject matter. Where no local unit can exist (hosted
 * Auth, browsers, a pilot office, a legal opinion) the gap is mapped to nothing and says so.
 *
 * `remaining` is the honest boundary: what local execution can never establish. It is copied into the
 * evidence artifact so no reader can mistake engine-level proof for hosted proof.
 *
 * Status vocabulary produced by the runner:
 *   PROVEN_LOCALLY     every mapped unit passed at this SHA
 *   FAILED             at least one mapped unit failed — a real defect, not an evidence gap
 *   NO_LOCAL_PROOF     no unit exists here; the gap needs an environment or an authority
 */

export const PROOF_UNITS = {
  'rls-matrix': {
    kind: 'script',
    command: ['node', 'scripts/supabase-tests/rls-matrix.mjs'],
    title: 'Two-company RLS / role / authorization matrix on the replayed schema',
  },
  'sensitive-writes': {
    kind: 'script',
    command: ['node', 'scripts/check-sensitive-financial-write-boundary.mjs'],
    title: 'SEC-009 direct browser write boundary over production source',
  },
  'sensitive-writes-tests': {
    kind: 'script',
    command: ['node', '--test', 'scripts/check-sensitive-financial-write-boundary.test.mjs'],
    title: 'Negative tests proving the SEC-009 guard detects violations',
  },
  'permission-catalog': {
    kind: 'vitest',
    file: 'malek-app/src/features/auth/permission-catalog-authority.pglite.test.ts',
    title: 'Database replay reproduces the authoritative permission catalog per role',
  },
  'company-isolation': {
    kind: 'vitest',
    file: 'malek-app/src/features/auth/company-unscoped-tables-isolation.pglite.test.ts',
    title: 'Company-scoped isolation for unscoped tables',
  },
  'core-financial': {
    kind: 'vitest',
    file: 'malek-app/src/features/core-operations/core-financial-operations.pglite.test.ts',
    title: 'Contract obligation → invoice → maker/checker approval → collection',
  },
  'core-data': {
    kind: 'vitest',
    file: 'malek-app/src/features/core-operations/core-data-operations-matrix.pglite.test.ts',
    title: 'Core data operations matrix',
  },
  'owner-reconciliation': {
    kind: 'vitest',
    file: 'malek-app/src/features/lifecycle/p2-owner-reconciliation-journey.pglite.test.ts',
    title: 'Unit → due schedule → collection → expense → settlement reconciliation',
  },
  'owner-receivable-offset': {
    kind: 'vitest',
    file: 'malek-app/src/features/owners/services/owner-receivable-offset.pglite.test.ts',
    title: 'Lawful 1300/2000 offset against a stored owner receivable',
  },
  'owner-receivable-recovery': {
    kind: 'vitest',
    file: 'malek-app/src/features/owners/services/owner-receivable-recovery.pglite.test.ts',
    title: 'Cash recovery of an owner receivable posting DR cash / CR 1300',
  },
  'owner-funds-cutover': {
    kind: 'vitest',
    file: 'malek-app/src/features/owners/services/owner-funds-cutover-adoption.pglite.test.ts',
    title: 'Owner funds cutover baseline adoption (2000 opening, post-cutover events)',
  },
  'collections-close': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/collections-payments-period-close.pglite.test.ts',
    title: 'Collections, payments and period close at OMR 0.001',
  },
  'bank-governed-writes': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/reconciliation/bank-statement-line-governed-writes.pglite.test.ts',
    title: 'Bank statement lines accept only the governed RPC, never a direct table write',
  },
  'tax-authority': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/tax-authority/tax-readiness-boundary.pglite.test.ts',
    title: 'Tax authority resolver boundary: service_role-only internals, governed wrapper',
  },
  's09-correction': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/services/s09-correction.pglite.test.ts',
    title: 'S09 create → validate → apply, original posting preserved, validated-only',
  },
  'short-stay': {
    kind: 'vitest',
    file: 'malek-app/src/features/contracts/short-stay-lease-mode.pglite.test.ts',
    title: 'Short-stay lease mode invariants',
  },
  'fixed-monthly-accrual': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/fixed-monthly-accruals/fixed-monthly-accrual-service.test.ts',
    title: 'FIXED_MONTHLY daily accrual through the governed read/post/reverse RPC boundary',
  },
  'deposit-persistence': {
    kind: 'vitest',
    file: 'malek-app/src/features/financials/deposits/deposit-persistence.test.ts',
    title: 'Deposit retry/refund/reversal idempotency and cross-company denial under real RLS',
  },
  'product-workflow': {
    kind: 'vitest',
    file: 'malek-app/src/features/lifecycle/product-workflow-scenarios.test.ts',
    title: 'End-to-end rental lifecycle and receipt reversal against the database',
  },
  'contract-idempotency': {
    kind: 'vitest',
    file: 'malek-app/src/features/contracts/contract-create-idempotency.pglite.test.ts',
    title: 'Contract creation idempotency',
  },
};

/**
 * gap id → { units, remaining, authority }
 *
 * `remaining` is quoted from Document 7's "Required outcome" column where it names a hosted, legal or
 * pilot dependency; it is never softened.
 */
export const GAP_EVIDENCE = {
  'GAP-001': {
    units: ['permission-catalog', 'rls-matrix'],
    remaining:
      'Live migration of the exact release SHA plus hosted role/JWT/RLS verification. Local proof covers the six roles, catalog parity and per-role projections.',
    authority: 'QA environment',
  },
  'GAP-003': {
    units: ['rls-matrix', 'company-isolation', 'deposit-persistence'],
    remaining:
      'Release-SHA live negative tests and Auth Hook/claim/policy evidence on a hosted project. Local proof covers two-company SELECT/UPDATE/DELETE and role boundaries on the replayed schema.',
    authority: 'QA environment',
  },
  'GAP-006': {
    units: ['core-financial', 'collections-close', 'product-workflow'],
    remaining:
      'Hosted/pilot proof of the owner-agency invoice → collection → fee → VOID journey. Local proof covers collection-role mapping and ledger effects.',
    authority: 'QA environment',
  },
  'GAP-007': {
    units: ['fixed-monthly-accrual', 'core-financial'],
    remaining:
      'Hosted lifecycle evidence for FIXED_MONTHLY daily accrual, catch-up and reversal across periods.',
    authority: 'QA environment',
  },
  'GAP-008': {
    units: ['owner-receivable-offset', 'owner-receivable-recovery', 'owner-reconciliation', 'owner-funds-cutover'],
    remaining:
      'Hosted lifecycle evidence for owner expense → 1300, lawful offset gating and post-payout recovery.',
    authority: 'QA environment',
  },
  'GAP-009': {
    units: ['deposit-persistence', 'collections-close'],
    remaining:
      '3dp hosted deposit lifecycle (receive/apply/refund/reverse) reconciled to 2200 with maker-checker.',
    authority: 'QA environment',
  },
  'GAP-010': {
    units: ['tax-authority'],
    remaining:
      'Professional/legal confirmation of statutory Oman tax codes, plus a hosted lifecycle run.',
    authority: 'Accountant + QA environment',
  },
  'GAP-011': {
    units: ['collections-close', 'core-financial', 'product-workflow'],
    remaining:
      'Hosted adjustment lifecycle: credit note, receipt VOID and compensating reversal against real receipts.',
    authority: 'QA environment',
  },
  'GAP-013': {
    units: ['owner-reconciliation', 'collections-close'],
    remaining:
      'Hosted `wp05_reconcile_all` output at the release SHA over real data, with accountant acceptance.',
    authority: 'QA environment',
  },
  'GAP-014': {
    units: ['owner-reconciliation', 'collections-close'],
    remaining:
      'Hosted financial statement acceptance (trial balance, P&L, balance sheet, cash flow) at the release SHA.',
    authority: 'QA environment',
  },
  'GAP-015': {
    units: ['s09-correction'],
    remaining:
      'Hosted S08 frozen review plus an ACCOUNTANT approval signature. The database gate already blocks S09 without it.',
    authority: 'Accountant',
  },
  'GAP-016': {
    units: ['s09-correction'],
    remaining:
      'Operating S09 on governed scope after S08 approval. Engineering is proven locally; activation is gated by REL-004.',
    authority: 'Accountant',
  },
  'GAP-017': {
    units: ['bank-governed-writes'],
    remaining:
      'Hosted current-SHA import journey on authorized bank data, including the fail-closed CSV path.',
    authority: 'QA environment',
  },
  'GAP-018': {
    units: ['sensitive-writes', 'sensitive-writes-tests'],
    remaining:
      'Deployed grants/RLS verification on the hosted project. Repository-level boundary is now enforced by the restored guard.',
    authority: 'QA environment',
  },
  'GAP-019': {
    units: [],
    remaining:
      'Authorized legal review of Oman registration/retention policy before enabling a real profile. Local proof cannot establish legal validity.',
    authority: 'Legal',
  },
  'GAP-020': {
    units: [],
    remaining:
      'Authenticated seeded-staging browser acceptance. No browser is installed here and the Playwright CDN is unreachable; a skipped CI job is not a PASS.',
    authority: 'Browser + QA environment',
  },
  'GAP-021': {
    units: [],
    remaining:
      'Exact-SHA live config, Auth Hook, functions, secrets, RLS and restore evidence from the hosted project.',
    authority: 'QA environment',
  },
  'GAP-022': {
    units: [],
    remaining:
      'One real office running a full period with GL/subledger reconciliation and sign-off.',
    authority: 'Pilot office',
  },
};

/** Gaps Document 7 records as resolved; listed so the runner can assert nothing regressed. */
export const CLOSED_GAPS = ['GAP-002', 'GAP-004', 'GAP-005', 'GAP-023'];
