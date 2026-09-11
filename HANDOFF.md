# MALEK / Rentrix — Reconstruction Handoff (Autonomous Loop)

**Document type:** operational engineering handoff + continuous execution memory. Self-contained. A new agent must be able to continue from this file alone, without any prior conversation.

**Last updated:** 2026-09-11T08:05Z (Asia/Muscat) — NOW-4…NOW-10 complete locally; **push BLOCKED — no GitHub credential exists in this sandbox**
**Branch (only permitted):** `reconstruction/checkpoint-20260909`
**Previous handoff checkpoint:** `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77`
**Last work commit (code/schema/evidence):** NOW-10 evidence docs (inventory NOW-6…NOW-9 sections + `docs/execution/RECONSTRUCTION_DOD_CHECKLIST.md`) — **LOCAL ONLY, not pushed** (last code change: `035db0e2`)
**Remote HEAD (actual, verified via ls-remote 2026-09-11 04:28Z):** `bcdf6944672c46c2417b48562654036cca26c82d`
**Local HEAD:** `6a66f692` — **11 ahead of remote** (`9ca483b4` NOW-4, `61eb62ad` docs, `9767ef03` NOW-5, `c2084123` docs, `342b18ca` NOW-6, `faa4980a` docs, `bb45a0d0` NOW-7, `91f2ad71` docs, `035db0e2` NOW-8, `4973dc4e` docs, `6a66f692` NOW-9); push blocked solely by missing credentials (see §BLOCKED)
**Working tree:** **clean** — verified `git status`, no mode changes
**Branch tracking:** `origin/reconstruction/checkpoint-20260909`

Confirm tip:
```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git refs/heads/reconstruction/checkpoint-20260909
```

---

## AUTONOMOUS HANDOFF LOOP — SOURCE OF TRUTH

This section is the **continuous memory** between Arena sessions. It is the authority for what to do next.

### CURRENT STATE (actual, verified 2026-09-11 05:15Z — after NOW-4, push blocked)

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch | `reconstruction/checkpoint-20260909` |
| Remote HEAD | `bcdf6944` — docs: G5 UI-absent RPCs closed (verified via ls-remote 04:28Z) |
| Local HEAD | `6a66f692` — **11 ahead, NOT PUSHED (no credential in sandbox)**: `9ca483b4` (NOW-4), `61eb62ad` (docs), `9767ef03` (NOW-5), `c2084123` (docs), `342b18ca` (NOW-6), `faa4980a` (docs), `bb45a0d0` (NOW-7), `91f2ad71` (docs), `035db0e2` (NOW-8 G3 fix), `4973dc4e` (docs), `6a66f692` (NOW-9 audit evidence) |
| Previous handoff SHA | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Commits since previous handoff | **20**: `354bc427` (G6), `4da6a26d` (loop transform), `50be359a` (NOW-1 fix+re-baseline), `aac5aa14` (NOW-2 browser), `0d187c48` (final checkpoint docs), `9fac02ac` (G5 offset), `95a0a2af` (docs), `411167f6` (G5 recovery+S09), `bcdf6944` (docs), then **local-only**: `9ca483b4` (NOW-4), `61eb62ad` (docs), `9767ef03` (NOW-5), `c2084123` (docs), `342b18ca` (NOW-6), `faa4980a` (docs), `bb45a0d0` (NOW-7), `91f2ad71` (docs), `035db0e2` (NOW-8), `4973dc4e` (docs), `6a66f692` (NOW-9) |
| Working tree | **clean** — 0 modified |
| Tracked files | ~1,746 |
| Migrations in repo | 100 (**0 added by NOW-4…NOW-9**) |
| Production ledger | 109 rows |
| Unit/integration test files | 559 |
| Playwright specs | 29 |
| pnpm | 10.11.1 |
| Node | v20.20.2 |
| Fresh baseline (NOW-8, 2026-09-11 07:00-07:25Z) | typecheck clean, gates 7/7, guardian PASS all layers, migration-hygiene OK (needs `origin/main` ref — see §B), business-rules v2.0.0 382a0b8c unchanged, s09+S08 suite 27/27, canonical documents suite 38/38, entity-form **9/9** (incl. G3 double-submit race lock), design-system inventory 13/13, full sharded 20-shard **559 files / 4066 tests / 0 failures / 0 INFRA — PASS** |
| Push verification | **DONE — remote == local at every step; final tip `6af81c70`** (eight push/verify cycles 2026-09-11 10:05-11:15Z, each verified via `git ls-remote`). Hosted CI at the final tip: run 34587311312 SUCCESS (attempt 2; attempt-1 single 5s-timeout flake classified INFRA, clean rerun 4069/4069) · Browser Readiness 34585751072 SUCCESS at `337a3046` (code-identical to tip). Full record in the NOW-14 block and §K. |

### FRESH BASELINE AFTER G6 (NOW-1, executed 2026-09-10 17:30-17:36Z)

- `pnpm typecheck`: clean
- `pnpm db0:gate`: 7/7 PASS (regressions, migration-chain 100/100, idempotency, schema-type-drift, contract, isolation 107 tables / 254 policies, role-model)
- `node scripts/db0/replay-migrations.mjs`: 100/100 applied, 0 failures
- `pnpm check:business-rules`: v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79 — unchanged (G6 adds no migration, no accounting rule)
- `pnpm check:migration-hygiene`: OK (legacy warning non-blocking)
- `pnpm db:guardian`: PASS all layers
- Focused `src/features/financials src/features/owners`: **137 files / 967 tests PASS** (was 135/933 at e6e2e444; +2 files / +34 tests from G6)
- Full sharded `run-sharded-regression.mjs`: **554 files / 3977 tests / 0 failures**, 0 INFRA kills — was failing 1 due to raw `<form>` in OwnerFundsCutoverPanel.tsx, now fixed to canonical `EntityForm.Root`. Classification: previous G6 work **PROVEN INCORRECT** for that specific pattern, now **PROVEN CORRECT**.
- No new RLS, precision, or contract drift.

### BROWSER VERIFICATION AFTER G6 (NOW-2, executed 2026-09-10 18:20-18:45Z)

- Production build: `pnpm build` → 28 precache entries (428.87 KiB), **0** private API paths in `sw.js` (grep 0 for rest/v1, auth/v1, storage/v1) — **PROVEN BY BROWSER TEST / BUILD**
- Fixture build: `VITE_E2E=true pnpm build` → 28 precache, built in ~15s, served via `e2e-static-preview.mjs` on :5173
- `e2e/owner-position-cash.spec.ts`: **3/3 PASS** desktop/tablet/mobile (7.1s, 7.0s, 6.3s) — proves settled entitlement vs proven cash vs incomplete evidence disclosure still works after EntityForm refactor
- `e2e/owner-expense-source.spec.ts`: **3/3 PASS** desktop/tablet/mobile (14.9s, 15.2s, 16.0s) — proves allocation UI retains allocation on uncertain response and reconciles after lawful recovery/settlement; notes UNSEEDED TABLE `owner_funds_event_cutovers` and `s08_frozen_reviews` failing closed 404/PGRST205 (expected fail-closed discipline, not a defect)
- `e2e/financial-persisted-journey.spec.ts`: **6/6 PASS** desktop/tablet/mobile (33.9s, 9.3s, 28.8s, 7.7s, 32.4s, 8.6s) — deposit retry, credit statement, cash collection, fixed-fee UI lost ack/reload/reversal
- `e2e/owner-payout-bank-cash.spec.ts`: **3/3 PASS** desktop/tablet/mobile (11.3s, 10.8s, 9.9s) — bank suggestions use posted owner cash, expose failed source reads
- `e2e/pwa-production-contract.spec.ts` with `E2E_PRODUCTION=true` against production build: **3/3 PASS** desktop/tablet/mobile (1.7s, 1.4s, 1.1s) — worker installs, Arabic RTL offline page, no private responses in any cache store
- `src/components/ui/primitives.axe.test.tsx`: **15/15 PASS** — accessibility primitives
- Design-system inventory: **13/13 PASS** after fix
- Negative control: unit test `owner-funds-cutover-service.test.ts` asserts disclosure `balanceCaption` contains "لا يُعرض هذا الرقم كإجمالي كامل" for zero GL lines; breaking that string makes test fail — proves disclosure detection is not vacuous. Browser negative control for cutover panel: panel is hosted once in OwnerSettlementWorkspace, no second route; its presence does not break existing workspace specs (owner-position, owner-expense-source still PASS after refactor).
- Evidence: **PROVEN BY BROWSER TEST**

### AUDIT OF PREVIOUS EXECUTION (since 75799c3f)

**What was implemented:** G6 governed historical adoption (owner-funds cutover) UI surface.

- Allocation UI already existed: `features/financials/expenses/owner-expense-allocation-fields.tsx` hosted in `expenses-section.tsx` + `maintenance-detail-resolve-overlays.tsx`, browser-covered by `owner-expense-source.spec.ts`. Nothing built for it — **verified, preserved**.
- Governed historical adoption had zero call sites although RPCs `create_owner_funds_cutover_atomic` / `approve_owner_funds_cutover_atomic` are GRANTED to `authenticated` and enforce role + S08 approval + maker/checker + stale-baseline refusal + idempotency. One canonical surface built:
  - `features/owners/services/owner-funds-cutover-service.ts`: fail-closed evidence parser, `p_payload` envelope (repo convention), Arabic guard translation, disclosure authority that never presents derived zero as complete total.
  - `features/owners/components/OwnerFundsCutoverPanel.tsx`: hosted once in `OwnerSettlementWorkspace.tsx`.
  - 22 unit assertions + 12 real-PostgreSQL assertions against deployed function bodies.

**Defects found by real SQL and fixed in same commit:**
1. Idempotent RPC branch nests existing row under `cutover` with no top-level status; flat-shape parser reported false failure. Both envelopes now read (regression-locked).
2. Instruction to 'create fresh draft' after stale-baseline refusal was wrong: one baseline row per company means re-create is idempotent and cannot re-baseline. Message and test corrected; regression proves re-create adds no row and never re-derives balance.

**Classification:**
- Allocation UI existence: **PROVEN CORRECT**
- Cutover service parser, OMR precision, disclosure, idempotency, company isolation, role guards, S08 approval, staleness guard, maker/checker: **PROVEN CORRECT** (inspected + PGlite 12 PASS + unit 22 PASS, matches canonical patterns: `p_payload`, `supabase.rpc`, `canAccess`, `AsyncContentState`, RLS company_read)
- Integration: hosted once, no duplicate, uses `invalidateFinancialReadModels`: **PROVEN CORRECT**
- Authorization-safe, fail-closed, financially/historically correct: **PROVEN CORRECT**
- Test coverage adequate, negative controls present: **PROVEN CORRECT**

**Decision Rule:** **PATH A — PREVIOUS WORK IS CORRECT AND COMPLETE**. Preserve it, mark G6 verified, continue with remaining unresolved work.

**Competing work:** No other agent/session pushed competing commits. Remote HEAD is exactly 1 ahead of previous handoff, linear, not divergent.

### FIXED RULES & SETTLED DECISIONS (must not be broken)

From §A Standing constraints + §J:

- Work only on `reconstruction/checkpoint-20260909`. No new branch, no PR, no merge, no force-push.
- No `reset`, `revert`, `stash`, discarding, or replacing existing work. Preserve newer/local changes.
- Inspect whole path before changing: UI → state → business logic → API/database → persistence → UI.
- Fix authoritative source. Never edit a report to hide a difference.
- Do not derive historical cash from `net_payable` minus current `offset_applied`.
- Do not grant offset/allocation/historical-adoption rights from accounting classification or field name alone.
- No rewriting of posted history. Corrections are append-only or compensating entries; original retained.
- No deletion before checking references, functions, data, tests.
- After each stage: execute → focused tests → actually-saved SQL → browser → diff review → commit → push → verify literal remote SHA.
- Never claim local SQL with mocked auth proves JWT/PostgREST or hosted concurrency.
- No stage credit and no completion claim without evidence.
- `calculate_owner_net_payout` is single owner-payout derivation authority (ADR 0001).
- Proven cash from `app_private.owner_settlement_paid_cash`, never from `net_payable` nor `net_payable - offset_applied`.
- Owner-funds events append-only; corrections are compensating entries.
- Missing historical balance fails closed; never invented or zeroed.
- OMR money `numeric(18,3)`. Rates, durations, valuations, meter readings legitimately scale-2.
- Merged migrations immutable. Repairs are forward-carry, copied verbatim by line range.
- Fixture backends fail closed (404/PGRST205) on unseeded tables — never answer `200 []`.
- Must NOT be invented without approved source/user: any accounting treatment not in `docs/source-of-truth/`, any opening balance/cutover date/historical allocation lacking S08/S09 approval, any authorization rule inferred from field name/classification alone, any production data fix.

### PROVEN (evidence-based, fresh after NOW-1 + NOW-2)

