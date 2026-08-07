# MALEK — Open Decisions (Canonical Registry)

> **Deliverable of the documentation consolidation (2026-08-07).** Every decision that is missing, ambiguous, or blocked on the owner. **Nothing below was resolved by this consolidation** — both sides of every conflict are recorded in `13_Conflict_Report.md`. Part A lists owner decisions with context/options/consequences. Part B is the collected inventory of every TODO / "maybe" / "later" / "consider" / "unknown" / "optional" / TBD-style gap found in the documentation corpus.

---

## Part A — Owner decisions required

### OD-01 — Formal supersession note for ADR 0004 (Conflict C-02)
- **Context:** ADR 0004 (`docs/decisions/0004-proration-and-billing-basis.md`) sets FULL_MONTH default with DAILY_PRORATED extension. ADR 0011-D02 + constitution later decree RATE fee on collection, FIXED_MONTHLY accrues daily, explicitly "no FULL_MONTH default after this decision."
- **Question:** May we annotate ADR 0004 with a "superseded by 0011-D02" banner (keep history) — or edit/withdraw it?
- **Options:** (a) banner annotation, zero content change [recommended by consolidation]; (b) move ADR 0004 to archive; (c) leave as-is (rejected: readers will pick the wrong rule).
- **Consequences:** picking wrong default breaks settlement math expectations; a banner preserves governance history while killing ambiguity.

### OD-02 — VOID reversal implementation vs ADR 0005 (Conflict C-08)
- **Context:** ADR 0005 doctrine: void **clones the original entry's account IDs** (no re-lookup, no client-supplied accounts). S03 GL gap audit (2026-08-06) found the live `void_receipt_atomic` accepts client-supplied `p_reverse_entries`.
- **Question:** Is the live signature a deliberate later decision (undocumented ADR) or a drift bug?
- **Options:** (a) record a new ADR legitimizing client-supplied reversal entries with guards; (b) fix code to clone originals per ADR 0005; (c) hybrid: accept override but default to clones with server validation.
- **Consequences:** (a)/(c) keep flexibility but widen the trust surface; (b) restores the "server authoritative accounts" doctrine but is a breaking RPC change.

### OD-03 — Legal evidence list before contract-template backfill (from CONTRACT_RIGHTS matrix)
- **Context:** The owner-agency/master-lease accounting and several D-decisions assume legal clauses that are not yet evidenced by actual templates.
- **Missing evidence to collect:** (1) property-management agreement template; (2) tenant lease template; (3) master-lease contract template; (4) owner-offset clause; (5) commission clauses (rate/fixed/renewal/setup); (6) deposit clause (beneficiary, application, refund terms); (7) tax review of invoice/receipt wording (VAT).
- **Question:** Who provides these, and when? Any historical-correction claims (S08/S09) depending on contract terms are blocked until then.
- **Consequences:** proceeding without them risks baking unenforceable or legally wrong wording/rules into documents and postings.

### OD-04 — Role model expansion (Conflict C-05)
- **Context:** Code implements 3 app roles (ADMIN/MANAGER/USER) + 4 membership roles (OWNER/ADMIN/MEMBER/VIEWER). ADR 0003 scope describes six business roles incl. Accountant, Viewer, Owner portal, Tenant portal.
- **Question:** Approve a phased role expansion (Accountant/Viewer next; portal roles deferred with portals) or formally revise ADR 0003 scope to the 3-role model?
- **Consequences:** permission matrices, RLS policies, route guards, and the FGR-014 denial-matrix work all depend on the answer.

### OD-05 — Multi-currency & EGP heritage (Conflict C-03, FORGOTTEN #4)
- **Context:** Canonical decisions lock OMR (3dp). Historical artifacts say otherwise: staging project name "RENTRIX EGY (live)" in preflight evidence, and `docs/s08/schema-mapping.md` claims "Default EGP, 2 dp" / "journal_lines EGP 2 dp" (contradicting its own runbook rule). Companies table has `currency`/`locale` columns ready.
- **Questions:** (1) Confirm OMR-only for pilot. (2) Is EGP a legacy experiment or a planned market? (3) Approve multi-currency as a roadmap item (schema impact: amounts, COA currency column exists from Stage-3, rounding per currency)?
- **Consequences:** the s08 EGP claims poison any historical analysis until disclaimed; multi-currency later is far cheaper if decided before S09 corrections.

