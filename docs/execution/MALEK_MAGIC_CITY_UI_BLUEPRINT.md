# MALEK — Magic City UI/UX Execution Blueprint

> **Status:** ACTIVE EXECUTION BLUEPRINT  
> **Effective:** 2026-09-01  
> **Authority:** subordinate implementation translation of `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md` (`UX-001..UX-008`).  
> **Not a parallel source of truth:** if this file conflicts with the Canonical Pack, the Canonical Pack wins and this file must be reconciled.  
> **Visual source of truth:** the latest runnable MALEK runtime. Historical screenshots are evidence only.

## 1. Product character — مدينة السحر والجمال

“Magic City” is the **experience character**, not a fantasy skin.

MALEK must feel like entering a refined operational city at night: clear districts, luminous orientation, depth, calm motion, strong landmarks and immediate paths to action. The magic comes from hierarchy, responsiveness and precision — never from decorative clutter.

### Locked visual laws

1. **Operational truth first.** No decoration may obscure a number, status, action, table or financial meaning.
2. **One blue family.** Keep the canonical semantic token system. Do not introduce a second palette, raw page-specific colors, purple fantasy gradients or ornamental gold.
3. **Light as orientation.** Restrained token-derived halos, edge highlights and active-state luminosity may guide attention. They must be subtle enough for daily eight-hour use.
4. **Depth without card soup.** Use hierarchy, spacing, separators, grouped workspaces and selective elevation. Avoid card-inside-card chains and endless vertical card trains.
5. **Motion has meaning.** Motion communicates entrance, focus, state change or spatial continuity. No sheen, bounce, looping decoration or hover scaling.
6. **Arabic is native.** RTL composition is designed, not mirrored after the fact. Arabic titles, numbers, dates and actions remain the visual authority.
7. **Dark-first, Light complete.** Dark is the flagship presentation; Light must be equally coherent, accessible and commercially presentable.
8. **Phone is a first-class city entrance.** No desktop leftovers squeezed into 390px. Primary actions, cards, tables and bottom navigation must remain deliberate.
9. **One page authority.** A page has one title, one primary action area and one coherent toolbar. Embedded workspaces may provide context but may not create competing headers.
10. **Beauty is earned by usefulness.** Any visual element that does not improve scanability, confidence, navigation or perceived quality is removed.

## 2. Target experience architecture

The existing canonical IA remains unchanged:

`Today → Portfolio → Leasing → Money → Services → Reports → Settings`

These seven roots are treated as city districts. The user should always know:

- where they are;
- what requires attention;
- what the primary action is;
- where the underlying record lives;
- how to return to the previous operational context.

No new decorative navigation layer is authorized.

## 3. Shared visual contract

### App shell

- Keep desktop sidebar fixed, named and expanded.
- Make the active district unmistakable through controlled primary-token luminosity, not a saturated block wall.
- Keep top chrome quiet; it supports the work rather than competing with it.
- Use subtle spatial separation between sidebar, chrome and workspace.
- Mobile primary navigation remains the canonical bottom-sheet pattern.

### Page header

Each operational surface exposes one page header only:

- breadcrumb/context when materially useful;
- one `h1`;
- short operational descriptor only when it adds meaning;
- one primary action;
- secondary actions grouped into a compact action menu;
- optional date/status context.

Duplicate `Hub Header + Embedded Header`, repeated register titles and decorative second headings are defects.

### Register toolbar

One shared composition, enabled by need:

`Search → Filters → Active filters → Cards/Table → Columns → Export`

Do not force every control into every register. Phone keeps search visible and moves complex filters to the approved sheet pattern.

### Cards and tables

- Cards: identity, decision-critical status/value/date, then actions.
- Tables: business-importance column order, sticky header, internal horizontal overflow only.
- Default mobile card layouts must avoid one-card-per-row monotony where the content supports a compact 2-column summary/grid.
- Dense entity rows remain rows; do not style a table row as a giant disconnected card.

### Dossiers

Entity detail surfaces become operational dossiers:

`Identity/Status → Key facts → Alerts → Context navigation → Operational sections → Activity/evidence`

Cards are reserved for meaningful grouping. Long dossiers use sections, tabs or anchored navigation rather than nesting containers.

## 4. Today / Dashboard — command center contract

The dashboard must answer within five seconds:

1. What needs my intervention now?
2. What should be collected / paid / resolved today?
3. What is changing in occupancy and contracts?
4. Where is financial or operational risk accumulating?

### Above the fold

- One calm Today header.
- Four compact pulse metrics.
- A dominant **Needs Attention / يحتاج تدخلك** queue.
- Immediate actions for the most common office operations where authority allows.

### Reading order

1. Office Pulse
2. Needs Attention
3. Collections / financial performance
4. Occupancy / vacancy
5. Upcoming contracts
6. Maintenance / utilities
7. Property health
8. Owner obligations / finance exceptions

The page must not repeat the same signal in multiple decorative summaries. Long supporting sections should progressively disclose detail or route to the owning workspace.

## 5. Round 1 — foundation + visible jump

### R1-A Documentation cleanup

