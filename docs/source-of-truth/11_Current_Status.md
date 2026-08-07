# MALEK — Current Status (Canonical, as of 2026-08-07)

> **Source-of-truth document.** Consolidates and supersedes: `docs/APP_STATUS.md`, `docs/NEXT.md` (status portions), `docs/RELEASE_READINESS.md`, `docs/SINGLE_OFFICE_LAUNCH.md` (status portions), `docs/execution/10_STAGE_STATUS_AR.md`, and the agent/reviewer ledgers — reconciled against git history and today's live-drift audit. Older status docs keep claims frozen to their verification dates; this page is the current truth.

---

## 1. Repository & release state

- Repo: `mohamedmasoud3030-tech/malik`; `main` HEAD = **`475d638c`** — "Wave 4A: Enterprise UX Foundation (parallel-safe, additive-only) (#1369)".
- Production: Vercel `rentrixapp.vercel.app`; last verified READY in RELEASE_READINESS (2026-07-2x era evidence, build `4c354f34` / PR #1299). More recent waves (#1352–#1369) merged since; re-verify production state before launch claims.
- Database: Supabase project `nnggcnpcuomwfuupupwg`.

## 2. Live ↔ repository migration drift (CRITICAL — audited today)

Source: `docs/execution/S02_LIVE_DRIFT_AUDIT_20260807.md` (2026-08-07).

- **26 migrations exist live-only**, applied out-of-band on 2026-08-06 (`20260806065613` … `20260806075552`) — never merged as repo files.
- **14 repo migration files were never applied live** (repo-only; deprecation/removal path needed — Open Decisions).
- `pay_commission_atomic` / `reverse_commission_atomic` were **missing live** despite code/docs claiming them; fixed via #1361.
- Stage status documents were **wrong on substance** in multiple places.
- Consequence: `supabase/migrations/` is NOT currently a faithful image of production. Any rebuild-from-migrations claim is unsafe until drift is reconciled (import live-only migrations as repo files or document them; decide fate of 14 repo-only files).
- Repo counts today: 189 files in `supabase/migrations/`, 32 in `supabase/rollback/`. Older counts in docs (164 in NEXT, 110 ledger entries in a supabase README) are **stale**.

## 3. Stage statuses — ledger vs git (drift flagged)

See `10_Roadmap.md` Phase B table. Summary: S01 COMPLETE (the only reviewer-credited stage). S02/S06/S07/S08 have merged code (#1350/#1361, #1362, #1363, `8e4908a7`) but ledgers still show 0/10 and unchecked boxes; S08's own FINAL_REPORT declares it NOT ready for independent review yet its branch merged → OD-11. Agent/Reviewer ledger checkboxes post-S01 are all unchecked → ledgers under-report merged work and over-report nothing; treat ledgers as stale until reconciled.

## 4. Governance log staleness

`docs/GOVERNANCE_LOG.md` contains only **9 entries (2026-07-06 … 2026-07-18)**. Later live mutations are unlogged: `20260725000000`, `20260728090000`, `20260729090000`, `20260730090500`, and the 26 out-of-band 2026-08-06 migrations. The execution-plan guard protects the log but nothing enforces writing to it → OD-14 (backfill + enforcement decision).

## 5. Quality gates & latest verified evidence

| Gate | Command / workflow | Latest verified evidence | Date |
|---|---|---|---|
| Unit/integration | `pnpm --filter @workspace/rentrix test` | 1161/1161 passing | 2026-07-2x (APP_STATUS) |
| Financial suite | `pnpm --filter @workspace/rentrix run test:financials` | 276/276 | 2026-07-2x |
| Browser readiness | `browser-readiness` (Playwright) | 243 pass / 204 intentional skips / 0 fail (desktop+tablet+mobile) | 2026-07-2x (PR #1298 runs 30224710110/30224710108) |
| Release blocker DB | `release-blocker-database` (disposable Supabase + pgTAP) | green; invoice→payment→receipt→VOID lifecycle proven | 2026-07-2x |
| RLS | policy count | 98 policies | 2026-07-2x |
| Dependencies | `pnpm audit` | 0 vulnerabilities | 2026-07-2x |
| Stage gates (S01) | CI on #1345 | green | 2026-08-0x |
| Drift audit | live read-only inspection | 26 live-only / 14 repo-only mismatch | 2026-08-07 |

⚠️ All 2026-07 evidence predates the merged S02/S06/S07/S08/Wave-3/Wave-4A work; re-run suites to re-establish current numbers before launch.

## 6. Production data posture

Production company contains **test data only** (2026-07-27 verified): 1 company; 5 contracts; 40 units; 12 properties/owners/agreements; 4 invoices; 4 receipts; 2 payments; 30+ tables empty. First real operations require supervised first-run (settlement, deposit, commission) and launch-contract conditions (§8).

## 7. Open operational items (operational, not business decisions)

1. Enable Supabase Auth **Leaked Password Protection** (blocking real-account handover).
2. Rotate exposed **demo account password**; terminate old sessions.
3. **224 performance advisories**: 79 `auth_rls_initplan`, 20 `multiple_permissive_policies`, others.
4. `function_search_path_mutable` on `audit_journal_entry_insert` — PR #1297 (Draft).
5. Sonar: duplicate `sonar.exclusions` config — cleanup decision.
6. Google Fonts (Cairo) external dependency — self-host question (see Open Decisions B).
7. **250+ stale branches** — bulk deletion needs owner decision.
8. pgTAP coverage expansion for VOID/deposits/settlements.
9. Archive/evidence retention policy (D-1 in Deletion Proposal).
10. Backup + rollback/mitigation plan reconfirmation before next migration (launch checklist item).

## 8. Launch posture (from SINGLE_OFFICE_LAUNCH, 2026-07-27)

"Code, deployment, browser gates, and financial gates permit starting a single-office pilot; handing over real accounts is blocked only by Leaked Password Protection and the exposed demo password." Launch contract still shows unchecked boxes (§7 items 1–2, backup reconfirmation). Post-2026-07-27 merges (S02 drift!) mean the posture must be **re-verified**, not assumed — the drift audit postdates the launch assessment.

## 9. Doc-vs-reality matrix (status per domain)

| Domain | Canonical claim | Still matches product? |
|---|---|---|
| Business rules (D01–D18) | Constitution + ADR 0011 LOCKED | **Matches as decisions**; code not fully implementing yet (S04–S07) — expected |
| Accounting doctrine | `04_Accounting.md` | Matches decisions; implementation partial (GL dormant) — needs work, not doc update |
| Architecture | `06_Architecture.md` | **Matches** (verified vs code 2026-08-07) |
| UX | `07_UX_Bible.md` (V2) | Matches governing contract; rollout partial by design |
| Brand | `08_Brand_Design.md` (MALEK) | Matches code; MALIK-era docs **completely outdated** (D-2) |
| Stage ledgers/status | execution/* | **Needs update** (merged work uncredited; S08 contradiction) |
| Migration/lived state | §2 here | Source docs accurate for audit day; repo folder **not** faithful to live |
| Launch/runbooks | SINGLE_OFFICE_LAUNCH, SEEDED_STAGING_READINESS_RUNBOOK | **Mostly valid**, verification dated; re-run before use |
| Root historical docs (MIGRATION_AUDIT, PENDING_MIGRATION_BLOCKER…, PHASE_1_TEST_PLAN, FINAL_DELIVERY, AUDIT_INVENTORY) | historical | **Completely outdated** (deletion proposal) |
| ENGINEERING_GOVERNANCE | process rules | **Active**, with stale references (repo name, types path, archived CURRENT_STATE) needing repair |
| APP_STATUS / NEXT | status | **Needs update** (superseded by this doc; keep as dated snapshots) |
| supabase README ledger note (110) | counts | **Outdated** (189 files today) |
| s08 docs | analysis | **Partially valid**: runbook/schema-mapping useful; FINAL_REPORT contradicted by merge (OD-11); EGP default claims **outdated/wrong** (C-03) |
