# Reconstruction — Definition of Done checklist & release evidence index (NOW-10)

**Branch:** `reconstruction/checkpoint-20260909` — **MERGED into `main` 2026-09-11 (fast-forward `fe2a5911..a3001df5`, CI-green at exact tip run 34608542846; main == branch)** · **Date:** 2026-09-11 · **Local HEAD at authoring:** `269ed0b3` (12 commits ahead of remote `bcdf6944`; push BLOCKED — no credential in sandbox — superseded: everything since pushed and merged)

Rules applied: no stage credit without evidence; blocked ≠ done; every verdict points at a commit,
test count, or log. Numbers are measured, not estimated.

## 1. §G item verdicts

| Item | Verdict | Evidence | Unblock condition (if blocked) |
|---|---|---|---|
| G1 — authenticated hosted E2E | **SUBSTANTIALLY UNBLOCKED 2026-09-11 (NOW-14)** | PAT supplied; branch pushed, remote==local `337a3046` (verified `git ls-remote` at every step). First-ever hosted CI on the branch driven to FULL GREEN after fixing four latent gate defects (`53d913e7`, `9a4c8add`, `bc3b0c4c`, `337a3046`): CI run 34584434977 SUCCESS (vitest 4069/4069, RLS 84/84, contract gates, production build, heavy-validation) + Browser Readiness run 34585751072 SUCCESS (3/3 device shards; desktop 172/172 incl. the three panel-journey specs — first hosted browser execution of the five-panel coverage, green on hermetic fixture data). | Remaining: the AUTHENTICATED hosted E2E against the deployed app — `hosted-staging-proof.yml` (production-readonly auth lifecycle + storage isolation) fail-closes until a staging deployment serves the exact dispatched SHA; the `run_staging=true` full-suite path is deliberately policy-dead (`assert-release-blocker-env.mjs` rejects kind `staging`; not relaxed) |
| G2 — intermittent bootstrap stall | **BLOCKED by G1** | Diagnosis advanced 2026-09-09 (inventory §"Intermittent bootstrap stall"); root cause NOT provable locally | Hosted runtime access |
| G3 — concurrency / Web Locks | **PROVEN LOCALLY; hosted checks BLOCKED by G1** | Strategy + C1–C8 verdicts + §5 per-surface audit: `docs/execution/G3_CONCURRENCY_VERIFICATION_STRATEGY.md` (`035db0e2`, `6a66f692`). One defect found, reproduced red-first, fixed at shared source (EntityForm double-submit `??`→`||`), locked in `entity-form.test.ts` (9/9). **0 ungated mutation surfaces remain.** | Hosted two-tab soaks C1/C3/C5/C6/C8 per the strategy doc's plan |
| G4 — runtime of newly applied migrations under real traffic | **NOT PROVEN (hosted-blocked); evidence pipeline now OPERATIONAL (NOW-15)** | Local replay: 100/100 migrations replay clean (NOW-4 evidence; 0 schema changes since). NOW-15 `ce0fbb33`: fixed `supabase-production-migrations.yml` local-preflight (0/1172 runs had EVER succeeded — the evidence step queried a local stack no step started); run 34600286733 SUCCESS at main `fe2a5911`, artifact `production-local-preflight-34600286733` (manifest + sha256 + migration-list status). Real-traffic behaviour still cannot be exercised locally | Operator adds `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` secrets + approves the `production` environment → dispatch action=production-inspect (read-only live ledger + dry-run); deploy additionally needs owner backup + rollback references |
| G5 — financial-chain reviews | **Substantially CLOSED locally; two remainders** | (1) all five UI-absent RPCs surfaced: offset/recovery/S09/cutover panels + `s09_reverse_correction` (NOW-4 `9ca483b4`); (2) every enumerated S09 source type regression-proven incl. refusals (NOW-5 `9767ef03`, suite 23/23→27/27); (3) document surface proven truthful, settlement-statement status defect fixed (NOW-6 `342b18ca`); (4) S08 review surface proven, hand-rolled-read defect fixed, fingerprint/permission/retry/isolation locked (NOW-7 `bb45a0d0`). **Remainders:** hosted browser coverage of the five panels (needs fixture seeding + G1); governance decision on non-enumerated `source_type` (needs an approved accounting/governance source — do not invent) | Fixture-backend seeding + G1; user/governance decision |
| G6 — governed historical adoption (cutover) | **CLOSED (local/replay)** | Inventory §"G6 — governed historical adoption: CLOSED"; cutover service/panel + adoption pglite tests; NOW-7 also fixed its review-source read | — |
| G7 — exploit history | **UNKNOWABLE** | No hosted audit-log access from sandbox; recorded in §BLOCKED | Hosted log access |
| Repo ↔ production parity re-measure | **MEASURED (NOW-16) — DRIFT FOUND, reconciliation is a governance decision** | First live read-only measurement 2026-09-11 against `nnggcnpcuomwfuupupwg` via the Supabase Management API (SELECT-only): live ledger 109 rows vs 100 repo files; 82 exact matches; 18 repo-only files are re-stamped versions of applied migrations (13 content-identical, 5 diverged — repo hardened variants never applied, incl. the absent `v_existing_match_id` dedupe guard); 9 ledger-only direct-production hotfixes never committed (full SQL archived). `supabase db push` is UNSAFE until the ledger is reconciled. Evidence: `docs/execution/evidence/live-parity-20260911/` (crosswalk + archived statements). Live-readiness gate now runs for real: run 34605721349 readiness SUCCESS (tables/functions/RLS all clean), parity step reports this drift by design | Owner: ledger reconciliation decision (`supabase migration repair` path per BACKUP_RESTORE_RUNBOOK.md) + `SUPABASE_DB_PASSWORD` for the sanctioned production-inspect artifact |
| Push of local work | **BLOCKED** | 12 local commits (list below); remote tip `bcdf6944` verified via `git ls-remote` 2026-09-11 04:28Z | Any valid credential → `git push origin reconstruction/checkpoint-20260909` + verify remote SHA == local HEAD |

