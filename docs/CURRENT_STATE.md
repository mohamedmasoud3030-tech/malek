# Current State

> Snapshot date: 2026-07-12  
> Baseline: `main` at `534c87516453d2da729e2da7264cfe07f55b1197`

This document is the short operational snapshot. Git history, the active migration directory, and direct environment checks remain the final evidence. Historical audit reports describe their own point in time and must not override this file.

## Application

- The active application is `rentrix-app/`: React, TypeScript, Vite, TanStack Router, TanStack Query, and Supabase.
- Domain data is Supabase-backed. Zustand is limited to UI state.
- The app is Arabic-first and supports RTL, responsive layouts, role-gated navigation, and ADMIN / MANAGER / USER permissions.
- The active database migration source is **only** `supabase/migrations/`.
- `supabase/migrations_consolidated/` is a read-only historical/rebuild archive and must never receive active migrations.

## Current repository condition

The latest mainline work includes:

- Atomic contract lifecycle operations, including guarded create, update, renew, terminate, and soft delete paths.
- Canonical tenant identity aligned to `public.people`; the `tenant_balances.tenant_id` foreign key repair is represented by `20260712020000_fix_tenant_balances_people_fk.sql`.
- Financial Safety Lock changes: safer delete behavior, tightened RPC authorization, atomic expense updates, and journal batch protection.
- Double-entry invoice generation: accounts receivable, rental revenue, VAT payable, payment-cycle handling, duplicate protection, and contract-balance maintenance.
- Report accuracy corrections for VOID/CANCELLED invoices and payments.
- Production-hardening migrations and guarded QA cleanup/reversal migrations.
- Migration-history reconciliation stubs for timestamped out-of-band repair entries.
- Frontend hardening: shared contract-form logic, consolidated query selections, shared company formatters, dashboard component extraction, and Sonar configuration cleanup.
- A mandatory engineering policy at `docs/ENGINEERING_GOVERNANCE.md`.

## Financial source-of-truth rules

- Receipt screens are payment-backed.
- Collection totals use `public.payments` rows that are not deleted and are not VOID.
- Invoice generation creates balanced journal entries.
- Posted journal entries are immutable; corrections use reversal entries.
- Tenant identity resolves through `public.people`, not the legacy `public.tenants` table.
- Financial mutations must use the guarded RPC paths documented in migrations and services.

## Migration state

- Active history lives in `supabase/migrations/`.
- The consolidated four-file baseline was clean-rebuild verified earlier and remains an archive.
- Recent repository work added the executable repair migrations and comment-only reconciliation stubs needed to explain production ledger entries.
- A migration filename or commit message is not, by itself, fresh proof of the target environment. Before release, run the migration evidence command and a read-only ledger/schema comparison against the exact release target.

## Verification status

Repository history reports prior successful typecheck, lint, build, unit, and financial test runs. Those results are not automatically evidence for this documentation branch or a future release candidate.

For the exact release candidate, rerun:

```bash
pnpm install --frozen-lockfile
pnpm supabase:migration-evidence
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

## Remaining release evidence

The code and migration corrections materially improve readiness, but release sign-off still requires evidence tied to one immutable release-candidate SHA:

1. CI-equivalent command suite.
2. Read-only migration ledger, RPC, RLS, constraint, trigger, and grant verification.
3. Authenticated ADMIN / MANAGER / USER browser checks.
4. Contract → invoice → payment → receipt → void → report reconciliation.
5. Bank reconciliation workflow verification.
6. Arabic RTL and mobile/tablet/desktop checks.
7. Print, PDF, CSV, currency, timezone, loading, empty, and error-state checks.
8. Confirmation that QA artifacts and temporary records are absent or financially neutralized.

## Governance

- `docs/ENGINEERING_GOVERNANCE.md` defines engineering policy and migration discipline.
- `docs/GOVERNANCE.md` defines authorization for production mutations.
- `docs/GOVERNANCE_LOG.md` records approved production mutations.
- `docs/agent-context/CONTEXT_MAP.md` routes agents to the minimum required context.
- Code and verified live state win when a historical document disagrees; update the document in the same focused PR.