- remove stale root status/audit/planning files after confirming they no longer own active authority;
- keep canonical rules in `docs/source-of-truth/**`;
- keep immutable decisions in `docs/decisions/**`;
- keep current execution evidence in `docs/execution/**`;
- do not preserve duplicate “ACTIVE” plans merely for history — Git already preserves history.

### R1-B Shared visual wave

Refine the existing `malek-pro` visual layer instead of creating another theme layer:

- token-derived ambient depth;
- better page/header hierarchy;
- selected elevated surfaces only;
- stronger active/focus states;
- premium dark/light parity;
- no raw palette fork;
- reduced-motion preserved.

### R1-C Dashboard hierarchy

- reduce visual repetition;
- elevate Needs Attention;
- preserve authoritative data sources;
- shorten the first decision path;
- verify mobile and desktop.

### R1-D Header / register coherence

- identify duplicate title owners;
- enforce one page authority;
- preserve shared filter/register primitives;
- eliminate page-specific toolbar inventions.

## 6. Open execution phases

### Phase 2 — Portfolio district

Properties, Units and Owners:

- one register grammar;
- cards/table parity;
- compact 2-column phone summaries where appropriate;
- property/unit/owner dossiers flattened into operational sections;
- strong empty/loading/error states;
- screenshot proof on desktop + phone.

### Phase 3 — Leasing district

Contracts and Tenants:

- remove duplicated headings;
- make expiry/renewal/arrears state scan-friendly;
- simplify contract creation/review steps;
- tenant dossier timeline and due schedule remain authoritative;
- screenshot proof on desktop + phone.

### Phase 4 — Money district

- invoice drill-down and collection journey;
- consistent invoice states;
- clear as-of basis and balances;
- exception surfaces first;
- saved operational views where valuable;
- dangerous actions demoted and guarded;
- no business-rule recomputation in presentation code.

### Phase 5 — Services district

Maintenance and Utilities:

- work-queue views: urgent, overdue, awaiting approval, in progress, awaiting financial close;
- age, owner, next step and cost visible;
- evidence/images attached to the lifecycle;
- printing/export moved into coherent action grouping.

### Phase 6 — Reports final presentation pass

Reports are **not reopened as a business-logic reconstruction**.

Only:

- presentation consistency;
- filter ergonomics;
- export grouping;
- runtime screenshot verification;
- print/PDF visual defects found by evidence.

### Phase 7 — Settings + specialist surfaces + cleanup

- quiet routine settings;
- advanced governance surfaces remain contextual/permission-aware;
- remove compatibility presentation residue only after route/deep-link evidence is green;
- final documentation and style-layer consolidation.

## 7. Arena execution protocol — mandatory

Arena must work as an implementation lead, not a report generator.

### Parallel agents

When the environment supports helper agents, use at least three independent workstreams:

**Agent A — Runtime visual auditor**
- captures fresh screenshots before changes;
- inventories duplicate headers, dead space, hierarchy, clipping and mobile failures;
- does not edit code.

**Agent B — Implementation engineer**
- executes the scoped phase using shared components/tokens;
- does not create a new theme system or page-local replacements.

**Agent C — Regression reviewer**
- reviews diff, tests, accessibility and source-of-truth impact;
- hunts scope creep, temporary hacks, raw colors, duplicate primitives and regressions.

The lead agent reconciles all three. If helper agents are unavailable, perform the three passes serially and document that constraint.

### Mandatory visual self-review loop

Arena may not declare a visual phase complete from tests alone.

For every visual phase:

1. run the application against safe demo/staging data;
2. capture **fresh runtime screenshots** at minimum:
   - desktop 1440×900;
   - laptop 1280×800;
   - phone 390×844;
   - narrow phone 375×812 when the surface is dense;
3. compare against this blueprint and the canonical UX contract;
4. score each target surface from 0–5 on:
   - hierarchy;
   - scanability;
   - density;
   - RTL quality;
   - responsiveness;
   - consistency;
   - perceived premium quality;
   - accessibility/readability;
5. list visible defects from the screenshots;
6. **automatically re-enter implementation** when:
   - any category is below 4/5;
   - the page contains a duplicate title owner;
   - page-level horizontal overflow exists;
   - the primary action is unclear;
   - mobile collapses into an avoidable one-column card train;
   - visual styling hides or weakens operational truth;
7. repeat capture → critique → implementation until the contract is met or a concrete blocker is proven.

Do not ask the owner to visually QA obvious defects that Arena can detect itself.

## 8. Validation gates

Before opening/merging a phase PR:

- focused unit/component/style-contract tests;
- TypeScript typecheck;
- lint for changed scope or full lint where the repository gate requires it;
- production build;
- applicable accessibility checks;
- runtime screenshot campaign;
- diff audit for temporary files, snapshot accidents, raw colors, duplicate components and unrelated changes.

Existing business, financial, security and RLS contracts remain untouched unless the phase explicitly requires a verified defect fix.

## 9. Definition of done

A visual phase is done only when all are true:

- behavior remains correct;
- canonical route/business authority is preserved;
- responsive proof exists;
- screenshot self-review passes;
- no duplicate UI authority was introduced;
- no parallel token/theme system exists;
- relevant tests/gates are green;
- open work is moved to the next named phase rather than buried in prose.

**Rule:** a green CI run with visually weak runtime evidence is not complete. A beautiful screenshot with broken contracts is also not complete.
