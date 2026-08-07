# MALEK — Documentation Consolidation: Executive Summary

**Date:** 2026-08-07 · **Branch:** `docs/source-of-truth-consolidation` · **Scope:** documentation only — **zero code, migration, or governance-file changes; zero deletions.**

---

## What was done

Every documentation file in the repository (**166 docs, ~24,000 lines, ~1.37 MB**) was read, classified, and consolidated into a canonical **source-of-truth** system under `docs/source-of-truth/`. Duplicates were merged by reference, conflicts recorded (not resolved), every open/TODO/"later" item preserved, and a deletion proposal prepared for owner approval. A new developer should now be able to learn the product from this folder alone.

## The canonical system (this folder)

| File | Content |
|---|---|
| `00_Executive_Summary.md` | You are here |
| `01_Documentation_Inventory.md` | All 166 docs: purpose, category (ACTIVE 78 / PARTIALLY VALID 31 / DUPLICATED 1 / OBSOLETE 49 [+grouped annexes]), duplicates, conflicts, merge-into, owner-decision flags |
| `02_Product_Vision.md` | What MALEK is, users, jobs, operating models, principles, non-goals |
| `03_Business_Rules.md` | D01–D18 + ADR 0001/0003/0005 doctrine restated (pointers to LOCKED Arabic sources) |
| `04_Accounting.md` | Money model, invariants, GL platform, COA, settlement math, 30-event posting spec |
| `05_Legal_Workflows.md` | Contract/invoice/payment/owner/maintenance/deposit workflows; legal evidence list |
| `06_Architecture.md` | Repo, frontend, Guard v2, multi-tenancy, security, DB, atomic RPCs, CI/CD |
| `07_UX_Bible.md` | IA, responsive contract, states, interaction safety, typography, dashboards, print |
| `08_Brand_Design.md` | MALEK identity, asset contract, naming chronology, V2 rollout log |
| `09_Feature_Catalog.md` | **Every feature** (60+ rows): purpose, verified status, every doc where it appeared |
| `10_Roadmap.md` | Pilot (Phase A), 10-stage plan with git-verified truth (Phase B), decided-unimplemented streams (C), backlog & rejected ideas (D) |
| `11_Current_Status.md` | Where the product actually is today (supersedes APP_STATUS/NEXT status claims) |
| `12_Open_Decisions.md` | 19 owner decisions (OD-01…OD-19) + 20-item missing-decision inventory |
| `13_Conflict_Report.md` | 9 substantive conflicts (C-01…C-09) + 5 documentation-integrity clusters |
| `14_Deletion_Proposal.md` | Tiered D-1…D-6 proposal; ~35 delete-safe candidates; nothing deleted |
| `README.md` | Index + maintenance rule |

## Top findings (owner attention)

1. **Live↔repo database drift (critical, audited today):** 26 migrations live-only, 14 repo-only; commission RPCs were missing live (fixed #1361). Repo is not a faithful image of production right now. → `11_Current_Status.md` §2, OD-15.
2. **Stage ledgers under-report reality:** S02/S06/S07/S08 code merged but ledgers show 0/10; S08 merged *against its own FINAL_REPORT* that says "NOT ready for independent review." → OD-11, OD-19.
3. **GOVERNANCE_LOG went stale 2026-07-18:** later mutations (incl. all 26 out-of-band migrations) unlogged despite a CI guard on the file. → OD-14.
4. **GL engine is dormant:** the Stage-3 double-entry core is shipped but no business RPC uses it; live postings still flow through the legacy-compat view with `accounting_period_id=NULL`. → `04_Accounting.md`, `10_Roadmap.md` Phase C.
5. **Brand split MALIK vs MALEK (C-01):** code + ADR 0011 = MALEK; several entry docs still say MALIK; repo/paths stay legacy by design. → OD-06.
6. **Four decision-vs-code conflicts need owner rulings:** void-reversal account source (C-08/OD-02), role model (C-05/OD-04), currency heritage EGP claims (C-03/OD-05), COA numbering canon confirmation (C-04/OD-09).
7. **Pilot is nearly unblocked:** single-office pilot posture was green 2026-07-27 except two security actions (Leaked Password Protection, demo-password rotation) — but post-dated merges + drift require re-verification, not assumption. → `11_Current_Status.md` §8.
8. **Locked governance is real and healthy:** constitution (SHA-guarded), ADR 0011 (D01–D18 FINAL), decision register, 10-stage plan, CI guards — the consolidation defers to it everywhere.
9. **Feature truth table exists now:** 60+ features classified Implemented/Partial/Not implemented/Removed with doc provenance (`09_Feature_Catalog.md`) — e.g. deposits ARE implemented (contrary to DOMAIN.md), daily contracts/late fees/credit notes/portal/multi-currency are NOT.
10. **Documentation mass reduction opportunity:** 49 of 166 docs are OBSOLETE; 38 are delete-safe with full preservation elsewhere (+9 conditional audit records); executing D-1…D-6 leaves each fact in exactly one place.

## Reading order for a new developer

`02_Product_Vision` → `03_Business_Rules` → `05_Legal_Workflows` → `04_Accounting` → `06_Architecture` → `07_UX_Bible` → `08_Brand_Design` → `09_Feature_Catalog` → `10_Roadmap` → `11_Current_Status` → (when asked to change something) `12_Open_Decisions` + `13_Conflict_Report` first.

## Immediate actions (nothing here happened automatically)

1. Owner reviews `12_Open_Decisions.md` — OD-11 (S08), OD-14 (log), OD-15 (repo-only migrations) are time-critical.
2. Approve/adjust `14_Deletion_Proposal.md` per tier; execution follows the bundle rule (reference updates first, one PR per tier).
3. Re-verify production posture after drift reconciliation; then run the two security actions and launch the single-office pilot.
4. Backfill GOVERNANCE_LOG from live ledger + git history (OD-14).

## Guarantees

- No business content was invented: every canonical statement traces to an identified source doc or verified code/git fact.
- No conflict was resolved: both sides preserved with evidence and consequences.
- No information was silently discarded: superseded content is either merged (referenced in "Appears in"/"Consolidated from" lines), escalated (Open Decisions), or proposed for deletion with preservation notes.
- Locked sources (constitution, ADRs, governance JSON, GOVERNANCE_LOG) were never modified.
