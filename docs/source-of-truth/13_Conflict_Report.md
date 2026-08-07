# MALEK — Conflict Report (Canonical)

> **Deliverable of the documentation consolidation (2026-08-07).** Every documentation conflict discovered across 166 files. **No conflict was resolved by this consolidation** — both sides are recorded with evidence, consequences, and a status: `RESOLVED-BY-LATER-DECISION` (a newer LOCKED decision clearly supersedes; only doc annotation needed), `RESOLVED-BY-CODE` (code truth verified; docs stale), or `NEEDS-OWNER` (genuinely open → linked OD in `12_Open_Decisions.md`).

---

## C-01 — Visible product name: MALIK vs MALEK

| Side | Claim | Evidence |
|---|---|---|
| A (stale) | Visible English name is **MALIK** | Root `README.md`, `AGENTS.md`, `TESTING.md`, `AUDIT_INVENTORY.md`, `FINAL_DELIVERY.md`; brand asset `malik-mark.svg` |
| B (current) | Visible English name is **MALEK** | ADR 0011 (2026-08-04), `docs/brand/MALEK_ASSET_CONTRACT.md`, code-verified: `index.html` title "MALEK", PWA manifest "MALEK", assets `malek-mark.svg`/`malek-lockup.svg`/`malek-maskable.svg`; `src` reference counts 165 malek vs 76 malik (technical identifiers) |

- **Chronology:** Rentrix → MALIK → MALEK (see `08_Brand_Design.md` §2).
- **Consequences:** new contributors read stale entry docs and use the wrong visible name; tests exist preventing code regression but not doc regression.
- **Status:** `RESOLVED-BY-LATER-DECISION` (ADR 0011 governs; compatibility boundary freezes technical identifiers). Confirmation of the doc-reconciliation plan = **OD-06**. Residue file `public/malik-mark.svg` flagged for deletion proposal D-2.
- **Affected docs:** README, AGENTS, TESTING, docs/README title line, AUDIT_INVENTORY, FINAL_DELIVERY, agent-context brand mentions.

## C-02 — Fixed-monthly fee proration default: FULL_MONTH vs DAILY accrual

| Side | Claim | Evidence |
|---|---|---|
| A (older) | FULL_MONTH default; DAILY_PRORATED extension | `docs/decisions/0004-proration-and-billing-basis.md` (2026-07-24) |
| B (later, LOCKED) | RATE fee on collection; FIXED_MONTHLY accrues **daily**; "no FULL_MONTH default after this decision" | ADR 0011-D02 + constitution + `final-decision-register.json` |

- **Consequences:** settlement/commission math differs materially across a mid-month boundary; picking the stale doc breaks parity with server implementation.
- **Status:** `RESOLVED-BY-LATER-DECISION`; formal supersession banner on ADR 0004 needs owner blessing = **OD-01**.
- **Affected docs:** decisions/0004 ↔ decisions/0011, ACCOUNTING_DECISION_GATES_AR §C4, `04_Accounting.md`.

## C-03 — Currency: OMR-only vs EGP heritage

| Side | Claim | Evidence |
|---|---|---|
| A (canonical) | OMR, 3 decimal places, 0.001 server rounding; company currency column exists | Constitution + ADR 0011; Stage-3 COA currency/dp columns; OMR contract tests |
| B (heritage/stale) | Project called "RENTRIX EGY (live)"; s08 schema-mapping claims "Default EGP, 2 dp" and "journal_lines EGP 2 dp" | `evidence/preflight/production_live_reconciliation_20260721.md`; `docs/s08/schema-mapping.md` (its own runbook forbids assuming EGP) |

- **Consequences:** wrong currency assumption corrupts any S08 historical analysis and future reporting; multi-currency design question stays foggy.
- **Status:** `NEEDS-OWNER` = **OD-05** (confirm OMR-only pilot; decide EGP story; fix/disclaim s08 mapping doc).

## C-04 — Chart-of-accounts numbering: vision vs implemented

| Side | Claim | Evidence |
|---|---|---|
| A (vision, obsolete) | 2201 / 2301 / 4101 / 4201 for deposits/settlements/income | `docs/audits/TARGET_PRODUCT_ARCHITECTURE_20260724.md` |
| B (implemented) | 2000 settlement payouts, 2200 tenant deposits payable, 6100 operating expenses, 4000 revenue, 18 accounts | Stage-3 migrations + `docs/NEXT.md` Stage-3 section + ARCHITECTURE §8.2 |

- **Consequences:** report mappings and S08 concept-mapping could target wrong account numbers.
- **Status:** `RESOLVED-BY-CODE` (implementation canon); owner confirmation to mark vision doc historical = **OD-09**.

## C-05 — Roles: 3 (code) vs 6 (canonical scope)

