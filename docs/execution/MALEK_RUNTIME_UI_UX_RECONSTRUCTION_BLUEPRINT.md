# MALEK — Runtime UI/UX Reconstruction Blueprint

> **Status:** ACTIVE EXECUTION BLUEPRINT  
> **Effective:** 2026-09-01  
> **Authority:** subordinate implementation translation of `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md` (`UX-001..UX-008`).  
> **Primary evidence:** the authenticated 2026-09-01 runtime audit produced from Arena's 62 fresh runtime screenshots plus DOM/structural metrics and code inspection.  
> **Visual source of truth:** the latest runnable MALEK runtime. Historical screenshots are evidence only.  
> **Not a parallel source of truth:** if this file conflicts with the Canonical Pack, the Canonical Pack wins and this file must be reconciled.

## 1. Why this blueprint exists

This blueprint converts the runtime audit into implementation work. It is not a new visual theme and it is not a branding exercise.

The evidence chain is intentionally explicit:

`Arena runtime screenshots → runtime/DOM audit → systemic findings → implementation → fresh screenshots → self-review → rework until acceptable`

The audit established that MALEK already has a strong base: one semantic token system, dark/light themes, Cairo typography, a disciplined action-menu system, a strong Properties register, and operationally deep Reports. The transformation must preserve those assets.

The main problems are structural rather than palette problems:

- Dashboard scroll height around **2,666px** with **21 headings** and **10 exact duplicate heading pairs**;
- duplicated page authority such as Contracts `التأجير` + `سجل العقود` and Settings `إعدادات المكتب` + `بيانات المكتب`;
- navigation/page-title terminology mismatches;
- inconsistent register toolbars across Properties, Contracts, Money and Maintenance;
- inverted type hierarchy (`h3` measured smaller than body text in the audited runtime);
- deep cards-inside-cards/container nesting;
- persistent AI assistant chrome on every authenticated route;
- missing invoice-open path;
- repeated quick-link cards;
- mobile surfaces that must be verified against the captured 390×844 evidence rather than assumed correct.

The implementation objective is therefore **operational clarity, coherence, density control and premium finish** — not decorative novelty.

## 2. LENA ecosystem boundary — important

MALEK is a product inside the wider LENA platform ecosystem.

**LENA's “السحر والجمال / Magic & Beauty” identity is the parent-world DNA, not MALEK's internal UI theme.**

Inside MALEK:

- the product remains property-operations + financial, calm, serious and data-first;
- tables, registers, money, contracts and workflows must look trustworthy and work for long daily sessions;
- no fantasy treatment, ornamental gradients, spatial-world decoration or “city” metaphors may be injected into routine operational screens merely to express LENA identity.

LENA connection may appear through controlled ecosystem touchpoints only, such as:

- parent-platform / LENA Digital House entry and return affordances;
- shared brand family cues;
- cross-product portal/transition moments;
- consistent quality, motion discipline and interaction principles across products;
- future shared intelligence/network capabilities.

**Rule:** the audit decides what MALEK needs fixing. LENA DNA decides how MALEK remains recognizably part of one ecosystem without losing its own product character.

## 3. Locked product principles

1. **Operational truth first.** Financial numbers, statuses, actions, tables and domain semantics outrank decoration.
2. **Preserve the existing semantic token system.** No second palette and no page-local visual theme.
3. **Arabic/RTL is native.** Do not treat Arabic as a mirrored afterthought.
4. **Dark-first, Light complete.** Both themes must remain commercially presentable.
5. **One page authority.** One `h1`, one primary action area, one coherent workbar.
6. **One register grammar.** Search/filter/view/export behavior should feel related across modules.
7. **Density by composition, not tiny text.** Use width, grids, sections and tables intentionally.
8. **Cards only when they add grouping value.** Do not use a card for every section or row.
9. **Mobile is first-class.** No page-level overflow and no compressed-desktop assumptions.
10. **Beauty is a quality outcome.** Strong hierarchy, rhythm, spacing, typography, alignment and detail polish create the premium feel.

## 4. P0 — credibility and serious usability

### P0-1 — One page authority

Affected evidence:

- Contracts: duplicated `التأجير` + `سجل العقود`;
- Settings: duplicated `إعدادات المكتب` + `بيانات المكتب`;
- repeated register/section titles elsewhere.

Target:

`Context/Breadcrumb when useful → one h1 → concise secondary context → primary action → secondary menu`

