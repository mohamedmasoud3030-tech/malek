# MALEK — Deletion Proposal (Proposals Only — Nothing Deleted)

> **Deliverable of the documentation consolidation (2026-08-07).** This document *proposes* what may be deleted, archived, folded, or repaired. **No file was deleted or modified by the consolidation** except adding the new `docs/source-of-truth/` folder. Every proposal lists: reason, what preserves the information, and required reference updates. Tiers: **D-1** archive/evidence policy · **D-2** MALIK-era brand docs · **D-3** superseded root/working docs · **D-4** stage-status reconciliation (update, not delete) · **D-5** reference repair (update, not delete) · **D-6** duplicate fold. Disposition labels: `DELETE-SAFE` (content fully preserved in canonical docs AND git history) / `KEEP-POLICY` (owner decides retention) / `UPDATE` / `FOLD`.

---

## Tier 0 — NEVER delete (protected)

- `docs/GOVERNANCE.md`, `docs/GOVERNANCE_LOG.md` (CI-protected by execution-plan guard; log needs backfill OD-14 — that is repair, never deletion).
- `docs/decisions/*` (all ADRs, including superseded 0004 — annotate per OD-01, keep history).
- `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` (constitution, SHA-guarded).
- `governance/*.json` + `*.sha256` (locked plan, decision register).
- `docs/business/BUSINESS_RULES_CHANGELOG.md` (rule-change audit trail).
- `supabase/migrations/**` & `supabase/rollback/**` (schema history; repo-only files handled by OD-15, never silent deletion).
- `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`, `10_STAGE_REVIEW_LEDGER_AR.md`, `10_STAGE_STATUS_AR.md` (working ledgers — reconcile per D-4, never delete).
- `docs/execution/S02_LIVE_DRIFT_AUDIT_20260807.md`, `docs/accounting/S03_T01_GL_GAP_AUDIT.md`, `docs/s08/FINAL_REPORT.md` (load-bearing current-truth audits).
- `docs/FEATURE_GAP_REGISTER.md` (living register until all items close).
- Everything in `docs/source-of-truth/`.

## D-2 — MALIK-era brand documents (brand conflict C-01 cleanup; needs OD-06 blessing)

| File | Disposition | Reason / Preservation |
|---|---|---|
| `AUDIT_INVENTORY.md` | `DELETE-SAFE` | 2026-07-28 MALIK-era brand surface audit; superseded by ADR 0011 + asset contract; conclusions recorded in `08_Brand_Design.md` §2 chronology; full text in git history |
| `FINAL_DELIVERY.md` | `DELETE-SAFE` | Same audit's delivery note; same preservation path |
| `rentrix-app/public/malik-mark.svg` *(non-doc, listed for completeness)* | owner decision with OD-06 | unreferenced residue; brand tests protect against re-use; code-file removal is OUTSIDE this documentation-only work |

Reference updates if deleted: root `README.md`/`AGENTS.md`/`TESTING.md` brand lines updated to MALEK (D-5).

## D-3 — Superseded root & working docs (historical, content absorbed or expired)