| Side | Claim | Evidence |
|---|---|---|
| A (code truth) | ADMIN / MANAGER / USER (+ membership roles OWNER/ADMIN/MEMBER/VIEWER) | `SECURITY_MODEL.md`, `features/auth/permissions.ts`, MULTI_TENANT_ARCHITECTURE |
| B (canonical scope) | Six business roles incl. Accountant, Viewer, Owner portal, Tenant portal | ADR 0003 `0003-financial-security-ux-reporting-and-reconciliation-scope.md` |

- **Consequences:** permission matrix, RLS write policies, FGR-014 denial-matrix coverage, and portal planning all hinge on which model is authoritative now.
- **Status:** `NEEDS-OWNER` = **OD-04** (phased expansion or scope revision).

## C-06 — Numerals: Eastern Arabic vs Latin

| Side | Claim | Evidence |
|---|---|---|
| A (stale spec) | Display Eastern Arabic numerals (١٬٢٥٠٫٥٠٠) | `docs/ui-ux/RENTRIX_FINANCIAL_PRESENTATION.md` |
| B (code truth) | Latin numerals forced via `-u-nu-latn` | `rentrix-app/src/lib/formatters.ts` (since PR #1298); browser evidence |

- **Consequences:** screenshots/specs/tests diverge; print documents follow code.
- **Status:** `RESOLVED-BY-CODE` pending owner confirmation = **OD-07** (then fix/archive the stale spec).

## C-07 — Contract lifecycle: implemented 4-state vs canonical 8(+2)-state

| Side | Claim | Evidence |
|---|---|---|
| A (implemented) | draft / active / terminated / soft-deleted via atomic lifecycle RPCs | `DATABASE_ARCHITECTURE.md`, FGR-004 (closed), contract RPC names |
| B (canonical) | 8 lifecycle states + 2 special, with approval flow, signatures, schedule freeze | Constitution (S04 section), execution 10-stage docs |

- **Consequences:** NOT a fork — an acknowledged implementation gap (S04 work). Risk is readers assuming canonical states exist today.
- **Status:** `RESOLVED-BY-LATER-DECISION` as a target; implementation tracked in roadmap (S04). No owner question beyond scheduling.

## C-08 — VOID reversal account source: clone originals vs client-supplied entries

| Side | Claim | Evidence |
|---|---|---|
| A (decided doctrine) | Void clones the original entry's account IDs; no client account IDs accepted | ADR 0005 `0005-account-resolution-payment-receipt-void.md`; audits/PHASE3A1B |
| B (live finding) | Live `void_receipt_atomic` accepts client-supplied `p_reverse_entries` | `docs/accounting/S03_T01_GL_GAP_AUDIT.md` (2026-08-06) |

- **Consequences:** trust-model regression potential; financial-write trust model assumes server-authoritative accounts.
- **Status:** `NEEDS-OWNER` = **OD-02** (undocumented decision vs drift bug).

## C-09 — Deposits modeled or not

| Side | Claim | Evidence |
|---|---|---|
| A (stale agent doc) | "Deposits not modeled / no deposit handling" | `docs/agent-context/DOMAIN.md` |
| B (implemented) | tenant_deposits + 2200 liability + create/deduct/refund atomic RPCs; FGR-012 core closed | ARCHITECTURE §8.2, FEATURE_GAP_REGISTER, NEXT Phase-3A-1A |

- **Consequences:** agents may build a parallel/destructive deposit model or avoid fixing deposit bugs.
- **Status:** `RESOLVED-BY-CODE`; doc fix approved-path = **OD-10** (with D-5 reference repair).

---

## Dangling reference conflicts (documentation integrity)

| Ref | Problem | Disposition |
|---|---|---|
| `docs/CURRENT_STATE.md` | Archived (`archive/…moved to APP_STATUS`), still referenced by ENGINEERING_GOVERNANCE §12.4 + Appendix A, `agent-context/CONTEXT_MAP.md` rows, `.agents/commands/close-feature.md` ("Updates CURRENT_STATE") | D-5 reference repair; OD covers policy-side confirm |
| Repo name `rentrixxx` | ENGINEERING_GOVERNANCE predates rename to `malik` | D-5 repair |
| Types path `database.types.ts` | Actual: `rentrix-app/src/types/database.ts` | D-5 repair |
| Migration counts (110 / 164) | Actual: 189 files; drift audit | D-3/D-5 refresh of `supabase/migrations/README.md`, NEXT |
| s08 FINAL_REPORT vs merge | see **OD-11** | owner decision |

**Total conflicts: 9 substantive (C-01…C-09) + 5 documentation-integrity clusters. Resolved-by-later-decision: 3 (C-01, C-02, C-07); resolved-by-code: 3 (C-04, C-06, C-09 — pending owner confirmation of doc fixes); needs-owner ruling: 3 (C-03→OD-05, C-05→OD-04, C-08→OD-02); confirmation-only items: OD-01, OD-06, OD-07, OD-09, OD-10.**
