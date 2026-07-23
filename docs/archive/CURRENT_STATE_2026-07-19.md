# Current State

This document records the maintained repository and release state. Verify code, migrations, CI, and the target Supabase environment before relying on any claim.

## Verified checkpoint — 2026-07-19

- `main` head at the start of this cleanup: `f647a2a`, after merged PR #1209.
- The active application is the React/Vite package under `rentrix-app/`; repository governance, CI, documentation, scripts, and Supabase assets remain at the root.
- Architecture phases A–E are complete. Historical audits, completed plans, and superseded reviews are kept in Git history rather than the active tree.
- `docs/NEXT.md` is the only active execution queue. Do not recreate completed architecture phases or infer new phases from removed plans.

## Latest merged application work

- PR #1209 unified mobile data-entry behavior, expanded light/dark semantic tones, activated KPI/status accents, and added an application-wide button action contract.
- PR #1208 stabilized mobile form surfaces against keyboard and visual-viewport movement.
- PR #1206 hardened unit creation/editing, unit-to-property integrity, contract linking, overlap validation, and derived operational status behavior.
- PR #1205 reconciled UI/database value contracts for maintenance, commissions, and unit status logic.
- PR #1204 disconnected the heavy public landing from the live entry route without deleting its source files.

## Maintained architecture and data boundaries

- `rentrix-app/src/app/` is composition-only; business pages, hooks, services, and domain presentation live under `features/`.
- Route files stay thin, feature presentation components do not call Supabase directly, and architecture constraints are enforced by `check:architecture`.
- `supabase/migrations/` is the sole active migration source. Applied history must not be rewritten; reconcile the local chain with the live migration ledger before high-risk work.
- Contract and multi-step financial writes use atomic RPCs. Payment-backed collection reporting must exclude deleted and `VOID` payments.

## Verified production foundations

- Authorization-helper recursion and grant drift were repaired; authenticated core reads and the dashboard overview RPC were verified after the production incident fix.
- Owner → property → agreement links were repaired and owner reporting was aligned with canonical payments and contract-level agreements.
- Deposits and automation tables/RPCs are deployed; the hourly automation schedule is present.
- Unit/property/contract integrity and operational status reconciliation were applied and validated with bounded rollback smoke tests.
- Anonymous execution of public `SECURITY DEFINER` functions is blocked by the release/security gates.

## Remaining launch evidence

The following evidence still controls the final Go/No-Go decision:

1. Authenticated deposit lifecycle: create, deduct, refund, and overdraw rejection.
2. Automation execution, retry, and scheduled-run verification.
3. Owner-settlement approval and payout with journal/balance reconciliation.
4. Private Storage upload, preview, and download through signed URLs, including denied unauthorized access.
5. Final post-deploy browser smoke on the exact release candidate.

## Launch-blocker policy

Only data loss, authentication failure, broken contract/collection flows, major financial errors, or critical security defects block launch. UI polish, broad refactors, and documentation preferences do not.

## Required verification

```bash
pnpm supabase:migration-evidence
pnpm check:docs
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
pnpm build
```

Run Browser Readiness/E2E for user-facing changes and target-specific authenticated checks for release evidence. Never claim production readiness from local tests alone.