| File | Disposition | Reason / Preservation |
|---|---|---|
| `MIGRATION_AUDIT.md` | `DELETE-SAFE` | 2026-07-22 multi-tenant table audit; work shipped (P0 #1276); expanded version lives in `docs/MULTI_TENANT_ARCHITECTURE.md`; summary in `06_Architecture.md` §6 |
| `PENDING_MIGRATION_BLOCKER_FIXES_ASSESSMENT_20260712.md` | `DELETE-SAFE` | one-time fix assessment; fixes merged; lesson (text/uuid discipline) captured in `06_Architecture.md` |
| `PHASE_1_TEST_PLAN.md` | `DELETE-SAFE` | executed 2026-07-13 plan; results superseded by current suites |
| `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` | `DELETE-SAFE` | Phase-5 gate list; all 7 gates either implemented or re-decided via ADR 0001/0011; mapping preserved in `04_Accounting.md` + `09_Feature_Catalog.md` |
| `docs/PHASE_0_SETTINGS_AUTH_AUDIT.md` | `DELETE-SAFE` | 2026-07-05 point-in-time audit; settings now documented in `06_Architecture.md`/`09_Feature_Catalog.md` A5 |
| `docs/PHASE_MINUS_1_SHARED_COMPONENTS_AUDIT.md` | `DELETE-SAFE` | pre-Wave-3 component audit; current truth = wave-3 inventory + `07_UX_Bible.md` §10 |
| `docs/PRODUCTION_HARDENING_AUDIT_20260711.md` | `KEEP-POLICY` | security hardening record; recommend KEEP as security history (or delete under D-1 policy with git preservation) |
| `docs/audits/TARGET_PRODUCT_ARCHITECTURE_20260724.md` | `DELETE-SAFE` | vision doc superseded by 0009/0010 + Stage-3 reality; COA numbering conflict C-04 resolved by code (OD-09); pointer kept in `06_Architecture.md` |
| `docs/audits/2026-07-07-workflow-audit-ar.md` | `DELETE-SAFE` | source of FGR-008…013 — those items now live in `FEATURE_GAP_REGISTER.md` + `10_Roadmap.md` Phase C; ensure register rows remain before deleting |
| `supabase/migrations/rls_per_table/01_table_order.md` | `DELETE-SAFE` | rollout-order note for completed RLS phase; current truth = migrations + `06_Architecture.md` §7 |

## D-1 — Archive & evidence retention (`KEEP-POLICY` — owner policy per OD-16; default recommendation: keep a curated subset, delete listed `DELETE-SAFE` after grace period)

`DELETE-SAFE` (snapshots whose live conclusions are recorded in canonical docs):
- `archive/CURRENT_STATE_2026-07-19.md`, `archive/PROJECT_STATUS_2026-07-23.md` (superseded by APP_STATUS → now by `11_Current_Status.md`)
- `archive/RELEASE_BLOCKER_GATE_2026-07-15.md`, `archive/RELEASE_BLOCKERS.md` (gate lives as workflow)
- `archive/INTEGRATED_TODO_LIST.md`, `archive/MODERN_FORMS_AND_PDF_TODO_LIST.md` (all items closed)
- `archive/ui-2026-07-11-phase/*` (4 files: PHASE_0_UX_FOUNDATION_EVIDENCE, UI_UX_RELEASE_READINESS_PLAN, UX_REFACTOR_DELIVERY, UX_RELEASE_CANDIDATE_POLISH)
- `ui-ux/PHASE3_FULL_SCREEN_POLISH_EVIDENCE.md`, `ui-ux/PR1_FOUNDATION_EVIDENCE.md`, `ui-ux/PR1_VISUAL_EVIDENCE.md` (PR evidence; contracts absorbed in `07_UX_Bible.md`)
- `evidence/p0/{inventory,rpc-security-matrix,fn-coverage}.md`, `evidence/p0/cause/env-parity.md`, `evidence/p1/approve-failure-classification.md`
- `evidence/preflight/{ci_hardening_pr_summary,migration_evidence_diff_diagnostic_fixture,production_access_backup_preflight_summary,production_live_reconciliation_20260721,qa_residue_inventory_20260721,migration_evidence_no_credentials.txt}` (C-03 EGP context preserved in `13_Conflict_Report.md`)
- `docs/audits/{P0_MULTI_TENANT_VERIFICATION_20260723,P1_OWNER_SETTLEMENT_INTEGRITY_20260723,PHASE2_FINANCIAL_INTEGRITY_REPORT_20260724,PHASE3A1A_CANONICAL_ACCOUNT_RESOLUTION,PHASE3A1B_INVOICE_PAYMENT_RECEIPT_VOID,PHASE3A1C_OWNER_SETTLEMENT_ACCOUNT_RESOLUTION,RENTRIX_COMPREHENSIVE_AUDIT_20260725,RENTRIX_FULL_PRODUCT_AUDIT_20260724,SECURITY_DEFINER_COMPANY_ISOLATION_AUDIT_AR}.md` — *alternative: keep as completed-phase proof trail; deletion only via OD-16 policy since ADRs 0003/0005/0006 cite them*
- `ui-ux/RENTRIX_FULL_PRODUCT_AUDIT.md` (pre-redesign), `handover/FINAL_DELIVERY_AUDIT.md` (2026-07-15 NO-GO, conditions later closed), `tickets/owner-settlements-fgr-005.md` (FGR-005 closed in register)
- `archive/ui-2026-07-11-phase/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` — `KEEP-POLICY` while CONTEXT_MAP references it; after D-5 de-reference → `DELETE-SAFE`

`KEEP` (recommended regardless of policy): `docs/archive/README.md` (policy statement itself), `evidence/s08/*` (tied to OD-11 dispute — do not delete while S08 crediting is open), `docs/RELEASE_EVIDENCE_LEDGER.md` (release evidence chain), completed-phase audit records if owner prefers maximal proof retention.

## D-4 — Stage-status reconciliation (UPDATE — never delete)

- `docs/execution/10_STAGE_STATUS_AR.md`: refresh statuses to the git-verified table in `10_Roadmap.md` Phase B (S02/S06/S07/S08 merged-pending-review; S03 engine-not-wired; S08 contested OD-11).
- Agent/reviewer ledgers: mark completed tasks with PR links per protocol (OD-19 decides who/how).
- `governance/10-stage-master-plan.json` statuses: bump only through the locked change-control path (owner approval + guard hash update).

## D-5 — Reference repair (UPDATE — never delete)

| File | Repair |
|---|---|
| `docs/ENGINEERING_GOVERNANCE.md` | repo name `rentrixxx`→`malik`; types path `database.types.ts`→`rentrix-app/src/types/database.ts`; replace archived `docs/CURRENT_STATE.md` refs (§12.4, Appendix A) with `docs/source-of-truth/11_Current_Status.md`; add post-constitution governance chapter pointer |
| `docs/agent-context/CONTEXT_MAP.md` | remove/repoint `CURRENT_STATE.md` rows; repoint archive UX-audit row to `07_UX_Bible.md` |
| `docs/agent-context/DOMAIN.md` | fix deposits claim (C-09/OD-10); update "Product decision required" items now decided by ADR 0001/0011 |
| `.agents/commands/close-feature.md` | replace "Updates CURRENT_STATE" with current status doc |
| Root `README.md`, `AGENTS.md`, `docs/TESTING.md` | brand line MALIK→MALEK (with ADR 0011 compatibility note); add `docs/source-of-truth/` reading-order pointer |
| `docs/README.md` | add folders: accounting, execution, s08, security, business, source-of-truth; fix title brand line |
| `supabase/migrations/README.md` | counts 110/164→189 + drift-audit pointer (until drift resolved) |
| `docs/APP_STATUS.md`, `docs/NEXT.md` | banner: "status snapshot as of <date>; current truth → source-of-truth/11_Current_Status.md" |

## D-6 — Duplicate fold candidate

| File | Disposition | Reason |
|---|---|---|
| `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md` | `FOLD` (owner confirm) | DUPLICATED: gates C1–C11 = ADR 0011 D01–D18 in substance; merged into `04_Accounting.md`. Recommend folding into a short pointer note to ADR 0011 rather than deletion (Arabic readers' convenience), or archive per OD-16. |

## Bundle summary

- `DELETE-SAFE` candidates: **38 files** — D-2: 2 (AUDIT_INVENTORY, FINAL_DELIVERY) · D-3: 9 (MIGRATION_AUDIT, PENDING_MIGRATION_BLOCKER, PHASE_1_TEST_PLAN, PRODUCT_ACCOUNTING_DECISION_GATES, PHASE_0_SETTINGS_AUTH_AUDIT, PHASE_MINUS_1, TARGET_PRODUCT_ARCHITECTURE, workflow-audit-ar, rls table_order) · archive: 10 · ui-ux evidence/audit: 4 · evidence p0: 4 · evidence p1: 1 · evidence preflight: 6 · handover NO-GO audit: 1 · tickets: 1. Plus **9 conditional** completed-phase audit records (P0/P1/PHASE2/3A-1A/3A-1B/3A-1C/COMPREHENSIVE/FULL_PRODUCT/SECURITY_DEFINER) that become delete-safe only under an OD-16 maximal-cleanup policy since ADRs cite them.
- `KEEP-POLICY` (OD-16): archive README, s08 evidence, release evidence ledger, 9 completed-phase audit records (default: keep), UX nav audit (until de-referenced), PRODUCTION_HARDENING_AUDIT.
- `UPDATE` (D-4/D-5): 12 files. `FOLD` (D-6): 1 file. **No code, migration, or governance file is proposed for any change.**
- Execution rule for any approved deletion: one PR per tier, reference updates (D-5) in the same or preceding PR, and a final grep proving zero inbound doc references before removal.
