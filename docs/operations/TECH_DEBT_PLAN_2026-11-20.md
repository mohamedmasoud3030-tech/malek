# Technical debt audit and remediation plan — 2026-11-20

> **Status:** `OPERATIONAL` planning record. Date-stamped; re-measure before relying on any number.
> **Method:** read-only review of configuration, CI, migration history, directory structure and the
> 2026-10-21 repository hygiene audit. **No tests or builds were run** for this audit; items marked
> *verify* need confirmation before work starts.
> **Out of scope:** duplication, dead code and import cycles are already covered by PR #1844.

## 1. Prioritised register

Priority = (Impact + Risk) x (6 - Effort). Each factor is scored 1-5.

| # | Item | Type | I | R | E | Priority |
|---|---|---|---|---|---|---|
| 1 | `check:sensitive-writes` and `check:wiki` run in `gate:local` but not in `ci.yml`; the full test suite and RLS matrix run twice on push to `main` | Infra | 3 | 4 | 1 | 35 |
| 2 | Three money modules (`financialMath.ts`, `money.ts`, `moneyNormalization.ts`); `financialMath.ts` sums with plain `Number` and no 3-decimal OMR rounding | Code | 3 | 4 | 2 | 28 |
| 3 | `lint` is only `tsc`; Prettier is installed but never enforced | Code | 2 | 3 | 1 | 25 |
| 4 | ACL grants repaired by six or more successive migrations; money precision by four; two migrations share the name `ai_assistant_postgrest_rpc_repair`, one dated before the baseline | Architecture | 3 | 5 | 3 | 24 |
| 5 | Stale Vite config: chunk rules for `jspdf`/`html2canvas` (not dependencies), alias `@assets` to a non-existent directory; Replit leftovers (`.replit`, three `@replit/*` plugins) | Code | 2 | 2 | 1 | 20 |
| 6 | Five places hold agent instructions (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `skills/`, `docs/agent-wiki`); `AGENT_HANDOVER.md` (2026-10-08) still cites a branch the hygiene audit calls stale | Docs | 3 | 2 | 2 | 20 |
| 7 | Document renderer chunk about 1.26 MB; chunk warning limit raised to 1024 KB; `auth-service.ts` imported both statically and dynamically | Code | 3 | 2 | 3 | 15 |
| 8 | Local Node 22 versus CI Node 24; no `engines.node` | Infra | 1 | 2 | 1 | 15 |
| 9 | About 169 test files read production source as text; full suite takes about 25 minutes | Test | 4 | 3 | 4 | 14 |
| 10 | `enterprise-freeze` guard protects a deleted directory; `src/p0` and `src/p1` replay helpers live in app source; tests named by project phase (`p6e-`, `rc1-`, `phase2-`) | Code | 2 | 1 | 2 | 12 |
| 11 | Overlapping domains: `finance` / `financials` / `accounting`, `people` / `tenants` | Architecture | 4 | 3 | 5 | 7 |

## 2. Phases

### Phase 1 — executed 2026-11-20

- [ ] Add `check:wiki` and `check:sensitive-writes` to `ci.yml` (item 1). **Blocked:** the GitHub integration used cannot write under `.github/workflows/` (HTTP 403). Needs a push with the `workflow` scope; the exact diff is in section 3.
- [ ] Remove the steps from `heavy-validation` that repeat work already done by the `build` job (item 1). **Blocked** for the same reason.
- [x] Declare `engines.node` in the root `package.json` (item 8).
- [x] Remove the stale `jspdf`/`html2canvas` chunk rule and the `@assets` alias from `vite.config.ts` (item 5).
- [ ] Decide PR #1844 (merge or close). Owner decision.

Process note: the two Phase 1 code commits were pushed directly to `main` at the owner's explicit
request. `CLAUDE.md` says never to push directly to `main`; Phase 2 and later follow that rule
(branch plus pull request, no self-merge).

### Phase 2 — executed 2026-11-20 on branch `chore/tech-debt-phase-2`

- [x] **Item 2.** `sumFinancialValues` and `getSafeRemainingAmount` now round through `roundMoney` from `@/lib/money`, the single OMR 3-decimal source that mirrors the server `public._r3`. The 17 importers keep the same API. New boundary tests are in `financialMath-omr-boundary.test.ts`. The `.toFixed(3)` patch in `invoice-amounts.ts` is now redundant but harmless. **Not done:** `summarizeInvoices` still accumulates totals with plain `+=`; round its result in a follow-up.
- [ ] **Item 3.** Not done, two blockers: ESLint needs new devDependencies and CI installs with `--frozen-lockfile`, so `pnpm-lock.yaml` must be regenerated locally; and a Prettier gate needs a baseline decision first, because `src/` uses single quotes while `vite.config.ts` uses double quotes, so a default-config check would fail on every touched file.
- [x] **Item 6.** `AGENT_HANDOVER.md` carries a HISTORICAL banner; `AGENTS.md` has an authority-order section naming itself as the single entry point. The skill-copy drift between `skills/` and `.claude/skills/` is still open.
- [x] **Item 5, Replit part: decided to keep.** Replit is an active execution environment for this project, so `.replit`, `.replitignore` and the `@replit/*` plugins stay. They are already gated on `REPL_ID`.

### Phase 3 — two weeks, incremental

- Add an ACL golden snapshot checked in CI against the grants produced by migration replay, so a regression appears as a diff instead of another restore migration. Do not edit applied migrations (item 4).
- Lazy-load the document renderer after login and lower the chunk warning limit (item 7).
- Convert source-text contract tests to behaviour tests, starting with the files that change most (item 9).
- Round `summarizeInvoices` totals (item 2 follow-up).
- Resolve item 3 after the two blockers above.

### Deferred by decision

- Item 11: merging overlapping domains needs a new ADR; ADR 0022 already rejected some re-splits for stated reasons.
- Item 10: do when idle.

## 3. Verification status and pending workflow diff

Phase 1 code changes were pushed to `main` without a local run; Phase 2 is a pull request so its CI run
verifies it before merge. Points to watch:

1. `landing-performance-contract.test.ts` asserts on the text of `vite.config.ts`; it should still pass because only the `vendor-pdf` rule and the `@assets` alias were removed.
2. Phase 2 item 2 is the first change to money arithmetic. Inputs already at 3 decimals produce the same result except that float drift disappears; inputs with more than 3 decimals are now rounded half-up. Check the financial suites (`test:financials`, `test:frontend-backend-runtime-contract`) in the PR run.
3. **Release snapshots:** `scripts/release/build-release.mjs` refuses a snapshot when any non-evidence, non-release file changed after the last verified commit. After these changes, run `pnpm gate:local --full` and `pnpm evidence:live` again before cutting the next snapshot. The existing `v1.0.0-rc.1` and `rc.2` records are historical and unaffected.

**Pending, needs a token with the `workflow` scope** — changes to `.github/workflows/ci.yml`:

- In the `build` job, after the `Architecture check` step, add:
  - step `Agent wiki integrity` running `pnpm check:wiki`
  - step `Sensitive financial write boundary` running `pnpm check:sensitive-writes`
- In the `heavy-validation` job, remove the `Six-role RLS compatibility matrix`, `Full application tests` and `Shared primitive accessibility proof` steps; the `build` job already runs all three on every push. Keep `Canonical database integrity`, `Documentation links` and `Financial safety tests`.
- Neither change breaks `check-workflow-honesty`: every remaining job still runs real commands.
- `check:wiki` and `check:sensitive-writes` pass in `gate:local` per the hygiene audit but have not been seen passing in CI; watch the first run.
