# Gate inventory

> **Recorded:** 2026-10-21 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a` (clean tree, no changes vs `origin/main`)
> **Authority:** agent memory only — see [index](index.md).

Every row below was executed in this sandbox on 2026-10-21. "Blind spot" is the part agents most often
get wrong: what a green result does **not** prove.

## What passed

| Gate | Command | Time | Observed result | Blind spot |
| --- | --- | --- | --- | --- |
| Docs links | `pnpm check:docs` | 0.35 s (warm) | PASS, 111 Markdown files | Proves links resolve. Proves nothing about whether the linked text is true. |
| Agent wiki guard | `pnpm check:wiki` | 0.4 s | PASS — 7 pages, 6 index links, all dated | Checks form only (orphans, missing back-links, undated claims). It cannot tell whether a claim is still true. |
| Canonical rules | `pnpm check:business-rules` | 0.27 s | PASS, `v2.0.0` hash `30a5269…` | Verifies the rule file matches its pinned hash. It is a tamper check, not a correctness check. |
| Execution plan | `pnpm check:execution-plan` | 0.27 s | PASS, 10 stages / 98 tasks / 18 decisions | Same: integrity of the plan, not its accuracy. |
| Migration hygiene | `pnpm check:migration-hygiene` | 0.29 s | OK (base `origin/main`), 1 legacy warning for `supabase/migrations/rls_per_table/00_rollback_rls_for_table.sql` | **Diff-scoped.** Only new/modified files vs `origin/main` are enforced. |
| Enterprise freeze | `pnpm check:enterprise-freeze` | 0.36 s | PASS | Regression-only ("no *new* usage"), not a clean-tree audit. |
| GL write boundary | `pnpm check:gl-write-boundary` | 0.33 s | OK — **"production files checked: 0"** | On an unchanged branch this is a no-op. Green here does **not** mean "no legacy writers exist". |
| Workflow honesty | `pnpm check:workflow-honesty` | 0.31 s | PASS, 14 workflows | Checks workflow declarations, not that a workflow ever ran. |
| Typecheck | `pnpm typecheck` | 23.5 s warm / 53 s cold | PASS | Types only. |
| "Lint" | `pnpm lint` | — | PASS — **it is the same `tsc --noEmit` command as typecheck** | There is no linter. See [known-traps.md](known-traps.md). |
| Architecture | `pnpm --filter ./malek-app run check:architecture` | 0.55 s | PASS (3 node tests) | Enforces the register/boundary inventory it was written for; not a general style gate. |
| Test typecheck | `pnpm --filter ./malek-app run typecheck:test` | 26.6 s | PASS | Types of test files only. |
| a11y primitives | `pnpm --filter ./malek-app run test:a11y-primitives` | 2.2 s | PASS, 15 tests | Only shared UI primitives. Feature screens are not covered. |
| Frontend/DB contract | `pnpm --filter ./malek-app run check:frontend-db-contract` | 0.78 s warm / 18 s cold | PASS, 25 reviewed dynamic mutations, 0 unreviewed, receipt helper targets match `database.ts` | Static analysis of reviewed call sites; runtime behaviour unproven. |
| Application tests | `pnpm --filter ./malek-app test` | **555.4 s** | **PASS — 559 files, 4,079 tests** | Unit/component level. Uses PGlite where needed; no hosted backend, no browser. |
| Production build | `pnpm build` | 13.3 s | PASS — `dist/public/`, PWA `generateSW`, 28 precache entries | Warns that `DocumentRenderer` is 1,264.51 kB (above the 1,024 kB threshold). Local build with no Supabase env uses placeholder config; success is not a deployability proof. |
| Database integrity | `pnpm db0:gate` | 59.1 s | **PASS 7/7** (but 2 of 7 skipped, see below), 107 tenant tables / 255 policies / 413 functions / 11 views, 16 accepted `DB0-07` contract findings | Skips `idempotency` and `role-model` on the canonical-dump bootstrap. Migrations only — no Auth, Storage or PostgREST. |

## `db0:gate` sub-gate detail — the 7/7 trap

```text
PASS  regressions          41.0 s   WP-DB0 parser/generator/isolation/ACL/settlement-status regressions
PASS  migration-chain       4.1 s   Migration chain from a clean database
SKIP  idempotency           0.1 s   "skipped for the single canonical dump bootstrap"
PASS  schema-type-drift     4.4 s   generated database.ts matches the migration chain
PASS  contract              4.4 s   16 findings, all DB0-07, within accepted 46
PASS  isolation             4.4 s   107 tables, 255 policies, 413 functions, 0 isolation violations
SKIP  role-model            0.1 s   "skipped for the single canonical dump bootstrap"
```

The summary line still prints **7/7 gates passed**. Quote the sub-gate statuses, not just the total.

## What cannot run here at all

| Gate | Why | Where it must run |
| --- | --- | --- |
| `supabase start` / ephemeral Auth+Storage stack | no Docker | CI `release-blocker-gate.yml` |
| `pnpm qa:preflight`, `qa:database-contracts`, `qa:lifecycle` | require hosted QA credentials and refuse unknown environments | approved QA project |
| `pnpm e2e`, `browser-readiness.yml` | no browsers, Playwright CDN unreachable | CI / a machine with Chromium |
| `hosted-staging-proof.yml`, `supabase-live-readiness` | hosted credentials | CI with secrets |

## Reproducing this page

```bash
corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild
corepack pnpm check:docs && corepack pnpm check:business-rules && corepack pnpm check:execution-plan
corepack pnpm check:migration-hygiene && corepack pnpm check:enterprise-freeze
corepack pnpm check:gl-write-boundary && corepack pnpm check:workflow-honesty
corepack pnpm typecheck && corepack pnpm db0:gate
corepack pnpm --filter ./malek-app test          # ~9 minutes
```

One command that runs the safe subset and writes machine-readable evidence:
`pnpm gate:local` — measured **14/14 PASS in ~115 s** at `f2b6de5` on 2026-10-21, evidence in
`.gate/last-run.json`. See [session-decisions.md](session-decisions.md).