Implementation rules:

- page shell owns the route title;
- embedded workspaces do not re-declare the same title by default;
- remove duplicate headings only when semantic meaning is truly duplicated;
- preserve useful subsection headings.

### P0-2 — Rebuild Today as a command center

The dashboard must answer within five seconds:

1. What needs intervention now?
2. What should be collected, paid or resolved now?
3. What is changing in occupancy/contracts?
4. Where is operational or financial risk accumulating?

Target reading order:

1. Office Pulse
2. Needs Attention
3. Financial Performance
4. Occupancy & Vacancy
5. Collections & Arrears
6. Maintenance / Utilities
7. Upcoming Contracts
8. Property Health
9. Owner Obligations / Financial Exceptions

Required changes:

- eliminate duplicate section labels and duplicate copies of the same signal;
- merge repeated quick-link questions into the actionable queue or one deliberate shortcuts strip;
- keep first viewport compact and decision-oriented;
- preserve authoritative backend/read-model sources; no presentation-side financial recomputation;
- make `Needs Attention` structurally prominent, not decorative.

### P0-3 — Terminology registry

Nav and page titles must use one route/name registry.

Audit mismatches to eliminate include:

- `اليوم` vs `لوحة التحكم`;
- `المال` vs `المالية`;
- `التقارير`/historical variants vs `التقارير والكشوف`.

Do not create two competing naming systems.

### P0-4 — Type hierarchy

Audit evidence showed `h3` below body size on the measured runtime and inconsistent `h1` sizing.

Target:

- headings follow semantic typography tokens/components;
- `h1 > h2 > h3 > body` is visually clear;
- no local page override may invert hierarchy;
- Arabic line-height and wrapping remain deliberate.

### P0-5 — Mobile intentionality

The audit marked mobile as requiring human screenshot review. Treat that as an execution requirement, not an assumption.

Verify at 390×844 and 375×812:

- no page-level horizontal overflow;
- tables scroll only within table containers;
- practical targets at least 44px;
- no persistent assistant panel consuming viewport;
- compact summary grids may use two columns where readable;
- no avoidable one-card-per-row train;
- forms/dialogs/sheets fit safely with keyboard and safe-area behavior.

## 5. P1 — high-value structural UX

### P1-1 — Canonical register toolbar

Properties is the reference implementation because the audit verified the strongest complete register grammar there.

Target composition, enabled by need:

`Search → Filters → Active filters → Cards/Table → Columns → Export`

Specific work:

- Maintenance gains real search;
- Contracts gains view/columns controls where materially useful;
- Money registers align to the same grammar without forcing irrelevant controls;
- print/export actions move out of page headers into the register/report action system;
- active-filter state and clear-all behavior remain consistent.

### P1-2 — Flatten dossiers/details

Audit evidence showed 19–23 levels of container nesting and property detail built from many stacked bordered sections.

Target dossier grammar:

`Identity/Status → Key facts → Alerts → contextual navigation → operational sections → activity/evidence`

Use:

- flat sections;
- dividers;
- tabs/anchored navigation where useful;
- tables/grids for dense relationships;
- cards only for coherent content groups.

### P1-3 — Invoice inspection path

Every invoice row must offer a direct record-open/view action in addition to collection/print/PDF actions.

Do not force operators to act on a record they cannot inspect.

### P1-4 — AI assistant chrome

The global assistant should be an optional tool, not permanent content chrome.

Target:

- compact trigger/FAB or equivalent low-footprint entry;
- open on user intent;
- no persistent textarea on every route;
- mobile viewport remains owned by the current task.

### P1-5 — Reports control density

Reports business logic is not reopened.

Improve only:

- filter ergonomics;
- export grouping;
- explicit drill/follow-up labels;
- sticky/clear report controls where justified;
- document/print presentation defects proven by runtime evidence.

## 6. P2 — visual/system consistency

- reduce always-expanded navigation choice load without changing the seven canonical roots;
- remove repeated quick-link blocks from module pages;
- unify semantic status-color usage through existing tokens;
- normalize density between Dashboard, Money, Maintenance, Contracts, Settings and Reports;
- complete empty/loading/error/permission states;
- refine border/radius/spacing/elevation only where the screenshots prove hierarchy needs it.

Do **not** start P2 decoration while P0 structural defects remain visible.

## 7. Execution phases

### Round 1 — foundation + P0 proof