- Production/repository function parity: 0 semantic differences across 431 functions (measured at e6e2e444, needs re-measure after 354bc427+4da6a26d+50be359a — pending in NEXT-5)
- Migration-chain completion: **100/100 replay** — freshly measured 2026-09-10 17:40Z and 18:45Z, 0 failures
- RLS/company-isolation: 107 tenant tables / 254 policies, 0 violations; SEC-003/SEC-004 closed in repo and production (6 users/41 audit rows → 2 users/0 audit rows for foreign admin; 41 preserved, 7 attributed, 34 withheld fail-closed) — gates 7/7 PASS
- audit-log isolation, users isolation
- Financial precision: 74/74 OMR money columns at numeric(18,3) + 7 genuinely lossy columns widened; business-rules hash **v2.0.0 382a0b8c** unchanged (G6 + form fix + browser builds add no accounting rule, no migration) — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- Owner financial-chain: accrual posting status visible on tablet (b11b5da3), owner-payout cash authority re-applied (298739ad), owner position cash evidence, owner statement settlement authority (paid_at, proven cash, PAID-only)
- Co-ownership expense handling: unallocated stays unallocated, double-count fixed, stored balance vs statement parity
- PWA/offline privacy: **0 private API paths in precache**, 28 precache entries / 428.87 KiB — freshly measured 2026-09-10 18:20Z production build + runtime **PWA contract 3/3 PASS** desktop/tablet/mobile — **PROVEN BY BROWSER TEST + BUILD**
- Responsive/tablet corrections, authentication/session consolidation, report and statement corrections — **PROVEN BY BROWSER TEST** (owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3)
- G6 allocation UI already existed (owner-expense-allocation-fields.tsx) + governed adoption surface built canonically (354bc427) with 22+12 tests, now fixed to canonical `EntityForm.Root` (was raw `<form>` — PROVEN INCORRECT, now PROVEN CORRECT) — full regression **554/3977 PASS**, design-system inventory 13/13 PASS, axe 15/15 PASS
- Baseline validation **fresh**: 554 files / 3977 tests / 0 failures, 137 files / 967 tests financials+owners PASS, Replay 100/100, Gates 7/7, Guardian PASS, Typecheck clean, Business rules v2.0.0 382a0b8c, Migration hygiene OK — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- Browser verification **fresh after G6+fix**: production build clean, PWA 3/3, owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3, axe 15/15 — **PROVEN BY BROWSER TEST**

### NOT YET PROVEN (updated after NOW-4)