### OD-06 — Brand reconciliation confirmation (Conflict C-01)
- **Context:** Code + ADR 0011 = MALEK; stale docs say MALIK; repo/path identifiers stay legacy by design.
- **Question:** Bless the consolidation plan: update visible-name doc lines to MALEK, leave technical identifiers untouched, delete/archive MALIK-era marketing docs (D-2)?
- **Consequences:** none technical; unblocks doc cleanup and the `malik-mark.svg` residue decision.

### OD-07 — Numeral standard confirmation (Conflict C-06)
- **Context:** `RENTRIX_FINANCIAL_PRESENTATION.md` prescribes Eastern Arabic numerals; code has forced Latin numerals (`-u-nu-latn`) since PR #1298.
- **Question:** Confirm Latin numerals as the permanent product standard (then the old spec gets fixed/archived) — or is an Arabic-numeral display mode desired?
- **Consequences:** affects every financial screen, report, and printed document baseline + existing tests.

### OD-08 — Due-from-Owner collection mechanism
- **Context:** ADR 0011 consequences: when owner balance goes negative (expenses > collections), a collection mechanism is needed (owner repayment, offset from future settlements, or write-off). No mechanism implemented; docs flag it as an open consequence.
- **Question:** Which mechanism(s) are allowed, with what approval flow?
- **Consequences:** without it, negative owner balances accumulate silently; S05/S09 scope depends on it.

### OD-09 — Chart-of-accounts numbering canon (Conflict C-04)
- **Context:** vision doc `TARGET_PRODUCT_ARCHITECTURE_20260724.md` proposed 2201/2301/4101/4201; implemented Stage-3 COA uses 2000 (settlement payouts), 2200 (tenant deposits), 6100 (operating expenses), 4000 etc.
- **Question:** Confirm implemented numbering as canonical (update vision doc to historical) — the vision doc is already marked OBSOLETE in the inventory.
- **Consequences:** report mappings, S08 historical mapping, and future account additions follow the confirmed canon.

### OD-10 — DOMAIN.md deposits statement (Conflict C-09)
- **Context:** `docs/agent-context/DOMAIN.md` says deposits are not modeled; deposits ARE implemented (2200 liability, atomic create/deduct/refund RPCs — FGR-012 closed core).
- **Question:** Approve correcting DOMAIN.md (agent-facing safety doc) as part of reference repair (D-5).
- **Consequences:** agents trusting DOMAIN.md may avoid touching deposit code or duplicate modeling.

### OD-11 — S08 crediting (merged against its own FINAL_REPORT)
- **Context:** `docs/s08/FINAL_REPORT.md` states "S08 is NOT complete; PR #1366 not ready for independent review" citing fixture evidence + `WHERE FALSE` stubs — yet the S08 branch merged to main (`8e4908a7`, T01–T10).
- **Question:** Does S08 count as done, does it need a redo/completion PR, or should its outputs be quarantined as unreliable for S09?
- **Consequences:** S09 (historical correction) is forbidden until S08 is credited; trusting unreliable analysis risks wrong financial corrections.

### OD-12 — Cairo font self-hosting
- **Context:** Cairo loads from Google Fonts (external runtime dependency).
- **Question:** Self-host the font (PWA reliability/offline/privacy) or accept the dependency?
- **Consequences:** offline PWA experience + load resilience vs maintenance of font files/license bookkeeping.

### OD-13 — Stale branch cleanup (250+ branches)
- **Context:** 250+ stale remote branches accumulate (agent-era workflow artifacts).
- **Question:** Approve bulk deletion (with a keep-list) and a branch-retention rule going forward?
- **Consequences:** repository hygiene; low risk with keep-list, but irreversible.

### OD-14 — GOVERNANCE_LOG backfill & enforcement
- **Context:** Log holds 9 entries (2026-07-06…07-18) only; later live mutations (incl. `20260730090500` and 26 out-of-band 2026-08-06 migrations) never logged, despite the execution-plan guard protecting the file.
- **Question:** Approve a one-time backfill from live ledger + git history, and add an enforcement mechanism (migration-evidence CI check comparing ledger vs log)?
- **Consequences:** without enforcement the log keeps lying; backfill restores the audit trail.

### OD-15 — Fate of the 14 repo-only migration files
- **Context:** drift audit (2026-08-07): 14 migration files exist in repo but were never applied live.
- **Question:** Apply them (if still valid), mark deprecated with a README note, or remove them (with git history kept)?
- **Consequences:** repo must equal live for rebuilds and for the release-blocker chain to mean anything.