- documentation cleanup and authority reconciliation;
- one-page-authority fix;
- Dashboard composition/order/duplication;
- terminology registry verification;
- typography hierarchy verification;
- mobile screenshot proof;
- no LENA-theme decoration inside MALEK.

### Round 2 — Portfolio

Properties, Units, Owners:

- preserve Properties as register reference;
- normalize Units/Owners to shared toolbar grammar;
- flatten property/unit/owner dossiers;
- responsive proof.

### Round 3 — Leasing

Contracts, Tenants:

- remove duplicate page authority;
- scan-friendly expiry/renewal/arrears states;
- toolbar parity;
- dossier and timeline cleanup;
- responsive proof.

### Round 4 — Money

- invoice open/drill path;
- consistent invoice states and as-of basis;
- exception-first views;
- shared register grammar;
- no financial recomputation in UI;
- responsive proof.

### Round 5 — Services

Maintenance, providers, utilities:

- search;
- work-queue views;
- age/owner/next-step/cost visibility;
- evidence lifecycle;
- export/print grouping;
- responsive proof.

### Round 6 — Reports presentation closeout

No business-rule reconstruction. Only evidence-backed presentation, filters, exports, print/PDF and responsive fixes.

### Round 7 — Settings + specialist surfaces + cleanup

- remove duplicate settings authority;
- quiet routine configuration;
- specialist/governance surfaces remain contextual and permission-aware;
- final style/doc cleanup only after runtime proof.

## 8. Arena multi-agent execution protocol

Arena acts as implementation lead, not report generator.

When helper agents are available, use at least three independent workstreams:

**Agent A — Runtime Evidence Auditor**
- uses the existing audit + fresh runtime screenshots;
- inventories visible duplicate authority, overflow, dead space, hierarchy, density, mobile defects;
- does not edit code.

**Agent B — Implementation Engineer**
- executes the scoped audit findings through shared primitives/tokens;
- does not invent a new theme or parallel component family.

**Agent C — Regression / Architecture Reviewer**
- independently reviews diff, tests, accessibility, source-of-truth alignment and scope;
- hunts raw colors, duplicate primitives, hacks, stale docs, temporary files and business-rule regressions.

Lead agent reconciles all three before completion.

If helper agents are unavailable, perform the three passes serially and document that constraint.

## 9. Mandatory screenshot self-review loop

A visual phase is never complete from green tests alone.

For every round:

1. run the safe current demo/staging runtime;
2. capture fresh screenshots at minimum:
   - 1440×900;
   - 1280×800;
   - 390×844;
   - 375×812 for dense phone surfaces;
3. cover representative Today, Portfolio, Leasing, Money, Services and any changed detail/form surface;
4. compare with the audit findings and canonical UX contract;
5. score each changed surface 0–5 for:
   - hierarchy;
   - scanability;
   - density;
   - RTL quality;
   - responsiveness;
   - consistency;
   - perceived commercial/premium quality;
   - accessibility/readability;
6. list visible defects from the screenshots;
7. automatically return to implementation if:
   - any score is below 4/5;
   - duplicate title authority remains;
   - a primary action is ambiguous;
   - page-level horizontal overflow exists;
   - mobile looks like compressed desktop;
   - an avoidable one-column card train remains;
   - content is obscured by assistant/global chrome;
   - the result fixes styling but not the underlying audit defect;
8. repeat `implement → capture → critique → re-implement` until all categories are at least 4/5 or a concrete external blocker is proven.

Do not ask the owner to find obvious defects that the screenshots expose.

## 10. Validation gates

Before a round is ready to merge:

- focused unit/component/style-contract tests;
- TypeScript typecheck;
- test typecheck;
- accessibility gates;
- repository architecture/business/security guards applicable to the changed scope;
- production build;
- fresh screenshot campaign;
- final diff audit for temporary files, raw colors, duplicate components, snapshot accidents and unrelated scope.

Business, accounting, permissions, security and RLS authority remain untouched unless a separately verified defect requires a governed fix.

## 11. Definition of done

A round is done only when:

- the targeted runtime-audit findings are demonstrably fixed;
- canonical route/business authority is preserved;
- responsive screenshots prove the result;
- self-review scores pass;
- no duplicate UI authority is introduced;
- no second theme/token system exists;
- relevant gates are green;
- remaining audit findings are assigned to the next named round.

**Green CI with visually unresolved audit findings is not complete. A polished screenshot with broken operational contracts is also not complete.**