## 2. Release evidence index — the 12 local commits awaiting push

| Commit | Summary |
|---|---|
| `9ca483b4` | G5/NOW-4: surface `s09_reverse_correction` (4th lifecycle step) + fix F13 list-envelope parser (`parseS09ListEnvelope`) |
| `61eb62ad` | docs: NOW-4 checkpoint; push BLOCKED recorded |
| `9767ef03` | G5/NOW-5: non-expense S09 coverage vs deployed invariants (invoice full chain; payment/deposit refusals; non-enumerated behaviour lock + panel disclosure) |
| `c2084123` | docs: NOW-5 checkpoint |
| `342b18ca` | G5/NOW-6: owner_statement document carries truthful settlement lifecycle status (cancelled never prints as live) |
| `faa4980a` | docs: NOW-6 checkpoint |
| `bb45a0d0` | G5/NOW-7: S08 review reads moved to deployed `s08_list_frozen_reviews` RPC + strict envelope parser; 4 real-SQL locks (evidence-leak, isolation, fingerprint-drift, permissions/retries) |
| `91f2ad71` | docs: NOW-7 checkpoint |
| `035db0e2` | G3/NOW-8: concurrency strategy doc + EntityForm double-submit trap fixed (`submitDisabled \|\| isSubmitting`), red-first reproduction locked |
| `4973dc4e` | docs: NOW-8 checkpoint |
| `6a66f692` | G3/NOW-9: double-submit guard class closed — full per-surface audit, zero gaps, zero code changes |
| `269ed0b3` | docs: NOW-9 checkpoint |

## 3. Gate matrix continuity (measured per NOW, 20-shard runner)

| Checkpoint | Sharded regression | Focused suites | Static gates |
|---|---|---|---|
| NOW-4 `9ca483b4` | 559 files / **4055** / 0 fail / 0 INFRA | s09 18/18 · replay 100/100 | typecheck ✓ · db0:gate 7/7 · guardian PASS · hygiene OK · business-rules `v2.0.0 382a0b8c…` |
| NOW-5 `9767ef03` | 559 / **4060** / 0 / 0 | s09 23/23 · inventory 13/13 · entity-form+axe 25/25 | same, business-rules unchanged |
| NOW-6 `342b18ca` | 559 / **4061** / 0 / 0 | canonical docs 38/38 · workspace 6/6 · axe+entity-form 23/23 | same, business-rules unchanged |
| NOW-7 `bb45a0d0` | 559 / **4065** / 0 / 0 | s09+S08 27/27 | same, business-rules unchanged |
| NOW-8 `035db0e2` | 559 / **4066** / 0 / 0 | entity-form 9/9 | same, business-rules unchanged |
| NOW-9 `6a66f692` | docs-only — NOW-8 matrix stands over identical src | — | — |

- **Migrations:** 100 in repo; **0 added by this entire loop** (NOW-1…NOW-9). Forward-only discipline held; no rewrite of posted history anywhere.
- **Canonical business rules:** `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` — verified unchanged at every NOW.
- **Defects found & fixed at source this loop (all regression-locked):** F13 list-envelope (NOW-4), settlement-statement status truth (NOW-6), hand-rolled S08 review reads (NOW-7), EntityForm double-submit trap (NOW-8). NOW-9: audit closed the class with zero further changes.
- **Governance findings awaiting an approved source (do not invent):** non-enumerated S09 `source_type` binds to the review only (locked behaviour, NOW-5); deployed list RPCs have no LIMIT (NOW-7 note).

## 4. DoD verdict

**Reconstruction is NOT declared complete — but it is MERGED and every agent-executable gate is green.**
Status 2026-09-11 (NOW-17): branch merged into `main` (fast-forward `fe2a5911..a3001df5`, CI-green
at the exact tip, run 34608542846). Done and evidenced since the original verdict: push + remote-SA
verification at every step; hosted CI FULL GREEN; hosted browser matrix FULL GREEN (172/172 desktop
incl. all five G5/G6 panel journeys); G4 evidence pipeline fixed and first-ever green (run
34600286733); live-readiness gate permanently unblocked (read-only role + secret) and GREEN against
the live database (run 34605721349); parity RE-MEASURED live — drift found and fully evidenced
(`docs/execution/evidence/live-parity-20260911/`: 27 ledger-only vs 18 re-stamped repo versions;
exactly one confirmed functional gap live — the 20260901000026 dedupe guard; all 26 branch-added
migrations verified already-applied and content-identical live).
What remains is owner-gated, with exact triggers in HANDOFF.md §"NOW-18": ledger reconciliation
decision before any `db push` (BACKUP_RESTORE_RUNBOOK path); `SUPABASE_DB_PASSWORD` for the
sanctioned production-inspect artifact; a Supabase project slot for the QA journey; a root-domain
staging host for G1 hosted E2E; the S09 `source_type` governance decision; and G2/G3-hosted which
need that deployed runtime.