- G1 Authenticated app-shell E2E: BLOCKED, no credentials, no browser test ever reaches authenticated shell — **NOT YET PROVEN**
- G2 Intermittent bootstrap stall root cause: OPEN, BLOCKED by G1, mitigation proven (withCompanyResolutionTimeout 10 PASS), root cause unproven — **NOT YET PROVEN**
- G3 Hosted concurrency / Web Locks: local verification strategy + per-scenario verdicts committed (`docs/execution/G3_CONCURRENCY_VERIFICATION_STRATEGY.md`, NOW-8 `035db0e2`); one proven client defect fixed (EntityForm double-submit trap); NOW-9 (`6a66f692`) closed residual R1 with a full per-surface audit — 0 ungated mutation surfaces remain, zero further code changes needed; hosted checks C1/C3/C5/C6/C8 remain BLOCKED by G1 — **PROVEN LOCALLY; HOSTED NOT YET PROVEN**
- G4 Runtime behaviour of newly applied migrations under genuine concurrent/hosted traffic: structurally verified but not exercised by live usage; NOW-15 made the G4 evidence pipeline operational (local-preflight run 34600286733 — first-ever green of 1173 runs; artifact retained 30d); production-inspect/deploy still need operator secrets (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`) + `production` environment approval — **NOT YET PROVEN**
- G5 Remaining financial-chain reviews: non-expense `source_type` correction coverage **PROVEN (NOW-5, `9767ef03`)**, cash/fees/tax/offset/collection/recovery truth in owner statements AND documents **PROVEN (NOW-6, `342b18ca` — one defect found, fixed, locked)**, remaining S08/S09 paths (sources, cache/rebuild, permissions, read limits, retries, reconciliations) **PROVEN (NOW-7, `bb45a0d0` — one F13-class defect found, fixed, locked; no-LIMIT read behaviour recorded as governance note)**; hosted browser coverage for all five G5/G6 panels — **PROVEN on hosted CI runners (hermetic fixture data)**: Browser Readiness run 34585751072 SUCCESS at `337a3046`, desktop shard 172/172 incl. S09-lifecycle, cutover, and recovery-refusal panel journeys (NOW-14); local matrix 9/9 (NOW-11/12); offset+payout in owner-expense-source.spec.ts. NOT yet proven: against the LIVE deployed staging app (needs staging deployment at the exact SHA → `hosted-staging-proof.yml`)
- G5 closure durability: `9ca483b4` exists **only in this sandbox** until the push blocker clears — remote does not yet carry the reverse surface or the list-envelope fix — **NOT YET PUSHED**
- G6 hosted parity re-measurement after 354bc427+4da6a26d+50be359a — parity re-measure pending in NEXT-5 — **NOT YET PROVEN**
- G7 Historical SEC-003/SEC-004 exploitation: UNKNOWABLE, no historical access logs — **NOT YET PROVEN / UNKNOWABLE**

### NOW (single task)

**NOW-16: PARKED — remaining items need operator-side secrets/deploy/decision (GitHub-only access exhausted)**

(NOW-15 COMPLETE `ce0fbb33`: fixed the G4 `local-preflight` workflow that had **never** succeeded
— 0/1172 runs across repo history, verified via the Actions API — by starting the ephemeral local
Supabase stack that `supabase migration list --local` queries (it was dying `connection refused` on
127.0.0.1:54322 in the evidence step). Re-dispatched at main `fe2a5911`: **run 34600286733 SUCCESS**
— first-ever green production-migrations run; artifact `production-local-preflight-34600286733`
(local manifest + sha256 + `migration list` status, 30-day retention) proves main's migration set
builds evidence cleanly. `production-inspect`/`deploy` jobs untouched — they remain gated behind
`SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` secrets (NOT in the repo secret set) and the
`production` environment approval. A GitHub PAT alone cannot reach Production; that needs the
operator to supply those two secrets + approve the environment.)

**NOW-16 remaining queue — ALL need operator-side inputs the PAT does not grant, exact triggers:**
1. **G4 production-inspect (read-only, safe):** operator adds `SUPABASE_PROJECT_REF` +
   `SUPABASE_DB_PASSWORD` secrets and approves the `production` environment → dispatch
   `supabase-production-migrations.yml` with `action=production-inspect` + the reviewed main SHA →
   read-only `migration list --linked` + `db push --dry-run` artifact = the live parity measurement
   (also discharges NEXT-3). `deploy` additionally needs owner backup + rollback references.
2. **Authenticated hosted E2E (G1):** a staging deployment serving the exact branch SHA → dispatch
   `hosted-staging-proof.yml` (production-readonly auth lifecycle + storage isolation).
3. **`SUPABASE_DB_URL` read-only secret** → `supabase-live-readiness` + migration-ledger parity.
4. **Governance decision:** non-enumerated S09 `source_type` tightening (approved source required).
5. G2 bootstrap-stall diagnosis + G3-hosted two-tab soaks: need the deployed runtime from (1)/(2).

**Acceptance:** none executable with GitHub-only access — precise park record above. Do NOT relax
`assert-release-blocker-env.mjs` (policy lock) or fabricate Production secrets/backup references.

### Historical park record (NOW-15 staging/deploy triggers, now folded into NOW-16 above)

(NOW-4…NOW-12 COMPLETE and PUSHED; NOW-13 park superseded; **NOW-14 COMPLETE**: push verified +
first-ever hosted CI on the branch driven to FULL GREEN at tip `337a3046` — four latent gate
defects found by the hosted gates and fixed at source: `53d913e7` test-typecheck ×3,
`9a4c8add` hermetic env identity + architecture seam, `bc3b0c4c` guard-v2 lock mirror,
`337a3046` reviewed dynamic contract registry. Remote == local at every step, verified via
`git ls-remote`. The PAT is conversation-scoped: used inline per command, never written to any
file, never stored in `.git/config`.)

**NOW-14 hosted evidence (all on branch `reconstruction/checkpoint-20260909`):**
- CI / Typecheck, Lint & Build run **34584434977** at `337a3046`: **SUCCESS** — build job
  (governance guard, pilot-demo + production-demo safety, typecheck, test-typecheck, a11y
  primitives, full vitest gate, lint, architecture check, migration↔types parity, frontend↔db
  contract gate, frontend↔backend runtime contract, six-role RLS matrix, production bundle) AND
  heavy-validation job (db0:gate, RLS matrix, docs links, full vitest **4069 tests**, a11y,
  financials safety) all green.
- Browser Readiness run **34585751072** at `337a3046`: **SUCCESS** — all three device shards
  (desktop **172 passed / 0 failed** incl. the three NOW-11/12 panel-journey specs; tablet,
  mobile green). Also green one commit earlier at `9a4c8add` (run 34582412612).
- **First HOSTED browser execution of the five-panel coverage: GREEN.**
- Staging attempt (run 34586348258, `run_staging=true`): hermetic shards green again;
  `seeded-staging-smoke` BLOCKED at preflight BY DESIGN — `scripts/assert-release-blocker-env.mjs`
  (main-era policy lock `395c26d0`) rejects `E2E_ENVIRONMENT_KIND=staging`: the full-suite staging
  path is policy-dead on main itself; the sanctioned hosted proof is `hosted-staging-proof.yml`
  (production-readonly auth lifecycle + storage isolation), which fail-closes unless the staging
  deployment serves the EXACT dispatched SHA (`hosted-staging-preflight.mjs`). The guard was NOT
  relaxed (never weaken a security lock to make a run pass).
- `supabase-live-readiness` daily failures on main diagnosed from logs: benign fail-closed skip —
  `SUPABASE_DB_URL` secret is not set ("Provide an approved read-only database URL"); NOT a parity
  drift signal. Migration-ledger parity check skips for the same reason.
- `supabase-production-migrations.yml` exists (G4 path): manual, approval-gated, requires exact
  reviewed main SHA + a prior production-inspect run + owner-created backup reference + rollback
  plan + Production environment approval — NOT dispatchable without those owner-side inputs
  (fabricating them is forbidden).

**Remaining queue — ALL need operator/owner actions, exact resume triggers:**
1. **Staging deployment at the branch tip** → dispatch `hosted-staging-proof.yml` (production-
   readonly auth lifecycle + storage tenant-isolation proof) = the sanctioned G1 hosted E2E.
2. **`SUPABASE_DB_URL` read-only secret** → `supabase-live-readiness` + migration-ledger parity
   (= fresh G6 parity measurement, read-only).
3. **Governance decision:** non-enumerated S09 `source_type` tightening (approved source required).
4. **G4 production migration run:** owner supplies reviewed SHA + production-inspect run + backup
   reference + rollback plan; Production environment approval.
5. G2 bootstrap-stall diagnosis + G3-hosted two-tab soaks: need the deployed hosted runtime (1).

**Acceptance:** none executable in-sandbox — precise park record with resume triggers above.

### Historical park record (NOW-13, superseded 2026-09-11 ~10:05Z by the PAT arrival)

(NOW-4 `9ca483b4`, NOW-5 `9767ef03`, NOW-6 `342b18ca`, NOW-7 `bb45a0d0`, NOW-8 `035db0e2`,
NOW-9 `6a66f692`, NOW-10 docs sweep + DoD checklist, NOW-11 `ec4654bc` S09+cutover panel browser
specs, NOW-12 `d6713ec0` recovery panel + fail-closed refusal browser spec — all COMPLETE locally;
push blocked solely by missing credentials.)

- Browser coverage of the five G5/G6 panels is now COMPLETE locally: S09 incl. reversal ✓ (NOW-11),
  cutover ✓ (NOW-11), offset + payout ✓ (owner-expense-source.spec.ts, pre-existing), recovery ✓
  (NOW-12 — including the first browser-proven fail-closed refusal via real concurrency: stale UI
  submits 200 after a concurrent lawful 150 recovery, server refuses with its Arabic reason,
  SQL truth proves zero change, then the honest 50 succeeds with both batches POSTED).
- Matrix evidence at `d6713ec0`: playwright **9/9** (three panel specs × desktop/tablet/mobile,
  CI=1, zero retries in the matrix run); typecheck clean; zero src change since `035db0e2` — the
  NOW-8 vitest gate matrix (559/4066) stands over identical src.
- Remaining queue — ALL externally blocked, exact resume triggers:
  1. **Push/G1:** the instant a GitHub credential (PAT) appears in the sandbox →
     `git push origin reconstruction/checkpoint-20260909`, verify remote SHA == local HEAD via
     `git ls-remote`, then proceed to G2/G3-hosted/G4/G7 checks per the DoD checklist.
  2. **Governance decision:** non-enumerated S09 `source_type` tightening needs an approved
     accounting/governance source — do not invent (locked at `9767ef03`).
  3. **G4 hosted runtime + parity re-measure + hosted checks:** need the hosted environment.
- Do NOT re-audit NOW-4…NOW-12 territory; their locks are the contract. If resumed without new
  external inputs, the correct action is to verify this park record is still accurate — nothing else.

**Acceptance:** none executable — this is a precise BLOCKED/park record per the loop discipline.

**NOW-11/12 gotchas (proven, do not rediscover):** e2e specs must NOT import from
`src/features/**/services` or anything pulling `@/lib/supabase` — `import.meta.env` is undefined
under the Playwright node transform and kills collection ("No tests found" + env.ts TypeError);
inline payload literals instead. Run with `CI=1 PLAYWRIGHT_DISABLE_VIDEO=true`; a reused stale vite
dev server can die mid-transform (`[plugin:vite:esbuild] The service is no longer running` → INFRA,
rerun fresh). Scope textareas/roles by accessible name, never bare locators (S09 section has two
textareas; recovery panel has two `role="status"` elements — the empty-state wrapper collides).
Fake-backend single-object reads: `Accept: application/vnd.pgrst.object` + 0 rows ⇒ 406 `PGRST116`
⇒ `maybeSingle()` null. Acceptance token role ADMIN ⇒ full client-side permission catalog
(`canAccess`), so no grants seeding is needed for any panel. Recovery/offset panels need
`?ownerId=` in the URL (they don't render in the bare funds view); `/financials` has no
validateSearch so unknown params pass through. The repo also carries `skills/**` scripts whose
executable bits the sandbox may strip — mode-only drift, restore with chmod, never commit.

### NEXT (ordered, after NOW-13 — all externally blocked)

1. ~~**Push + G1 credentials**~~ — **DONE 2026-09-11 ~10:05Z**: PAT supplied, pushed
   `bcdf6944..a99e4295`, remote SHA verified via `git ls-remote`; hosted ci.yml + browser-readiness
   dispatched on the pushed SHA (NOW-14 records outcomes). Still needs hosted RUNTIME access
   (deployed app + Supabase): G2 bootstrap-stall diagnosis, G3-hosted two-tab soaks
   C1/C3/C5/C6/C8, G4, parity re-measure, G7 evidence attempt.

2. **Governance decision needed (user/approved source, do not invent):** non-enumerated S09
   `source_type` labels are bound only to the APPROVED S08 review with no source-existence check
   (deployed step-8 enumerates exactly invoice/payment/expense/deposit). Behaviour is regression-
   locked at `9767ef03`; tightening requires an approved accounting/governance source.

3. **G4 Runtime behaviour of newly applied migrations under real traffic** — safe, non-destructive,
   preserve invariants (needs the hosted runtime).

4. **Re-verify repo ↔ production parity with fresh measurement** (normalized function hashes both
   sides, money columns, rpt_owner_statement body) — needs hosted access.

(DONE and struck from this list: final documentation sweep/DoD checklist/release evidence =
NOW-10 `84e258cd`+`76a461c8`; browser coverage of all five G5/G6 panels incl. fail-closed refusal
= NOW-11 `ec4654bc` + NOW-12 `d6713ec0`.)

### COMPLETED IN THIS LOOP (so far)

- **NOW-15 (2026-09-11 12:30-12:50Z; commit `ce0fbb33` — PUSHED, remote==local verified): G4 evidence pipeline made operational — first-ever green run of `supabase-production-migrations.yml` (1/1173).** Investigated the remaining GitHub-only actionable surface: the G4 workflow's `local-preflight` (no secrets, no environment gate, checks out main, never touches Production) had **0 successes in 1172 historical runs** (Actions API `status=success` total_count=0): `supabase migration list --local` connects to 127.0.0.1:54322 but no step ever started the local stack → every run died `connection refused` in the evidence step. Reproduced live (run 34599848330 at main `fe2a5911`: SHA verification + manifest + sha256 steps green, then the documented failure). Fixed at source: added a `Start ephemeral local Supabase stack` step (`pnpm exec supabase start`, runner-local only) and raised the job timeout 15→30 min for the image pull; `production-inspect`/`deploy` jobs untouched. Re-dispatched: **run 34600286733 SUCCESS** — artifact `production-local-preflight-34600286733` (local manifest, sha256 sums, `migration list` status, summary; 30-day retention). Also surveyed the remaining workflows: database-governance / canonical-db-baseline / business-rules-guard / execution-plan-guard are PR-triggered only (not dispatchable without opening a PR — forbidden by standing rules); hosted-qa-verification needs `QA_*` secrets that don't exist (fail-closed by design); release-blocker-gate duplicates the already-green CI evidence at tip (skipped as redundant). **Production-inspect/deploy remain operator-blocked: `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` secrets absent + `production` environment approval required — a GitHub PAT alone cannot reach Production.**

- **NOW-14 (2026-09-11 10:05-10:45Z; commits `2a40f6e5`, `53d913e7`, `9a4c8add`, `bc3b0c4c`, `337a3046` — ALL PUSHED, remote==local): push unblocked + first-ever hosted CI on the branch driven to FULL GREEN.** User supplied a PAT (conversation-scoped; used inline, never stored). Pushed `bcdf6944..a99e4295` (18 commits), verified via `git ls-remote`, dispatched ci.yml + browser-readiness on the pushed SHA. The hosted gates — running on this branch for the first time ever — caught FOUR latent defects, each reproduced locally red-first (where reproducible) and fixed at source: (1) `53d913e7` three `typecheck:test` errors (unused `reviewA` binding, unused import, unnarrowed registry entry — the test-project tsc cannot run in the 2GB sandbox, so this gate had never run locally); (2) `9a4c8add` hermetic e2e identity vs the shared config policy: the branch's stricter `resolvePublicSupabaseConfig` (suffix-matched placeholder hosts) correctly failed closed the login form under the CI/local placeholder env (`e2e.invalid.supabase.local`, `example.supabase.co`+`test-anon-key`) — 4 hosted login/readiness failures reproduced locally (2×120s fill timeouts, disabled input), fixed by one policy-passing never-resolvable identity `https://e2e.supabase.invalid` + `e2e-browser-public-key` across playwright.config.ts / browser-readiness.yml / the realtime-DNS allowlist, PLUS the reviewed `financials→owners` hook-seam entry in check-architecture.mjs for the migration-12 allocation imports (`9fbbc596`, pre-loop); (3) `bc3b0c4c` mirrored that seam in the architecture-guard-v2 contract lock (exact-set literal preserved: reports/finance-hub edges stay removed); (4) `337a3046` registered `s09_reverse_correction` in the reviewed dynamic-contract registry (variable payload BY DESIGN — the pure fail-closed `buildReverseS09Args` builder; occurrence-count pinned). Final hosted state at tip: **CI 34584434977 SUCCESS** (build + heavy-validation: vitest **4069/4069**, RLS 84/84, runtime-contract 51/51, contract gates, production build, db0:gate, docs) and **Browser Readiness 34585751072 SUCCESS** (3/3 shards; desktop **172/172** incl. all three NOW-11/12 panel-journey specs — first HOSTED browser execution, green). Staging attempt (run 34586348258): hermetic shards green; `seeded-staging-smoke` BLOCKED at preflight by the deliberate `assert-release-blocker-env.mjs` policy lock (rejects `E2E_ENVIRONMENT_KIND=staging`; dead on main too — NOT relaxed); sanctioned path = `hosted-staging-proof.yml` once staging serves the exact SHA. Main's daily `supabase-live-readiness` failures diagnosed benign: fail-closed skip, `SUPABASE_DB_URL` secret absent — not parity drift. Local pre-runs during the loop: login/readiness/document-platform 27/27, panel specs green under new env (2 INFRA SIGKILL retries green), runtime-contract/RLS/docs/build all PASS, arch + contract gates PASS.

- **NOW-12 (local `d6713ec0`, 2026-09-11 09:10-09:50Z): recovery panel browser coverage + FIRST browser-proven fail-closed refusal — 9/9 matrix green, ZERO product-code change.** `e2e/g5-recovery-panel-journey.spec.ts` completes the five-panel browser matrix: the recovery panel (`?ownerId=` scope in the funds view — offset/recovery panels don't render without it) shows the seeded 200 OMR receivable truthfully; then REAL concurrency (no payload tampering): a lawful 150 recovery goes straight through the deployed `recover_owner_receivable_atomic` while the open UI is stale at 200 → the stale submit is refused by the server, the Arabic reason (المبلغ يتجاوز الرصيد المتبقي من المديونية الأصلية) surfaces in `role=alert`, and SQL truth proves zero change (outstanding 50, one movement, exactly one new journal batch); the honest 50 then succeeds (status message with posted batch id, summary re-reads 200/0, SQL: RECOVERED, two movements, both batches POSTED); every browser-sent payload verified free of server-owned fields (company_id/amount_override/target_account). Evidence: playwright **9/9** (3 panel specs × 3 projects, CI=1, zero retries in the matrix run), typecheck clean, vitest unaffected (zero src change). One spec-locator fix mid-loop (two `role="status"` elements in the panel — empty-state wrapper collides; scoped by text). Sandbox stripped executable bits on `skills/**` scripts (mode-only drift) — restored via chmod, nothing committed. **RESULT: all five G5/G6 panels now browser-proven locally; refused-operation fail-closed path browser-proven.**

- **NOW-11 (local `ec4654bc`, 2026-09-11 08:10-09:05Z): browser coverage of the S09 correction panel and the G6 cutover panel — 6/6 green, ZERO product-code change.** Feasibility first: `playwright install chromium --with-deps` succeeded in this sandbox. Wrote two specs on the NOW-2 fixture build (PGlite full replay + fake Supabase data plane + deployed-function RPC bridges, pattern proven by owner-expense-source.spec.ts): `e2e/s09-correction-panel-journey.spec.ts` drives the full S09 lifecycle in a real browser (seeded DRAFT renders with truthful status/reason; review options arrive through deployed `s08_list_frozen_reviews` — NOW-7 contract; تحقق → مُتحقَّق منها; تطبيق → مُطبَّقة + قيد التصحيح; عكس button gate disabled without reason → reason → معكوسة + قيد العكس; SQL truth: stored REVERSED, 3-batch lineage, original batch byte-identical, compensating POSTED `journal_reversal` batch with `reversal_of_batch_id`) and `e2e/g6-cutover-panel-journey.spec.ts` proves the truthful absence-of-evidence state (explicitly not a zero balance), draft creation through deployed `create_owner_funds_cutover_atomic` with NO `company_id`/`opening_balance` in the payload (server-derived), adopted evidence rendering, and SQL truth (one review-anchored DRAFT row, sha256 fingerprint, `approved_by` null — approval hidden from maker). Evidence: playwright **6/6** (both specs × chromium-desktop/tablet/mobile, CI=1); one INFRA-class SIGKILL worker retry on desktop s09 (re-ran green per standing rule); typecheck clean; vitest unaffected (zero src change — NOW-8 gate matrix stands over identical src). Two dead ends fixed during the loop (recorded in NOW-12 gotchas): service-module imports break Playwright collection; bare textarea locator is ambiguous in the S09 section. Offset/recovery panels: offset+payout already browser-covered by owner-expense-source.spec.ts; recovery remains uncovered → NOW-12.

- **NOW-10 (docs commit, 2026-09-11 07:50-08:05Z): final documentation sweep + DoD checklist + release evidence index.** Appended NOW-6/NOW-7/NOW-8-9 sections to `docs/execution/RECONSTRUCTION_INVENTORY.md` (matching the NOW-5 pattern: verdicts, defect descriptions, files, evidence, not-proven-here). Created `docs/execution/RECONSTRUCTION_DOD_CHECKLIST.md`: per-§G-item verdicts with evidence pointers and exact unblock conditions, the 12-commit release evidence index, gate-matrix continuity table (4055→4060→4061→4065→4066), business-rules hash continuity, and the DoD verdict: **reconstruction NOT declared complete — everything locally executable is done and evidenced; remainder externally blocked** (push/G1/G2/G4/G7/hosted-G3/parity/fixture-seeded browser coverage/governance decision). Sweep found NO contradicted statements in living docs (RECONSTRUCTION_COVERAGE.md's only unverified note — real-device install — remains accurate; historical stop-snapshots left untouched per append-only). Zero code changes.

- **NOW-9 (local `6a66f692`, 2026-09-11 07:30-07:45Z): double-submit guard class closed — full audit, ZERO code changes.** Exhaustive per-surface audit of all 47 `EntityForm.Actions` usages (34 product files), all 14 raw `type="submit"` buttons, and the mobile-form-stepper footer (already `||` semantics). Every mutation-submitting surface is pending-gated (isSubmitting / pending term in submitDisabled / handler isPending early-return) except two evidence-class-(c) surfaces: onboarding waiver dialog (overlay unmounts in the same discrete click — React flushes before any second click; onError toast; server RPC enforces ADMIN/reason/waivability) and admin-support search (read-only query). NOW-8's provisional R1 estimate (~15 unprotected sites) was WRONG — corrected at source in the strategy doc (§5 audit table, R1 CLOSED). Docs-only diff; the NOW-8 gate matrix stands over identical src. **RESULT: 0 ungated mutation surfaces remain in the app.**

- **NOW-8 (local `035db0e2`, 2026-09-11 07:00-07:25Z): G3 concurrency verification strategy + EntityForm double-submit fix.** Surveyed all G3 questions; per-scenario verdicts with evidence in `docs/execution/G3_CONCURRENCY_VERIFICATION_STRATEGY.md` (C1–C8 matrix, Web Locks verdict: lawfully absent — supabase-js owns cross-tab auth coordination, the database owns write ordering; residual risks R1–R3 recorded, hosted checks specified as an executable plan for when G1 unblocks). **One proven defect, reproduced red-first and fixed at the shared source (C4):** `EntityForm.Actions` computed `disabled={submitDisabled ?? isSubmitting}` — any caller-supplied `submitDisabled` (35 call sites, ~20 validation-only) silently overrode the pending guard → submit stayed clickable mid-mutation → double-submit race on every such form. Fixed to `submitDisabled || isSubmitting` (pending ALWAYS disables); locked in `entity-form.test.ts` (asserts the rendered `disabled=""` attribute — Button classes contain `disabled:` Tailwind variants so bare-substring matching is wrong). Evidence: entity-form 9/9, sharded 20-shard **559/4066 / 0 failures / 0 INFRA**, gates 7/7, guardian PASS, hygiene OK, typecheck clean, business-rules v2.0.0 382a0b8c unchanged, 0 migrations — **PROVEN LOCALLY (hosted concurrency checks BLOCKED by G1)**

- **NOW-7 (local `bb45a0d0`, 2026-09-11 06:25-06:55Z): remaining S08/S09 review paths.** **Proven defect (F12/F13 class) fixed at source:** both `loadApprovedS08Reviews` implementations (S09 correction service + owner-funds cutover service) hand-rolled direct `s08_frozen_reviews` SELECTs — since migration 11 that read requires `financial.reports.view` (RLS tightened to stop frozen-evidence exposure), stricter than the server's own S09-anchor/cutover-governance contracts and revocable per-employee → panels break for users the server accepts; meanwhile the deployed metadata RPC `s08_list_frozen_reviews` (granted to `authenticated`, company-scoped, metadata-only) had ZERO client callers. Both loaders now call the RPC through a new strict `parseS08ReviewListEnvelope` (`{company_id, reviews:[…]}`, fail-closed `S08_LIST_RESPONSE_INVALID`, APPROVED filter + prior ordering preserved). Four new real-SQL locks (suite 23→27): envelope contract incl. **no evidence-key leakage** (analysis_results/reconciliation_evidence/exceptions/review_scope/review_notes/reviewer_id/snapshot never exposed) fed unmodified through the client parser; foreign-company isolation; **fingerprint integrity** (dataset changed under ANALYZED review → approval refused `S08_FINGERPRINT_CHANGED_UNDER_REVIEW`; `s08_verify_fingerprint` reports matches=false without mutating); permissions/retries (duplicate approval refused = no double writes; MANAGER refused approval; rejection requires non-empty reason before lifecycle; APPROVED is final; row unchanged after every refusal). **Verified non-defects (recorded, not changed):** deployed list RPCs have no LIMIT (inventing one needs an approved source); cutover table read has its own lawful RLS and no deployed list RPC; S08 analyze/reconcile functions have no client surface by design. Evidence: s09+S08 suite **27/27**, sharded 20-shard **559/4065 / 0 failures / 0 INFRA**, gates 7/7, guardian PASS, hygiene OK, typecheck clean, business-rules v2.0.0 382a0b8c unchanged, 0 migrations — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY (local only; not pushed)**

- **NOW-6 (local `342b18ca`, 2026-09-11 05:55-06:20Z): document surface truth.** Full verification pass: `documentPayloadAdapters.ts` is a pure shape mapper (zero money arithmetic); `professional-owner-report.ts` sources every figure from `rpt_owner_statement` / `rpt_owner_financial_position` / settlement lifecycle — `net_payable` labelled as entitlement, `paid_cash` kept separate with null→'غير مكتمل الإثبات' disclosure and a missing-evidence risk note (cash/entitlement separation already locked by 2 tests); `owner-financial-authority-service.ts` parser verified (nullable paid_cash, proven_total, missing_count); `owner-settlements-service.ts` `outstandingNet = net_payable − offset_applied` applies to DRAFT+APPROVED only = current liability mirroring the server `effective_payable` zod contract — lawful, NOT a historical-cash derivation. **One proven defect found and fixed at source:** the per-settlement `owner_statement` document carried no lifecycle status — a CANCELLED settlement printed byte-identical to a live one (F5 class on the document surface; print/PDF offered for every row). Fix: optional truthful `statusLabel` through `OwnerStatementData`→adapter→registry optionalData→engine KPI 'حالة التسوية' (rendered only when supplied, never inferred from amounts), resolved in `buildOwnerStatementData` via `truthfulStatusLabel(getDocumentTemplateEntry('owner_settlement'), status)` — the same registry authority the professional report uses — with raw-status fallback. Canonical test locks: cancelled label reaches printed chunks, absent label → no status KPI, all four registry labels stay Arabic-truthful. Evidence: canonical+DocumentService+owner-report+ds-exports 38/38, workspace 6/6, axe+entity-form 23/23, inventory 13/13, sharded 20-shard **559/4061 / 0 failures / 0 INFRA**, gates 7/7, guardian PASS, hygiene OK, typecheck clean, business-rules v2.0.0 382a0b8c unchanged, 0 migrations — **PROVEN BY UNIT/INTEGRATION TEST (local only; not pushed)**

- **NOW-5 (local `9767ef03`, 2026-09-11 05:20-05:45Z): S09 coverage beyond `source_type='expense'`.** Real-SQL proof against the deployed `s09_validate_correction_invariants` step 8 for every enumerated type: `invoice` full create→validate→apply chain (separate balanced batch; invoice row byte-identical), `payment` (governed `record_invoice_payment_atomic` fixture), `deposit` (governed `create_deposit_atomic` fixture) — each with a fabricated-id refusal (`S09_SOURCE_EVIDENCE_MISSING`). Non-enumerated labels: deployed behaviour (review-anchored only, no existence check) **locked by test + surfaced as governance finding** — tightening would be inventing a rule without an approved source, so it awaits decision (§NEXT item 2). Panel source-type input now discloses which types are evidence-checked (text only). Evidence: s09 23/23, sharded 20-shard **559/4060 / 0 failures / 0 INFRA**, gates 7/7, guardian PASS, inventory 13/13, axe 15/15, typecheck clean, business-rules unchanged, 0 migrations — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY (local only; not pushed)**

- **NOW-4 (local `9ca483b4`, 2026-09-11 04:28-05:15Z): `s09_reverse_correction` surface + list-envelope defect fix.** Last UI-absent RPC from the coverage audit closed inside the existing `S09CorrectionPanel` (fourth lifecycle step DRAFT→VALIDATED→APPLIED→**REVERSED**, ACCOUNTANT/ADMIN gate surfaced, mandatory non-empty reason, one canonical mount, no new permission key, no migration). Real-SQL proof against the deployed body: original expense batch **byte-identical** after reversal, correction batch **preserved** (same lines) and only flipped to REVERSED, compensating batch separate/POSTED/balanced/equal-and-opposite, stored row keeps full 3-batch lineage + reason in `after_evidence`; guards proven (non-APPLIED refused, empty reason refused, MANAGER refused, ACCOUNTANT accepted, second reversal refused with exactly one compensating batch). **Defect found and fixed at source:** `loadS09Corrections` demanded a bare array but the deployed `s09_list_corrections` returns `{company_id, corrections:[…]}` — the read model failed closed on every real response; fixed via `parseS09ListEnvelope`, regression-locked by feeding unmodified RPC output through the client parser (same class as F12). Strictness added: REVERSED-without-reversal-batch rejected; contradictory nested envelope rejected. Evidence: s09 suite 18/18, focused 142/1045, sharded 20-shard **559/4055 / 0 failures / 0 INFRA**, axe 15/15, gates 7/7, replay 100/100, guardian PASS, hygiene OK, typecheck clean, business-rules unchanged — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY (local only; not pushed, not browser-proven)**
- **HANDOFF transform (4da6a26d):** transformed HANDOFF.md into autonomous loop memory, verified G6 correct, set NOW-1, BLOCKED G1/G2/G7 with reason, no fabrication
- **NOW-1 re-baseline (50be359a):** typecheck clean, gates 7/7 (107 tables/254 policies), replay 100/100, business-rules v2.0.0 382a0b8c unchanged, guardian PASS, focused 137/967 PASS, full 554/3977 PASS after fixing raw `<form>` violation to canonical `EntityForm.Root` — defect found via sharded regression, corrected at authoritative source (component), not by weakening inventory test — **PROVEN BY UNIT/INTEGRATION TEST + REPLAY**
- **NOW-2 browser verification (2026-09-10 18:20-18:45Z):** production build 28 precache / 428.87 KiB / 0 private paths, fixture build VITE_E2E, owner-position-cash 3/3, owner-expense-source 3/3, financial-persisted-journey 6/6, owner-payout-bank-cash 3/3, PWA contract 3/3, axe 15/15, design-system inventory 13/13 — **PROVEN BY BROWSER TEST + BUILD**

### BLOCKED (with reason, do not fabricate, do not wait, skip to NEXT)

- **PUSH / checkpoint-to-remote — UNBLOCKED 2026-09-11 ~10:05Z.** (Historical record: blocked since 05:11Z — no GitHub credential of any kind existed in the sandbox; `git push` failed with `could not read Username`; exhaustively probed env/`~/.git-credentials`/`~/.netrc`/helpers/`gh`/SSH.) The user supplied a PAT in-conversation; the push of all local work succeeded (`bcdf6944..a99e4295`) and the remote SHA was verified via `git ls-remote` to equal local HEAD `a99e4295ba2f91af1dcdc59a15683ed56d9487c2`. **The PAT is conversation-scoped: it was used inline per command, never written to any file, never stored in `.git/config` (push used a one-off URL), and must never be committed.** If it expires, pushes stop again — record and park, do not fabricate. Hosted GitHub Actions runs were then dispatched on the pushed SHA (ci.yml + browser-readiness.yml full e2e matrix; both accepted 204, in progress at 10:07Z): these are the first HOSTED runs of the reconstruction branch.

- **G1 Authenticated app-shell E2E:** BLOCKED — `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` unavailable in environment. Every spec that logs in is gated with `test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)` in `e2e/readiness-smoke.spec.ts` and `e2e/release-blocker-auth.spec.ts`. `single-office-isolated` additionally requires `E2E_ENVIRONMENT_KIND` ∈ {local,qa}, `E2E_SINGLE_OFFICE_ENABLED`, `QA_MUTATION_APPROVED=1`. No secure mechanism supplied. Do not fabricate login bypass. Needs seeded staging credentials or hosted QA. Secure mechanism to supply: environment variables injected via CI secrets or `.env.qa.example` / `.env.production-demo.example` pattern, never committed. Until provided, record as BLOCKED and move on.

- **G2 Intermittent bootstrap stall root cause:** BLOCKED by G1 — defect observed on full-page navigation in authenticated session, which is exactly the uncovered path. Async-auth-callback deadlock hypothesis structurally excluded (both onAuthStateChange listeners contain zero await/async tokens — only setState). Fail-closed mitigation deployed: `withCompanyResolutionTimeout` rejects with `ACTIVE_COMPANY_ERROR` after bounded wait and routes to recovery screen, never substitutes fabricated company. Covered by `use-company.test.tsx` 10 PASS. Two clean reproduction rounds (12 passed each, --retries=0) did not reproduce stall. Two clean rounds do not prove fixed. Do not change auth or Web Locks by guessing. Do not weaken mitigation.

- **G7 SEC-003/SEC-004 exploitation history:** UNKNOWABLE — no historical access logs available. Do not claim exploited or not exploited. Both leaks now closed in production via `20260910000000`.

---

## A. PROJECT OBJECTIVE (preserved)

MALEK (application package name `rentrix`) is an Arabic/RTL, multi-company property-management and property-accounting system for the Omani market. Currency is **OMR with 3 decimals (baisa)**.

The reconstruction mission:

1. **Reconstruct the existing application into a clean implementation** — one canonical implementation per capability.
2. **Preserve valid product behaviour.** Reconstruction is not redesign. If a behaviour is correct, it survives.
3. **Remove unnecessary complexity and duplication.** No parallel `v2` / `new` / `final` / `backup` trees.
4. **Preserve financial correctness above all.** OMR 3-decimal precision, maker/checker, idempotency, correct retries.
5. **Preserve permissions, company/property/owner/tenant isolation, historical data, and workflows.**
6. **Never invent accounting rules.** If the lawful treatment of a financial event is not established by an approved source, the system must **fail closed** and surface the gap — never guess, never zero it, never present a partial figure as a complete one.

### Standing constraints (these are settled decisions — do not relitigate)

- Work only on `reconstruction/checkpoint-20260909`. **No new branch, no PR, no merge, no force-push.**
- **No `reset`, `revert`, `stash`, discarding, or replacing existing work.** Preserve newer/local changes found on arrival.
- Inspect the whole path before changing anything: **UI → state → business logic → API/database → persistence → UI.**
- **Fix the authoritative source. Never edit a report to hide a difference.**
- **Do not derive historical cash from `net_payable` minus current `offset_applied`.**
- Do not grant offset/allocation/historical-adoption rights from an accounting classification or a field name alone.
- **No rewriting of posted history.** Corrections are append-only or compensating entries; the original is retained.
- **No deletion before checking references, functions, data, and tests.**
- After each significant stage: execute → focused tests → actually-saved SQL → browser → diff review → commit → push → **verify the literal remote SHA**.
- Never claim local SQL with mocked auth proves JWT/PostgREST or hosted concurrency.
- **No stage credit and no completion claim without evidence.** State precisely what is and is not proven.

---

## B. CURRENT REPOSITORY STATE (updated 2026-09-11 05:15Z — after NOW-4, push blocked)

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch (only permitted) | `reconstruction/checkpoint-20260909` |
| Previous handoff SHA | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Last work commit (code/schema/evidence) | `9ca483b4` — G5: surface s09_reverse_correction + list-envelope fix — **LOCAL ONLY, not pushed** |
| Local branch tip | `9ca483b4` (1 ahead of remote) |
| Remote HEAD (verified 04:28Z via ls-remote) | `bcdf6944672c46c2417b48562654036cca26c82d` |
| Working tree at this handoff | **clean** — 0 modified, 0 staged |
| Tracked files | ~1,746 |
| Commits ahead of `origin/main` | **49 local / 48 on remote** (`9ca483b4` pending push) — measured `git rev-list --count origin/main..HEAD` |
| Migrations in repo | **100** (unchanged by NOW-4) |
| Production migration ledger | **109 rows** |
| Unit/integration test files | 559 |
| Playwright e2e specs | 29 |
| Fresh validation (NOW-4) | typecheck clean, gates 7/7, replay 100/100, business-rules v2.0.0 382a0b8c unchanged, guardian PASS, migration-hygiene OK, focused 142/1045, sharded 20-shard 559/4055 / 0 failures / 0 INFRA, axe 15/15 — **push NOT verified (blocked)** |

Confirm the true branch tip on arrival:

```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git refs/heads/reconstruction/checkpoint-20260909
```

### Repository structure

```
/                        root package.json OWNS the scripts (typecheck, build, gates…)
  rentrix-app/           the React/TypeScript/Vite PWA  (vitest runs from HERE)
    src/features/        feature modules (financials, owners, contracts, …)
    src/components/ui/   design system incl. entity-table.tsx (responsive table)
    e2e/                 29 Playwright specs
    e2e/support/         fake-supabase-backend.ts — hermetic fixture backend
    scripts/             e2e-static-preview.mjs, run-sharded-regression.mjs
  supabase/migrations/   100 forward-only SQL migrations
  scripts/db0/           replay engine + 7 integrity gates
  docs/source-of-truth/  canonical product/accounting rules — READ, DO NOT INVENT
  docs/execution/        RECONSTRUCTION_INVENTORY.md = the live ledger
  governance/  skills/
```

### Environment notes (this sandbox loses state between sessions)

These are **not** repository defects. Expect them and fix them silently:

1. **`.git/config` is not snapshot-persistent.** `origin` and `user.name`/`user.email` disappear. Re-add:
   ```bash
   git remote add origin https://github.com/mohamedmasoud3030-tech/malek.git
   git config user.name "Reconstruction Agent"; git config user.email "reconstruction@arena.local"
   ```
2. **`node_modules/` is not persistent.** `cd /home/user/malek && pnpm install --frozen-lockfile` (~12 s).
3. **`/home/user/bin/pnpm` loses its exec bit.** `chmod +x /home/user/bin/pnpm`; export `PATH="/home/user/bin:$PATH"` in **every** shell.
4. **`skills/**/*.py` exec bits are lost**, appearing as 8 phantom `mode change 100755 => 100644` entries. **Do not commit these.** Restore instead:
   ```bash
   git diff --summary skills/ | awk '/100755 => 100644/ {print $NF}' | xargs -r chmod +x
   ```
   (`skills/skill-creator/scripts/__init__.py` and `utils.py` are legitimately **644**.)
5. **Playwright browsers are not persistent.** `pnpm exec playwright install chromium --with-deps`.
5b. **A single-branch clone has no `origin/main` ref**, and `check:migration-hygiene` (also run as a
    guardian layer) aborts with `Unable to resolve a base ref (tried origin/main, main)`. Fix silently:
    `git fetch origin main:refs/remotes/origin/main` (a plain `git fetch origin main` only writes
    FETCH_HEAD under the single-branch refspec and is NOT enough). This is an environment artifact,
    not a repository defect.
5c. **pnpm may be absent.** `corepack enable` fails with EACCES on `/usr/bin`; instead:
    `mkdir -p /home/user/bin && printf '#!/bin/sh\nexec corepack pnpm "$@"\n' > /home/user/bin/pnpm && chmod +x /home/user/bin/pnpm`
    then `export PATH="/home/user/bin:$PATH"` (corepack resolves the pinned 10.11.1 from `packageManager`).
6. **Sandbox RAM is ~1.9 GB.** Use `node rentrix-app/scripts/run-sharded-regression.mjs` for the full suite. A `SIGKILL`/`signal=null` worker death is **INFRA, not a test verdict** — re-run that spec in isolation before drawing any conclusion.

### Architecture areas already reconstructed

Authentication/session, navigation/permissions, owner & contract dossiers, VAT/credit/invoice calculation, report snapshots and caches, CSV/Office import, configuration/security hardening, PWA/offline, deposits & retry safety, tenant statements, payment history, receipt allocation, owner receivables, historical reconciliation, owner expense handling, lawful offsets, agreement pagination, migration chain, and RLS/company isolation.

---

## C. WHAT HAS BEEN COMPLETED (preserved, plus G6)

Grouped by area. Everything here is committed on the branch.

### Authentication, session, permissions
- Consolidated auth/session handling into a single implementation; removed duplicate session bootstrap paths.
- Six-role authorization model is **physically representable** and gate-enforced (`role-model` gate).
- Effective-permission resolution consolidated; `request_permission` / `decide_permission_request` / `set_employee_permission` governed via RPC with maker/checker.
- Navigation and route guards consolidated to one permission source.
- `custom_access_token_hook` (JWT claim minting) is the single claim authority — **verified byte-equivalent between repo and production**.

### Financial calculation
- VAT, credit notes, and invoice calculation consolidated into one canonical path (duplicate implementations deleted after reference checks).
- Commission/deal identity and OMR precision normalised.
- Collections, payments and period-close fixes.
- Fixed monthly accruals: posting, late posting, zero-amount, and **compensating reversal** (original accrual always retained).
- Tenant statements and payment-history correction.
- Receipt-allocation handling; `receipt_allocations` and `invoice_payment_tax_allocations` as governed sources.
- Deposits: over-claim prevention and retry safety (`financial_operation_idempotency`).

### Owner financial chain
- `calculate_owner_net_payout` established as the single derivation authority (ADR 0001).
- `rpt_owner_statement` authority rebuilt (migration `20260909000017`): movements key on `s.paid_at` (not legacy `s.date`), value on `app_private.owner_settlement_paid_cash` (not legacy frozen `s.amount`), and filter on `status='PAID' AND paid_at IS NOT NULL` so a **CANCELLED settlement is no longer shown as a deduction**.
- `app_private.owner_settlement_paid_cash` — proven-cash reader. Absence of a journal is **not** proof of zero cash: a lawful fully-offset closure is proven from the persisted payment acknowledgement.
- **Owner position separates settled entitlement from proven cash** (migration `20260909000016` + `owner-financial-authority-service.ts`): `paid_cash` is `NULL` when any historical evidence is missing, `paid_cash_proven_total` carries the partial figure explicitly labelled as *not* a full total, and `paid_cash_evidence_missing_count` surfaces the gap. The parser **rejects** any response where these three contradict each other, and refuses to coerce `null`/empty/boolean/array/object into `0`.
- Professional owner report separates cash from entitlement; every lifecycle figure is labelled "كل الفترات" (all periods) and the document states in-line that an all-period disbursement is **never** subtracted from a single period's entitlement.
- Co-ownership allocation authority (`20260909000018`/`19`); **fixed a double-count of co-owned expenses** in the stored owner balance.
- Owner-funds events are **append-only**, enforced by `trg_owner_funds_event_immutable` (probed live: both UPDATE and DELETE raise `OWNER_FUNDS_EVENT_IMMUTABLE`). Compensating directions are first-class: `INVOICE_CREDIT_REVERSAL`, `RECEIPT_VOID_REVERSAL`, `OWNER_OFFSET_REVERSAL`.
- Historical cutoff: `owner_funds_event_cutovers` carries an APPROVED, S08-review-backed `opening_balance` with maker/checker in a CHECK constraint. Requesting a position **before** the cutover raises `OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED` instead of inventing or zeroing a missing balance.
- S09 corrections post a **new** journal batch and retain `original_journal_batch_id`; an expense already adopted into the receivable subledger is refused (`OWNER_EXPENSE_USE_RECEIVABLE_ADJUSTMENT`) so it is corrected through one path, not two.
- Lawful offset integration (`offset_owner_receivable_atomic`) with offset finality (`20260909000013`).
- **G6 (2026-09-10, commit 354bc427):** allocation/adoption-of-expenses UI already existed (`owner-expense-allocation-fields.tsx` hosted in expenses-section + maintenance resolve overlays, browser-covered by owner-expense-source.spec.ts). Governed historical adoption (owner-funds cutover) had no call sites though RPCs granted to authenticated; one canonical surface built: `owner-funds-cutover-service.ts` + `OwnerFundsCutoverPanel.tsx` hosted once in `OwnerSettlementWorkspace.tsx`. Real-SQL testing found and fixed idempotent envelope defect and corrected wrong re-baseline instruction. 22 unit + 12 PGlite PASS.

### Reconciliation
- Bank reconciliation hardened fail-closed: entity/company match, economic identity, expanded entity types, duplicate-match guards, and **10 cross-company guards**.
- Owner payout can only be reconciled against **proven cash** (`OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`), never against the entitlement.

### Data platform, security, migrations
- Migration chain repaired; **100 migrations replay 100/100 from a clean database**.
- **Production ↔ repository parity proven** (see §D).
- RLS/company isolation across 107 tenant tables; **0 RLS-disabled**, **0 anon grants**, **0 SECURITY DEFINER functions missing `search_path`**, **0 non-`security_invoker` views**.
- **SEC-003 / SEC-004** cross-company read leaks closed in repo *and* production.
- OMR precision normalised to `numeric(18,3)` across all 74 money columns + 7 genuinely lossy columns widened.
- `secure_function_default_privileges` + Guardian `function-default-acl` layer.

### UI / UX / platform
- PWA/offline: production shell installs its worker, precaches `/offline.html`, and serves an Arabic `dir="rtl"` offline page with zero forms.
- **PWA cache privacy:** no `/rest/v1/`, `/auth/v1/` or `/storage/v1/` response is present in any cache store; `navigateFallback: null` with an explicit `NetworkOnly` navigation rule.
- RTL, responsiveness and ≥44 px touch targets verified across 5 viewports in light and dark.
- **Tablet status visibility fixed** (commit `b11b5da3`) — see §F.
- Accessibility: `primitives.axe.test.tsx` 15/15. **This file is on the sharded runner's `EXCLUDED` list — it must be run explicitly.**
- Dead code/dependencies: 8/8 runtime dependencies referenced; 0 unreferenced sources.

### Tooling
- `scripts/db0/` replay engine + 7 integrity gates.
- `run-sharded-regression.mjs` — reports signal-kills as **INFRA**, not as test failures (necessary in a 1.9 GB sandbox).
- `e2e-static-preview.mjs` — serves the production build so browser specs exercise real bundles.

---

## D. PRODUCTION VERIFICATION (preserved)

Live Supabase project `Malek-Plus` (`nnggcnpcuomwfuupupwg`). The user confirmed production currently holds **test data** and explicitly authorised applying the migration chain.

> **Access note:** the Supabase management token and GitHub PATs used were held **in-process only** and were never written to any file. They should be treated as **revoked/expired**; a new agent must request fresh credentials and must not expect any to be present in the repo.

### ✅ PROVEN IN PRODUCTION (hosted, not inferred)

| Claim | Evidence |
|---|---|
| **Anon boundary** | Live REST returns `42501 permission denied` for `companies`/`users`/`audit_log`/`owner_balances`; `anon` holds **0** grants; root discovery 401 with 0 exposed paths. Closes the "local SQL with mocked auth can't prove PostgREST" gap. |
| **JWT-based isolation** | Impersonated the real `authenticated` role with real JWT claims. Admin of company `5138ff36` went from **6 users / 41 audit rows** to **2 users / 0 audit rows**; admin of `ae96d298` sees its own 6 members and its own 7 attributed rows. |
| **SEC-003 + SEC-004 CLOSED** | Applied `20260910000000`. **Zero data loss**: 41 audit rows before and after; 7 recovered attribution from embedded evidence, **34 correctly withheld as unproven (fail-closed)**. |
| **Full migration chain applied** | Ledger **109 rows**. Matching repo files by version **and** name: **0 truly unapplied**. |
| **Zero data change from the chain** | Row counts identical to `pre-financial-baseline.json` and re-confirmed at handoff: journal_batches 26, journal_lines 70, owner_balances 5, expenses 4, contracts 16, invoices 14, audit_log 41, users 6. |
| **Repo ↔ production function parity** | **431 repo functions vs 432 production; 0 semantic differences** after normalising comments/whitespace/semicolons/`public.` prefixes. Includes `custom_access_token_hook`. |
| **Money precision** | **74/74** money columns `numeric(18,3)` in **both**. The 7 scale-2 columns are identical in both and none is ledger money (2 percentage rates, 1 duration, 1 valuation, 3 meter/consumption). |
| **Security posture** | 116 public tables / 107 tenant tables, **0** RLS-disabled, **254–260** policies, **0** definers missing `search_path`, **0** anon grants, **0** non-`security_invoker` views. |
| **`rpt_owner_statement` deployed body** | Identical both sides at 4,519 chars: legacy `s.date` **0**, legacy `s.amount` **0**, `owner_settlement_paid_cash` **3**, `s.paid_at` **3**, `_owner_statement_expenses` **1**. |
| **Production-safe no-op migration** | `20260910000003` applied HTTP 201 as a **verified no-op** — function length `16886` unchanged, state `cash_reader 1 / guard 1 / legacy 0 / cross_guards 10`. |

One function exists **only** in production: `public.wp05_rpt_cash_flow_gl(date,date)`. This is **not drift** — `20260901000064` relocated the body to `app_private.financial_cash_flow_gl_core` and left this thin wrapper, which *adds* `require_financial_reports_view()`, is `SECURITY DEFINER` with a pinned `search_path`, and is called by **no** application code.

### ⚠️ PROVEN ONLY LOCALLY / IN REPLAY (historical)

- All **3,943** unit/integration tests — PGlite (real PostgreSQL in WASM) with **mocked auth**. This proves SQL logic; it does **not** prove PostgREST behaviour, JWT handling, or hosted concurrency.
- All browser specs — run against a **hermetic fixture backend** (`fake-supabase-backend.ts`), never against production.
- Migration replay 100/100 — clean local database, not production.
- Guardian and the 7 gates — static/replay analysis.

---

## E. VALIDATION EVIDENCE (historical at e6e2e444, plus G6, plus fresh NOW-1)

All measured on **2026-09-10** at or near `e6e2e444`. Do not reuse these numbers after changing code — re-measure. G6 commit 354bc427 adds 2 test files, no migration, no accounting rule change; business-rules hash expected unchanged but must be re-measured in NOW-1. **Fresh NOW-1 measurement below.**

| Check | Command | Result (historical at e6e2e444) |
|---|---|---|
| Full regression | `node rentrix-app/scripts/run-sharded-regression.mjs` | **552 files / 3,943 tests / 0 failures**, 0 INFRA kills |
| Financials + owners focus | `pnpm vitest run src/features/financials src/features/owners` | **135 files / 933 tests PASS** |
| Migration replay | `node scripts/db0/replay-migrations.mjs` | **100/100**, 0 failures |
| Integrity gates | `pnpm db0:gate` | **7/7 PASS** |
| Guardian | `pnpm db:guardian` | **PASS**, 5 layers (incl. privileged-key scan, function-default-ACL) |
| TypeScript | `pnpm typecheck` | clean |
| Migration hygiene | `pnpm check:migration-hygiene` | OK |
| Business rules | `pnpm check:business-rules` | `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` |
| Accessibility | `pnpm vitest run src/components/ui/primitives.axe.test.tsx` | **15/15** (excluded from sharded runner — run explicitly) |
| Build + PWA | `pnpm build` | OK, 28 precache entries / 428.87 KiB, **0** private API paths in `sw.js` |
| PWA runtime contract | `E2E_PRODUCTION=true playwright test e2e/pwa-production-contract.spec.ts` | **3/3** desktop/tablet/mobile |
| Owner position browser | `playwright test e2e/owner-position-cash.spec.ts` | **3/3**, retries 0 |
| Financial journey browser | `playwright test e2e/financial-persisted-journey.spec.ts` | **6/6** after the tablet fix |
| UI/RTL/responsive | owners + maintenance-polish + single-office + documents-vault | **95 passed / 0 failed** (40 skipped: desktop-only journeys, width-conditional assertions, and credential-gated auth specs) |

**G6 delta (commit 354bc427):**
- New files: `owner-funds-cutover-service.ts` (430 lines), `OwnerFundsCutoverPanel.tsx` (337), `owner-funds-cutover-service.test.ts` (176, 22 assertions), `owner-funds-cutover-adoption.pglite.test.ts` (505, 12 real-SQL)
- No migration, business-rules hash unchanged (to be re-measured in NOW-1)
- Still unproven at commit time: hosted parity re-measure, browser run for new panel, G3/G4 concurrency

**Fresh NOW-1 baseline (2026-09-10 17:30Z, after 354bc427 + 4da6a26d, before form fix):**
- typecheck: clean
- db0:gate: 7/7 PASS (isolation 107 tables / 254 policies)
- replay-migrations: 100/100, 0 failures
- business-rules: v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79 unchanged
- migration-hygiene: OK
- guardian: PASS all layers
- focused financials+owners: 137 files / 967 tests PASS
- sharded regression: 554 files / 3977 tests — 1 failure (design-system inventory raw <form> in OwnerFundsCutoverPanel.tsx) → **PROVEN INCORRECT** for that pattern

**Fresh NOW-1 after form fix (2026-09-10 17:36Z, commit to be pushed):**
- typecheck: clean (re-measured)
- design-system inventory: 13/13 PASS (after fix)
- sharded regression: **554 files / 3977 tests / 0 failures**, 0 INFRA kills — **PASS**
- No new RLS, precision, or contract drift
- Classification: raw `<form>` → canonical `EntityForm.Root` fix **PROVEN CORRECT**, preserves disclosure, permission-gating, Arabic copy, fail-closed parsing

**Fresh NOW-3 / G5 measurement (2026-09-11, commit `9fac02ac`) — THIS IS THE LATEST MEASURED EVIDENCE:**
- typecheck: clean (re-measured)
- sharded regression: **4010 tests / 0 failures**, 0 INFRA kills — **PASS** (was 3977; +33 from the new G5 suites)
- axe suite (excluded from the sharded runner, run explicitly): **15/15 PASS**
- db0:gate: **7/7 PASS**  ·  guardian: **PASS**  ·  migration-hygiene: **OK**
- business-rules: `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` — **unchanged** (correct: no migration was added)
- owners feature suite: 29 files / 241 tests PASS
- Scope of change: 6 files, +1410 lines, **0 migrations**, 0 accounting-rule files
- **Not measured in this session:** hosted browser/E2E for the new panel, hosted concurrency, hosted repo↔production parity re-measure

**Fresh G5-completion measurement (2026-09-11, commit `411167f6`):**
- sharded regression **at 20 shards**: **4046 tests / 0 failures / 0 INFRA kills** — **PASS**
- ⚠️ The same suite at 12 shards reported only `3737 tests` because **SHARD 5 was SIGKILLed by the sandbox memory limit**, masking ~309 tests. A SIGKILLed shard is INFRA, never a product verdict, and its absence must not be read as a smaller passing suite. **Use `node scripts/run-sharded-regression.mjs 20` in this sandbox.**
- axe suite (run explicitly, excluded from the runner): **15/15 PASS**
- typecheck clean · db0:gate **7/7** · guardian **PASS** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c…` — **unchanged** (no migration added)
- Scope: 8 files, **0 migrations**, 0 accounting-rule files
- **Not measured:** hosted browser/E2E for either new panel, hosted concurrency, hosted parity re-measure

**Fresh NOW-4 measurement (2026-09-11 04:40-05:00Z, commit `9ca483b4` — local only):**
- s09 suite: **18/18 PASS** (9 pre-existing + 9 new: 6 real-SQL against the deployed `s09_reverse_correction` body, 3 pure-parser)
- focused `src/features/financials src/features/owners`: **142 files / 1045 tests PASS**
- sharded regression **20 shards**: **559 files / 4055 tests / 0 failures / 0 INFRA kills — PASS** (was 4046; +9 from the new reversal tests)
- axe suite (run explicitly): **15/15 PASS**
- typecheck clean · db0:gate **7/7** · replay **100/100** · guardian **PASS all layers** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` — **unchanged** (no migration added, 0 accounting-rule files)
- Scope: 4 files (+676/−12), **0 migrations**, 0 new permission keys, 0 new mounts
- **Not measured:** hosted browser/E2E for the panel, hosted concurrency, hosted parity re-measure, **push (blocked — no credential)**

**Fresh NOW-9 measurement (2026-09-11 07:30-07:45Z, commit `6a66f692` — local only) — THIS IS THE LATEST MEASURED EVIDENCE:**
- **Docs-only NOW** — zero src changes (`git status` at commit time: only the strategy doc modified). The NOW-8 measured matrix therefore stands verbatim over identical source:
- entity-form suite **9/9** · sharded regression **20 shards**: **559 files / 4066 tests / 0 failures / 0 INFRA — PASS**
- typecheck clean · db0:gate **7/7** · guardian **PASS all layers** · migration-hygiene **OK** · business-rules `v2.0.0 382a0b8c…` unchanged
- **Not measured:** hosted browser/E2E, hosted concurrency, parity re-measure, **push (blocked — no credential)**

**Prior NOW-8 measurement (2026-09-11 07:00-07:25Z, commit `035db0e2` — local only):**
- entity-form suite: **9/9 PASS** (+1 G3 double-submit race lock, red before the component fix)
- sharded regression **20 shards**: **559 files / 4066 tests / 0 failures / 0 INFRA kills — PASS** (was 4065; +1)
- typecheck clean · db0:gate **7/7** · guardian **PASS all layers** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c…` — **unchanged** (0 migrations)
- Scope: 2 src files (+33/−1) + 1 strategy doc, 0 migrations, 0 new permission keys
- **Not measured:** hosted browser/E2E, hosted concurrency (G1-blocked; plan committed), parity re-measure, **push (blocked — no credential)**

**Prior NOW-7 measurement (2026-09-11 06:25-06:55Z, commit `bb45a0d0` — local only):**
- s09+S08 suite: **27/27 PASS** (+4 real-SQL: envelope/evidence-leak lock, company isolation, fingerprint-drift approval block, permission/retry locks)
- sharded regression **20 shards**: **559 files / 4065 tests / 0 failures / 0 INFRA kills — PASS** (was 4061; +4; first run had 1 SIGKILLed shard from a concurrent vitest I was running — INFRA per §L, clean rerun is the verdict)
- typecheck clean · db0:gate **7/7** · guardian **PASS all layers** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c…` — **unchanged** (0 migrations, 0 accounting-rule files)
- Scope: 3 files (+268/−28), 0 migrations, 0 new permission keys
- **Not measured:** hosted browser/E2E, hosted concurrency (NOW-8 designs the local strategy around that), hosted parity re-measure, **push (blocked — no credential)**

**Prior NOW-6 measurement (2026-09-11 05:55-06:15Z, commit `342b18ca` — local only):**
- canonical documents suite: **38/38 PASS** (incl. new owner-statement lifecycle-label test) · workspace **6/6**
- sharded regression **20 shards**: **559 files / 4061 tests / 0 failures / 0 INFRA kills — PASS** (was 4060; +1)
- design-system inventory **13/13** · axe + entity-form **23/23** · s09 suite 23/23 (unchanged since NOW-5)
- typecheck clean · db0:gate **7/7** · guardian **PASS all layers** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c…` — **unchanged** (0 migrations, 0 accounting-rule files)
- Scope: 7 files (+70/−3), 0 migrations, 0 new permission keys
- **Not measured:** hosted browser/E2E, hosted concurrency, hosted parity re-measure, **push (blocked — no credential)**

**Prior NOW-5 measurement (2026-09-11 05:20-05:45Z, commit `9767ef03` — local only):**
- s09 suite: **23/23 PASS** (+5 real-SQL: invoice full chain + preservation, invoice/payment/deposit fabricated-source refusals, non-enumerated behaviour lock)
- sharded regression **20 shards**: **559 files / 4060 tests / 0 failures / 0 INFRA kills — PASS** (was 4055; +5)
- design-system inventory **13/13** · entity-form + axe suites **25/25** · axe (explicit) **15/15**
- typecheck clean · db0:gate **7/7** · guardian **PASS all layers** · migration-hygiene **OK**
- business-rules `v2.0.0 382a0b8c…` — **unchanged** (0 migrations, 0 accounting-rule files)
- Scope: 3 files (+265/−2), 0 migrations, 0 new permission keys
- **Not measured:** hosted browser/E2E, hosted concurrency, hosted parity re-measure, **push (blocked — no credential)**

### How to reproduce the browser runs

```bash
export PATH="/home/user/bin:$PATH"
cd /home/user/malek && pnpm install --frozen-lockfile
cd rentrix-app && pnpm exec playwright install chromium --with-deps

# Fixture-driven specs need the VITE_E2E bundle:
VITE_E2E=true pnpm build
node scripts/e2e-static-preview.mjs &          # serves dist/public on :5173
E2E_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test <spec> --retries=0 --workers=1
```

> **Two-build trap (documented, do not re-enter):** `pnpm build` + preview proves the **production shell** (PWA/SW/offline). `VITE_E2E=true` build + preview proves the **fixture-driven UI specs**. Neither build can prove the other's specs. *A login screen with disabled inputs is the signature of running a fixture spec against a production bundle — an INFRASTRUCTURE signature, never a product verdict.*

---

## F. IMPORTANT DEFECTS FOUND AND FIXED (preserved)

### F1. Authorization NULL fall-through
- **Root cause:** permission evaluation treated a `NULL` result as permissive.
- **Correction:** fail-closed evaluation; `role_has_app_permission` returns an explicit boolean.
- **Validation:** role-model gate + permission suites.
- **Production affected:** no.

### F2. Deposit over-claiming
- **Root cause:** retries could claim a deposit more than once.
- **Correction:** idempotency keyed through `financial_operation_idempotency`; bounded retry.
- **Validation:** deposit controller/retry suites; persisted browser journey.
- **Production affected:** no.

### F3. Payment-history gaps / tenant statement drift
- **Root cause:** statement read model did not reflect posted credits and voided receipts.
- **Correction:** statement rebuilt from posted sources.
- **Validation:** tenant statement + read-model suites; `reconstruction-financial-read-model` 6/6.
- **Production affected:** no.

### F4. Historical-cutoff error (inventing a missing balance)
- **Root cause:** a pre-cutover owner position silently produced a number.
- **Correction:** fail closed with `OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED` unless an S08-backed, maker/checker-approved cutover exists.
- **Validation:** `owner-agency-invoice-accounting.test.ts` 17 PASS incl. "fails closed for a historical 2000 position".
- **Production affected:** no.

### F5. Owner-receivable / settlement reconciliation error
- **Root cause:** settlement movements used legacy `s.date` and frozen `s.amount`; CANCELLED settlements were presented as deductions.
- **Correction:** migration `20260909000017` — key on `paid_at`, value on proven cash, filter `status='PAID' AND paid_at IS NOT NULL`.
- **Validation:** verified against the **deployed** body in both repo and production (identical, 4,519 chars).
- **Production affected:** yes — **now fixed in production**.

### F6. Co-owned expense double-count
- **Root cause:** stored owner balance counted a co-owned expense once per owner link.
- **Correction:** unallocated co-owned expenses stay unallocated instead of being double counted (commits `3168c2e1`, `d80261d8`).
- **Validation:** dedicated regression proving the money path is fail-closed.
- **Production affected:** no (repo-side balance derivation).

### F7. Migration drift / production ↔ replay function drift
- **Root cause:** **rewriting already-merged migrations.** 24 migrations patch functions by string-matching `pg_get_functiondef()` output; commit `8258c528` edited `20260901000038` *after* production had applied it, so anchors stopped matching.
- **Correction:** forward-carry migrations only. `20260910000001` (whitespace normaliser, refuses to act unless whitespace-identical) and `20260910000002` (carries lines 1–776 of `20260901000033` **verbatim by line range**, omitting only the obsolete wp05 DO block).
- **Validation:** repo ↔ production parity now **0 semantic differences across 431 functions**.
- **Production affected:** yes — **now reconciled**.

### F8. Cross-company RLS leaks — SEC-003 (`audit_log`) and SEC-004 (`users`)
- **Root cause:** both tables were readable across company boundaries by an authenticated admin.
- **Correction:** `20260910000000` — company-scoped policies; audit rows whose company cannot be proven are **withheld**, not guessed.
- **Validation:** impersonated real JWT claims. 6 users/41 audit rows → 2 users/0 audit rows for a foreign admin; 41 rows preserved, 7 attributed, **34 withheld fail-closed**.
- **Production affected:** **YES — these were live. Both are now closed in production.** Whether they were ever exploited is **unknown** (no historical access logs).

### F9. Regression introduced by this reconstruction, then fixed
- **Root cause:** `20260910000002` (the forward-carry) runs `create or replace function public.process_bank_reconciliation_match_atomic`. On a **clean replay** filename order places it *after* `20260909000015`, silently reverting it — the match authority fell back to reading `s.net_payable` (**entitlement**) instead of `app_private.owner_settlement_paid_cash` (**proven cash**) and lost `OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`. A bank line could have been reconciled against a payout never actually paid.
- **Correction:** `20260910000003` re-applies migration 15's DO block **copied verbatim by line range** (`diff` vs lines 69–89 of `...015`: IDENTICAL). Neither merged migration was edited. **Strictly idempotent**: skips when the replacement is already present exactly once, aborts on any unrecognised state, never double-applies.
- **Validation:** replaying the full chain **plus the migration a second time** yields `cash_reader 1 / guard 1 / cross_guards 10`, 101 applied, 0 failures. `owner-payout-cash-authority.test.ts` 8/8 (was 3 failing).
- **Production affected:** **NO.** In production `...015` was applied *after* the forward-carry, so the live function already held both changes. **Clean-replay-only** — exactly what the replay gate exists to catch.

### F10. Reversed accruals invisible on tablet
- **Root cause:** `fixed-monthly-accrual-workspace.tsx` declared `status` as `priority: 'secondary'`. `resolveTabletColumns` (`entity-table.tsx:236-246`) keeps only the first **1–2** secondary columns; with 4 stable columns the limit is 2 and `monthly`/`net` come first, so **`status` was dropped entirely at 768 px** — a REVERSED accrual ("تم العكس") looked identical to a live one.
- **Correction:** promoted to `priority: 'primary'`, matching automation/communication/billing-readiness/lands. The shared table component was **not** weakened and the assertion was **not** relaxed.
- **Validation:** `financial-persisted-journey` 6/6 (was failing on tablet); accrual + entity-table unit suites 44 PASS.
- **Production affected:** presentation only. **Pre-existing** — `git diff 81ee3671..HEAD` shows these files were untouched by the session that found it.

### F11. Silent migration-ledger gap
- **Root cause:** `20260909000012` and `20260909000014` executed successfully, but their `schema_migrations` rows were missing — both files contain `$s$`, which collided with the dollar-quote tag used by the recording step, so the bookkeeping INSERT failed after the DDL had committed.
- **Correction:** rows re-inserted using base64 encoding so no tag collision is possible.
- **Lesson (now a rule):** **executing migration SQL is not applying a migration — confirm the ledger row.**

### F12. G6 idempotent envelope false failure (found and fixed 2026-09-10 in 354bc427)
- **Root cause:** deployed `create_owner_funds_cutover_atomic` returns existing row nested under `cutover` key with no top-level status on idempotent re-create. Flat-shape-only parser reported `OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN` for lawful response.
- **Correction:** parser reads both flat and nested envelopes; lawful-status requirement unchanged, regression-locked.
- **Validation:** unit 22 PASS + PGlite 12 PASS, including idempotent re-create keeps exactly one baseline row.

### F13. S09 list-envelope false failure (found and fixed 2026-09-11 in `9ca483b4`)
- **Root cause:** deployed `s09_list_corrections` returns `jsonb_build_object('company_id',…,'corrections',[…])` — an OBJECT with rows nested — but `loadS09Corrections` demanded a bare top-level array, so the S09 panel's read model raised `S09_LIST_RESPONSE_INVALID` on **every genuine response**: fail-closed, but the corrections list could never render. Introduced in 411167f6; missed there because no test fed the deployed body's output through the loader.
- **Correction:** `parseS09ListEnvelope` reads the deployed envelope and rejects a bare array; same class as F12. Also tightened: `parseS09Correction` rejects a REVERSED row with no reversal batch id (`S09_REVERSED_WITHOUT_BATCH`), and `parseReverseS09Result` rejects a top-level `reversal_batch_id` that contradicts the nested `reverse_journal_batch` envelope (`S09_RESPONSE_CONTRADICTION`).
- **Validation:** regression feeds the unmodified RPC output from real SQL through the client parser and asserts the envelope is not a bare array; s09 suite 18/18 PASS; sharded 559/4055 PASS.
- **Production affected:** no (surface was never deployed; the defect would have made the new panel's list unusable).

---

## G. REMAINING WORK (updated)

Only items with **no** supporting evidence are listed. Anything not here has evidence in §D/§E or §AUTONOMOUS LOOP STATE.

### G1. Authenticated app-shell E2E — **BLOCKED (missing credentials)**
Every spec that logs in is gated:
```ts
test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)
```
in `e2e/readiness-smoke.spec.ts` and `e2e/release-blocker-auth.spec.ts`. `e2e/single-office-isolated.spec.ts` additionally requires `E2E_ENVIRONMENT_KIND` ∈ {local, qa}, `E2E_SINGLE_OFFICE_ENABLED`, and `QA_MUTATION_APPROVED=1` for QA.
**No local browser test ever reaches the authenticated app shell.** Needs seeded staging credentials or hosted QA. **Do not fabricate a login bypass to make these run.**

### G2. Intermittent bootstrap stall — root cause **OPEN, BLOCKED by G1**
- The async-auth-callback deadlock hypothesis is **structurally excluded, by inspection not guesswork**: both `onAuthStateChange` listeners (`src/hooks/use-auth.tsx:88`, `src/features/onboarding/useOnboarding.ts:66`) contain **zero** `await`/`async` tokens — they only call `setState`. A callback that never awaits cannot hold the GoTrue Web Lock across I/O.
- A **fail-closed mitigation is deployed and is not a masking fallback**: `withCompanyResolutionTimeout` (`src/hooks/use-company.tsx:17`) rejects with `ACTIVE_COMPANY_ERROR` after a bounded wait and routes to a recovery screen. It never substitutes a fabricated company. Covered by `use-company.test.tsx` 10 PASS.
- Two clean reproduction rounds (12 passed each, `--retries=0`) did **not** reproduce the stall. **Two clean rounds do not prove it fixed.**
- **Blocked by G1** — the defect was observed on full-page navigation in an *authenticated* session, which is exactly the uncovered path.
- **Do not change auth or Web Locks by guessing.**

### G3. Hosted concurrency / Web Locks — **NOT EXERCISED**
No contended-RPC or concurrent-session testing has been performed against the hosted database.

### G4. Runtime behaviour of newly-applied migrations under real traffic — **NOT EXERCISED**
The 11 migrations applied on 2026-09-10 are structurally verified (parity, row counts, probes) but have not been exercised by live usage.

### G5. Remaining financial-chain review items — **PARTIALLY CLOSED (commit 9fac02ac)**

An audit of **all 92 production `.rpc(` call sites** against the live database
(`pg_proc` + `has_function_privilege('authenticated', …)`) established a concrete, evidence-based
finding rather than a suspicion: four financially significant RPCs were live, granted `EXECUTE` to
`authenticated`, and had **no user-facing surface at all**.

| RPC | Surface |
|---|---|
| `offset_owner_receivable_atomic` | **CLOSED** — `OwnerReceivableOffsetPanel` (9fac02ac) |
| `recover_owner_receivable_atomic` | **CLOSED** — `OwnerReceivableRecoveryPanel` (411167f6) |
| `s09_create_correction_draft` | **CLOSED** — `S09CorrectionPanel` (411167f6) |
| `s09_apply_correction` | **CLOSED** — `S09CorrectionPanel` (411167f6) |
| `s09_reverse_correction` | **CLOSED** — `S09CorrectionPanel` reversal step (`9ca483b4`, **local only — push blocked**) |

All four RPCs found by the audit now have a canonical surface. The S09 chain is surfaced as three
explicit steps (DRAFT → VALIDATED → APPLIED) because the server refuses to apply anything not
VALIDATED. Real-SQL proof that a correction does not rewrite history: the ORIGINAL journal batch is
byte-identical after apply, and the correction posts a SEPARATE balanced batch with both linked on
the stored row.

**Closed:** *adjustment/offset interface showing its effect on the original source* for the offset
path. The panel displays the original amount unchanged beside the offsets applied, the remaining
outstanding, and the posted GL batch id — an offset never rewrites the original receivable. Proven by
11 real-PostgreSQL assertions against the **deployed** function body plus 22 pure unit assertions.
No migration; canonical business-rules hash unmoved. Proven **locally / in replay only** — no hosted
browser run for this panel.

**`s09_reverse_correction` — CLOSED at `9ca483b4` (local only, push blocked):** fourth lifecycle step
surfaced in the existing `S09CorrectionPanel`; real-SQL proof that reversal preserves BOTH the
original source batch (byte-identical `to_jsonb` snapshot) and the correction batch (lines intact,
status flips to REVERSED), with a separate balanced equal-and-opposite compensating batch and full
3-batch lineage on the stored row. Building it also exposed and fixed a real defect at source:
`loadS09Corrections` expected a bare array while the deployed `s09_list_corrections` returns
`{company_id, corrections:[…]}`, so the read model failed closed on **every** genuine response and
the list could never render — same class as F12, now regression-locked by feeding unmodified RPC
output from real SQL through the client parser.

**Still open:**
- Governed historical **adoption/allocation** of expenses — allocation UI exists, governed adoption UI exists (G6), but unblocking legacy settlements only after correct legal/accounting review remains.
- **Governance decision (needs user/approved source):** non-enumerated S09 `source_type` labels bind only to the APPROVED S08 review — no source-existence check (deployed step 8 enumerates exactly invoice/payment/expense/deposit, each now regression-proven at `9767ef03`). Tightening = inventing an accounting rule; do not do it unilaterally.
- Remaining S08/S09 review paths: sources, cache/rebuild, permissions, read limits, retries, reconciliations.
- Cash/fees/tax/offset/collection/recovery truth in owner statements **and documents** — statement path verified; document surface verified at NOW-6 (`342b18ca`): adapters are pure shape mappers, the professional owner report separates entitlement from proven cash with null disclosure, and the one proven defect (settlement statement printed without lifecycle status — cancelled read as live) is fixed and regression-locked.
- No hosted browser run covers any of the five G5/G6 panels (offset, recovery, S09 create/validate/apply, S09 reverse, cutover) — the fixture backend seeds none of their tables.

### G6. UI surfaces for backend-complete capabilities — **RESOLVED (inspection + one canonical build, commit 354bc427)**

**Verified first, built second (2026-09-10, later session):**
- Allocation/adoption-of-expenses UI **already existed** — `features/financials/expenses/owner-expense-allocation-fields.tsx` (hosted in `expenses-section.tsx` and `maintenance-detail-resolve-overlays.tsx`, browser-covered by `e2e/owner-expense-source.spec.ts`). Nothing was built for it.
- Governed **historical adoption** (owner-funds cutover) had **no application call sites** although both RPCs are granted to `authenticated`. One canonical surface was built: `features/owners/services/owner-funds-cutover-service.ts` + `features/owners/components/OwnerFundsCutoverPanel.tsx`, hosted once in `OwnerSettlementWorkspace.tsx` (see `docs/execution/RECONSTRUCTION_INVENTORY.md`).
- Real-SQL testing of the panel found and fixed one real defect (idempotent envelope read as an unknown status) and corrected one wrong instruction (the app cannot re-baseline a drifted draft).

**Still unproven at time of commit:** hosted parity re-measurement for this session, browser execution for the new panel, G3/G4 concurrency. These move to NOW-1 / NEXT-1.

### G7. Whether SEC-003/SEC-004 were ever exploited — **UNKNOWABLE HERE**
No historical access logs are available. Do not claim they were not exploited.

---

## H. OPEN RISKS (preserved)

### Code risks
- **24 migrations patch functions by string-matching `pg_get_functiondef()` output**; 12 raise anchor/precondition errors. Any future anchor migration can halt if a body drifts. *Mitigation:* parity is currently exact — keep it that way and never rewrite a merged migration.
- **Ordering hazard (proven real — F9):** a `create or replace function` in a **later** migration silently reverts an **earlier** anchor patch on clean replay while production, applied in a different order, looks fine. **Always run a clean replay plus the focused suite before trusting a function-level migration.**

### Production risks
- Newly-applied migrations are unexercised under real traffic (G4).
- No hosted concurrency proof (G3).

### Data risks
- Production holds **test data** (user-confirmed) — but the same code will run against real ledgers. Treat every financial change as production-grade.
- **Never** perform production data fixes. Only forward migrations, only with explicit authorization.

### Security risks
- SEC-003/SEC-004 exploitation history is unknowable (G7).
- Credentials used in prior sessions were in-process only and are **not** in the repo; assume revoked.

### Infrastructure / environment limitations
- Sandbox ~1.9 GB RAM → use the sharded runner; treat SIGKILL as INFRA.
- `.git/config`, `node_modules`, Playwright browsers, and skills exec bits do **not** persist (see §B).
- Supabase **preview branches are unusable** in this environment (previously attempted, dead end).
- No hosted QA environment and no seeded staging credentials.

---

## I. NEXT RECOMMENDED EXECUTION ORDER (preserved, superseded by AUTONOMOUS LOOP STATE for execution)

Follow in order. Do not skip ahead.

### Step 0 — Restore and verify (before any edit)
1. Re-add `origin` + git identity; `chmod +x /home/user/bin/pnpm`; `export PATH="/home/user/bin:$PATH"`.
2. `pnpm install --frozen-lockfile`.
3. Restore skills exec bits (§B item 4). **Confirm `git status` is clean — do not commit mode changes.**
4. Confirm branch tip via `git ls-remote` and compare to `git rev-parse HEAD`.
5. Read `HANDOFF.md` (this file), then `docs/execution/RECONSTRUCTION_INVENTORY.md`, `AGENTS.md`, `DATABASE_RULES.md`, `docs/source-of-truth/00_INDEX.md`.
6. Establish a fresh baseline: `pnpm typecheck`, `pnpm db0:gate`, `node scripts/db0/replay-migrations.mjs`. **Record the numbers.**

### Step 1 — HIGHEST PRIORITY: unblock authenticated E2E (G1 → G2)
- **Evidence required:** whether `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (or a disposable QA target) can be provided. **Ask the user — this is a genuine external blocker, not a routine decision.**
- **If provided:** run `readiness-smoke` and `release-blocker-auth` against the authenticated shell; attempt to reproduce the bootstrap stall on full-page navigation with tracing enabled.
- **Implementation target:** only after a reproduction exists. Fix the proven cause in `use-auth` / `use-company` / onboarding.
- **Validation:** repeated authenticated navigation rounds + existing `use-company` suite.
- **If NOT provided:** record the blocker explicitly and move to Step 2. **Do not guess at auth or Web Locks. Do not weaken `withCompanyResolutionTimeout`.**

### Step 2 — Confirm G6 before building any UI
- `grep` the owners/financials features for the adoption/allocation RPCs from `20260909000012` / `...018`.
- **If a surface exists:** mark G6 resolved with the file path as evidence.
- **If genuinely absent:** build one canonical surface. It must display *effect on the original source*, respect maker/checker, and never present an unproven figure as complete.
- **Validation:** focused unit tests + a browser spec with a **negative control** (break the disclosure, prove the spec fails, restore byte-for-byte).

### Step 3 — Close the G5 review items
**Highest-priority remaining G5 item:** build the missing surface for `s09_reverse_correction`
(deployed, granted, no UI), following the pattern now established three times over by
`OwnerReceivableOffsetPanel` / `OwnerReceivableRecoveryPanel` / `S09CorrectionPanel` — read the deployed
function body first, strict fail-closed parsers, no client-side money arithmetic, one canonical mount,
real-SQL tests. Then extend correction coverage beyond `source_type='expense'`.

Then work the chain end to end: expense → source evidence → classification → allocation → offset → settlement → ledger → balance → historical cutoff → reports. For each, verify against the **deployed** function body, not documentation. Any gap → forward migration + focused SQL test.

### Step 4 — Re-verify parity and re-measure
Re-run the §D parity comparison (normalised function hashes both sides) and the full §E matrix. **Never reuse this document's numbers as current.**

### Step 5 — Checkpoint discipline (after every step)
```
execute → focused tests → real SQL → browser → diff review → commit → push → verify literal remote SHA
```
Never leave a large batch of completed work uncommitted. Update `docs/execution/RECONSTRUCTION_INVENTORY.md` (COMPLETED / IN PROGRESS / NEXT / BLOCKED / REMOVED / PRESERVED) in the same commit as the work it describes.

---

## J. SETTLED DECISIONS — DO NOT REOPEN OR INVENT (preserved)

**Settled (treat as fact):**
- `calculate_owner_net_payout` is the single owner-payout derivation authority (ADR 0001).
- Proven cash comes from `app_private.owner_settlement_paid_cash`, never from `net_payable`, and never from `net_payable − offset_applied`.
- Owner-funds events are append-only; corrections are compensating entries.
- A missing historical balance fails closed; it is never invented or zeroed.
- OMR money is `numeric(18,3)`. Rates, durations, valuations and meter readings are legitimately scale-2.
- Merged migrations are immutable. Repairs are **forward-carry**, copied verbatim by line range.
- Fixture backends fail closed (404/PGRST205) on unseeded tables — **never** answer `200 []`.

**Must NOT be invented — require an approved source or the user:**
- Any accounting treatment not already established in `docs/source-of-truth/`.
- Any opening balance, cutover date, or historical allocation lacking S08/S09 approval.
- Any authorization rule inferred from a field name or accounting classification alone.
- Any production data fix.

---

## K. LATEST SAFE CHECKPOINT (updated 2026-09-11 12:50Z — NOW-15 COMPLETE: G4 preflight pipeline fixed & first-ever green; branch PUSHED, remote==local, hosted CI + browser matrix FULL GREEN)

| | |
|---|---|
| Branch | `reconstruction/checkpoint-20260909` |
| Last work commit (code/schema/evidence) | `ce0fbb33` — NOW-15: G4 local-preflight workflow fix (CI-infra-only; last product-src change remains `035db0e2` NOW-8) — **ON REMOTE** |
| Local branch tip | `ce0fbb33` (+ this HANDOFF-update commit pushed immediately after — remote and local kept equal at every step, `git ls-remote`-verified) |
| Remote branch tip | `ce0fbb33b602057a67ab5e3a73605c04822e81de` — **verified via `git ls-remote` 2026-09-11 ~12:42Z** |
| Hosted CI at tip | CI run 34587311312 **SUCCESS at `6af81c70` (docs tip, attempt 2)** — attempt 1 had one INFRA-class flake (permission-catalog pglite full-replay test hit its 5s timeout under runner load, 1/4069; identical job green at `337a3046` and on the clean rerun — a timed-out worker under load is INFRA, not a verdict). Code-identical green before it: CI run 34584434977 **SUCCESS** at `337a3046` (build + heavy-validation: vitest 4069, RLS 84/84, contract gates, production build) · Browser Readiness run 34585751072 **SUCCESS** (3/3 shards; desktop 172/172 incl. the three panel-journey specs) — not re-dispatched over docs/CI-infra-only deltas (evidence continuity over identical product code) · **NEW NOW-15: supabase-production-migrations local-preflight run 34600286733 SUCCESS at `ce0fbb33` (first green ever, 1/1173) — artifact `production-local-preflight-34600286733`** |
| Previous handoff checkpoint | `75799c3fdb7de5b6a40112ee88cbb5f0f7058a77` |
| Prior verified checkpoints | `bcdf6944`, `411167f6`, `95a0a2af`, `9fac02ac`, `0d187c48`, `a0760e98`, `aac5aa14`, `50be359a`, `4da6a26d`, `354bc427` (G6), `75799c3f`, `e6e2e444`, `b11b5da3`, `e7ac2774`, `298739ad`, `274aa729`, `48037a69` |
| Tree state | **clean** — 0 modified, no mode changes |
| All gates (fresh NOW-8 locally; NOW-14 re-proved everything HOSTED at tip `337a3046`) | **HOSTED: CI run 34584434977 SUCCESS — typecheck + test-typecheck + a11y + vitest 4069/4069 + lint + architecture + migration↔types parity + frontend↔db contract + runtime-contract 51/51 + RLS 84/84 + production build + heavy-validation (db0:gate, docs 119 files, financials)** · **HOSTED: Browser Readiness run 34585751072 SUCCESS — 3/3 shards, desktop 172/172 incl. all three panel-journey specs** · local baseline stands: entity-form 9/9, s09+S08 27/27, documents 38/38, 20-shard 559/4066 (now superseded by hosted 4069 green), replay 100/100, business-rules v2.0.0 382a0b8c unchanged |
| Push status | **PUSHED & VERIFIED — remote == local at every step** (`a99e4295` → `2a40f6e5` → `53d913e7` → `9a4c8add` → `bc3b0c4c` → `337a3046`, each verified via `git ls-remote`). PAT conversation-scoped: used inline per command, never written to any file or `.git/config`. Hosted runs at tip: CI 34584434977 SUCCESS, Browser Readiness 34585751072 SUCCESS. |

**Reconstruction is NOT declared complete.** **Latest measurement: 4066 vitest tests / 0 failures / 0 INFRA at `035db0e2` (local; NOW-9 `6a66f692`, NOW-10 `84e258cd`+`76a461c8` docs-only and NOW-11 `ec4654bc`+NOW-12 `d6713ec0` e2e-only over identical src) + playwright 9/9 at `d6713ec0`.** §G items remain: G1 BLOCKED credentials, G2 BLOCKED by G1, **G3 — PROVEN LOCALLY (strategy + C1–C8 verdicts at `035db0e2`; double-submit class closed with 0 ungated surfaces at `6a66f692`; one client defect found, fixed, locked; NOW-12 added a browser-proven server-side stale-read refusal with zero state change); hosted checks BLOCKED by G1**, G4 runtime NOT YET PROVEN, **G5 — all five UI-absent RPCs surfaced, every enumerated S09 source type regression-proven, the owner document surface proven truthful, the S08 review surface proven (two defects fixed: `342b18ca` document status, `bb45a0d0` hand-rolled review reads), and ALL FIVE G5/G6 panels now browser-proven locally (S09 incl. reversal + cutover at `ec4654bc`; offset + payout in owner-expense-source.spec.ts; recovery + fail-closed refusal at `d6713ec0`) — but all work is ON the remote (verified `337a3046`, remote==local) with hosted CI **SUCCESS** (run 34584434977) and the hosted browser matrix **SUCCESS** (run 34585751072, desktop 172/172 incl. all three panel-journey specs — the five-panel browser coverage is now hosted-proven on hermetic fixture data); the sanctioned staging proof needs a staging deployment at the exact SHA, and non-enumerated source-type lineage awaits a governance decision**, G7 unknowable.

**Next when resumed:** (1) ~~push + hosted CI~~ DONE — remote==local `ce0fbb33`; CI + browser matrix FULL GREEN (runs 34587311312 / 34585751072); G4 local-preflight pipeline FIXED & green (run 34600286733); G4 production-inspect resume trigger: operator adds `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` secrets and approves the `production` environment, then dispatch action=production-inspect with the reviewed main SHA; (2) operator-side triggers, in order: **staging deployment at the branch tip** → dispatch `hosted-staging-proof.yml` (sanctioned G1 hosted E2E: production-readonly auth lifecycle + storage isolation); **`SUPABASE_DB_URL` read-only secret** → `supabase-live-readiness` + migration-ledger parity (= fresh G6 measurement); (3) governance decision on non-enumerated source types (approved source required — do not invent); (4) G4 production-migration run needs owner inputs (reviewed SHA + production-inspect run + backup reference + rollback plan + Production environment approval) — never fabricate them; (5) G2/G3-hosted soaks need the deployed runtime from (2). Do NOT relax `scripts/assert-release-blocker-env.mjs` (policy lock) to force the staging suite path — it is deliberately dead for `E2E_ENVIRONMENT_KIND=staging`. If the PAT expired: park, do not fabricate.

---

## L. AUTONOMOUS LOOP EXECUTION DISCIPLINE (new, mandatory)

After every meaningful change:

```
inspect → reproduce/verify → implement/correct → test → audit diff → commit → push → verify remote SHA (git ls-remote) → verify local HEAD → verify working tree → update HANDOFF.md → set next NOW → start immediately
```

- Never accumulate large local batch before checkpointing.
- Never leave completed milestone only in sandbox.
- Never fabricate credentials, evidence, test results, production behavior.
- If task BLOCKED due to credentials/production-only access, record reason clearly in HANDOFF §BLOCKED, do not fabricate, do not wait, move to first unblocked NEXT.
- HANDOFF.md is continuous memory between sessions. Always commit and push it with the work it describes.
- Do not ask user to repeat info already in HANDOFF.md. Do not use ask-user tool. Proceed autonomously.
- Do not declare Definition of Done prematurely. DoD is not "tests green" — it is coherent behavior, trustworthy financial calculations, protected historical records, correct permissions/isolation, valid routes/workflows, no duplicate implementations, production/repo aligned, migrations safe, critical UI across breakpoints, authenticated workflows actually exercised where possible, known risks resolved or explicitly documented, final verification provides sufficient evidence for release.