### OD-16 — Archive/evidence retention policy (Deletion Proposal D-1)
- **Context:** `evidence/` (14+ files), `archive/` (10+ files) contain historical snapshots; `docs/archive/README.md` establishes a policy exception keeping them.
- **Question:** Keep-everything-forever, or approve dated deletion of listed obsolete evidence (D-1 list) after a retention window?
- **Consequences:** storage/noise vs institutional memory; deletion proposals list exactly which files.

### OD-17 — Sonar duplicate `sonar.exclusions`
- **Context:** `sonar-project.properties` carries a duplicate exclusions config noted in APP_STATUS.
- **Question:** Approve the trivial cleanup edit (config file — outside doc scope, needs owner go-ahead under the no-code-change constraint).

### OD-18 — Tenant subdomain routing
- **Context:** MULTI_TENANT_ARCHITECTURE lists subdomain-per-company as a future idea; pilot defers it.
- **Question:** Confirm deferral to post-multi-office phase (affects routing/infra planning only).

### OD-19 — Stage-ledger reconciliation mechanism (Deletion Proposal D-4)
- **Context:** Ledgers (agent/reviewer/status docs) under-report merged work; constitution requires evidence-linked marking.
- **Question:** Who reconciles (agent batch-update with PR links per task vs reviewer-only per protocol), and does S08's contradiction (OD-11) block marking?
- **Consequences:** MASTER-PLAN statuses are the source S09/S10 gating reads.

---

## Part B — Collected missing-decision inventory (verbatim-style gaps found in docs)

Each item: gap → where found.

1. "Who reviews the reviewer for S02–S08?" — execution ledgers leave reviewer identity/cadence unstated (execution/10_STAGE_REVIEW_LEDGER_AR.md).
2. Deferred-revenue fiscal-year cutover date UNDECIDED ("when does annual prepaid amortize from?") — FEATURE_GAP_REGISTER FGR-013 / NEXT.
3. VAT rate source-of-truth for future configurable VAT: company settings vs jurisdiction table ("later") — decisions/0011 D-series, S05.
4. Deposit forfeiture policy (when may office keep a deposit, accounting target) marked "follows contract clause" — constitution + OD-03 evidence item 6.
5. Bank reconciliation "final approval" actor undefined (ADMIN vs MANAGER) — FGR-006.
6. Automation rule edit-permissions & failure requeue policy "TBD" — APP_STATUS automation notes.
7. AI assistant: which 4 actions are permanent vs trial; expansion approval path — APP_STATUS/NEXT.
8. Owner portal / tenant portal data-exposure scope "to be defined" — PRODUCT/roadmap mentions.
9. Tenant cascade-delete protection design (block vs anonymize) — FORGOTTEN #5.
10. Multi-company switching UX (header switcher vs re-login) deferred without owner sign-off record — MULTI_TENANT_ARCHITECTURE + SINGLE_OFFICE_LAUNCH.
11. Coverage-exemption removal timeline (S10 mentions "remove wide coverage exceptions" without list/date) — 10-stage plan.
12. Report export (CSV) audit-log requirement — adr/0003 scope says required; implementation status unconfirmed in docs (FGR-002 family).
13. Master-lease short-term/low-value election thresholds to be set per company policy — S06 scope.
14. Printer/PDF paper size standard (A4 assumed, never stated) — documents platform docs.
15. Timezone canon for due/overdue computations (`Asia/Muscat` assumed from company row; not codified in docs) — MULTI_TENANT_ARCHITECTURE columns vs business rules.
16. "30+ empty tables" — which are intentional pre-provisioned vs dead schema; no inventory decision — APP_STATUS data posture.
17. Demo seed data cleanup plan (keep TEST-QA entities? wipe before pilot?) — preflight QA residue inventory + pilot posture.
18. English localization completeness target (phased "ok") — no phase dates — i18n notes in NEXT/audits.
19. Commission reverse-window policy (how long after payout may `reverse_commission_atomic` run) — ARCHITECTURE §8.2 names the RPC; no policy bound stated.
20. Settlement period overlap tightening & duplicate-fee prevention — explicitly deferred "P2" items in NEXT (P1 section) without scheduling decision.

> Each Part-B item either lands in roadmap streams (`10_Roadmap.md` Phase C/D) or needs explicit owner closure; they are preserved here so nothing "maybe/someday" disappears silently.
