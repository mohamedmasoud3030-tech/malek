# MALEK Canonical Pack — Document 6: UX, IA, and Design Contract

> **Status:** CANONICAL  
> **Target Architecture Lock:** 2026-08-27  
> **Runtime UI/UX audit amendment:** 2026-09-01  
> **Repository reality baseline for this lock:** `main@9e5c32e83082cac8227640cf260c51af01e54dc3`  
> **Precedence:** this target contract supersedes older design-guide statements and older implementation contracts where they conflict; repository reality remains separately classified in Document 7.

## UX contract

MALEK is Arabic-first, RTL-first, dark-first and desktop/mobile first-class. The product should feel premium, Gulf-native and globally modern: data-rich but understandable, medium-density rather than empty or cramped, with no developer language and no endless vertical card trains.

The target principle is **simple by default, powerful on demand**. Strong backend/accounting capabilities may remain hidden or contextual rather than being exposed as routine navigation.

The 2026-09-01 runtime audit is implementation evidence, not a new design theme. It confirms that MALEK's strongest visual asset is its existing semantic-token foundation and that the highest-priority defects are structural: duplicated page authority, Dashboard composition, inconsistent register grammar, terminology, typography hierarchy, deep container nesting, persistent assistant chrome, record-inspection gaps and mobile intentionality.

**LENA ecosystem boundary:** MALEK may inherit controlled parent-platform brand/portal cues, but LENA's broader **“السحر والجمال / Magic & Beauty”** world identity is not an internal MALEK operational theme. Routine MALEK screens remain property-operations/financial, calm, trustworthy and data-first. Cross-product identity belongs at ecosystem touchpoints rather than being painted across registers, tables and finance workflows.

## Canonical UX/IA rules

| Rule ID | Canonical rule |
|---|---|
| `UX-001` | The interface is Arabic-first/RTL, responsive, dark-first with equally complete Light theme, and must remain operationally usable on phone, tablet and desktop without page-level horizontal overflow. |
| `UX-002` | Canonical navigation/routes follow one route contract and one page authority. Compatibility aliases preserve deep links; they never create competing information architectures. |
| `UX-003` | Money is the operational financial workspace. Daily UX exposes obligations, collections, receipts, arrears, expenses, management consideration, owner obligations/settlements and light bank verification; specialist accounting remains advanced rather than becoming the daily shell. |
| `UX-004` | Reports is a distinct top-level workspace and presents business-language summaries, useful visuals and detailed tables from authoritative read models; specialist GL/accounting reports remain available without dominating routine use. |
| `UX-005` | Party identity may remain unified underneath, but routine UX uses three task-specific registers: Owners, Tenants and Service Providers. Generic People is not a primary navigation destination; dossiers emphasize relationship/operations and defer heavy financial analysis to Money/Reports. |
| `UX-006` | Services owns maintenance, service providers and utilities/meters. Documents are contextual-first; an aggregate document search/index may exist, but Documents Vault is not a routine product pillar or a second document authority. |
| `UX-007` | AI Assistant is a global optional assistant with a compact entry point and optional expanded workspace. It may read/explain/suggest/navigate/prepare drafts, but cannot silently authorize sensitive financial/operational actions. |
| `UX-008` | Shared semantic tokens, shared components/register primitives, company-aware money/date formatting, accessible states, print/document guards and consistent interaction patterns form one design contract; parallel token systems, raw technical copy and page-specific replacement primitives are prohibited. |

## Target top-level IA

The visible global IA is intentionally limited to seven roots:

1. **Today** — `/dashboard`
2. **Portfolio** — `/properties`
3. **Leasing** — `/contracts`
4. **Money** — `/financials`
5. **Services** — `/maintenance`
6. **Reports** — `/reports`
7. **Settings** — `/settings`

Entity dossiers, specialist/admin tools and compatibility routes remain deep-linkable/permission-aware without becoming extra primary roots.

## Workspace contract

### Today
Today is the Property Office Command Center. It answers four questions within seconds: what requires intervention now, how money is performing, how occupancy/contracts are changing, and what to act on next.

The locked section hierarchy (desktop reading order; mobile keeps the same semantics and brings attention immediately after the pulse) is:

1. **Office Pulse** — four executive surfaces: collections, occupancy, arrears, office cash movement (collections less recorded expenses; never labelled profit);
2. **Needs Attention** — the dominant ranked actionable queue merged from authoritative signals, each item deep-linking into its owning workflow;
3. **Financial Performance** — one primary monthly chart (collections vs recorded expenses, 6-month/1-year window) beside contextual operational metrics;
4. **Occupancy & Vacancy** — occupancy indicator plus vacancy aging and the longest vacancies;
5. **Collections & Arrears** — period collection progress plus the authoritative arrears aging buckets;
6. **Maintenance** — operational summary plus only the highest-value cases, alongside utility obligations;
7. **Upcoming Contracts** — expiry windows and the nearest renewals;
8. **Property Health** — transparent deterministic per-property indicators (no opaque score);
9. **Owner Obligations** — owner funds as a liability signal plus financial exceptions.

The first viewport should behave like a command brief, not another analytics page: Pulse and Needs Attention receive structural priority, common authorized actions remain quickly reachable, and supporting analytics must not delay the path to the next operational action. This priority is achieved through composition and hierarchy, not decorative ambience.

Charts consume existing authoritative read models (the dashboard snapshot RPC, the daily-collection RPC, the Reports cashflow service) and never recompute financial truth in the browser. Numbers stay available as text beside every visualization. Today is a signal/decision surface, not a substitute for detailed Reports. Notifications show events/information; Today shows items requiring attention. Do not duplicate the same feed twice.

### Portfolio
Primary routine surfaces:

- Properties;
- Units;
- Owners.

Lands may remain contextual/later where implemented. Property/unit/owner dossiers show operational relationship context, documents, meters, maintenance, current contracts and concise financial context only. Detailed owner/property financial analysis belongs in Reports/Money.

### Leasing
Primary routine surfaces:

- Contracts;
- Tenants;
- Short Stay as a controlled contract mode where implemented.

Generic People, Leads and Communication are not routine roots. Shared identity remains an internal/domain concern.

### Money
Primary routine surfaces:

- Money overview;
- obligations/invoices;
- collections/receipts;
- arrears;
- expenses;
- management consideration;
- owner obligations/settlements;
- cash/transfer/bank verification.

Deposits remain a governed backend capability but are hidden from routine target UX until deliberately promoted. Advanced GL/accounting stays specialist.

### Services
Primary routine surfaces:

- Maintenance;
- Service Providers;
- Utilities/Meters.

Documents attach to their business context. Global document search/index is secondary and must not encourage orphan documents.

### Reports
Target report families:

- Office Performance;
- Collections & Arrears;
- Property Performance;
- Unit Performance;
- Occupancy & Vacancy;
- Owner Statements & Settlements;
- Tenant Statements;
- Maintenance & Expenses;
- Services/Meters;
- Contracts & Renewals;
- Advanced Accounting (specialist).

Each important report follows the presentation sequence **summary → useful visual insight → detailed table** and states its authoritative basis.

### Settings
Company, employees/effective permissions, document/print preferences and approved configuration. Audit, Data Integrity, System/Support, Automation and other specialist tools are hidden from routine navigation unless the task/permission requires them.

## Route/surface disposition

| Surface | Target disposition |
|---|---|
| `/dashboard` | CANONICAL Today |
| `/properties` + unit/owner deep links | CANONICAL Portfolio |
| `/contracts` + tenant deep links | CANONICAL Leasing |
| `/people` | COMPATIBILITY / contextual identity surface; not routine nav |
| `/financials` | CANONICAL Money |
| legacy finance URLs | COMPATIBILITY bindings into Money; no second authority |
| `/maintenance` | CANONICAL Services |
| `/reports` | CANONICAL Reports |
| `/settings` | CANONICAL Settings |
| `/ai-assistant` | optional expanded assistant workspace/deep link; global assistant entry is primary UX |
| Documents Vault aggregate route/workspace | HIDDEN/secondary index; contextual documents are the normal workflow |
| Deposits | HIDDEN specialist capability |
| Automation / Data Integrity / Audit / System | HIDDEN specialist/admin surfaces |
| MASTER_LEASE visible workflow | LATER/specialist until deliberately promoted |
| Dev design-system routes | HIDDEN development-only |

## Page authority and header contract

Every operational route has one page authority:

- one page title (`h1`);
- one primary action area;
- one concise context/description only when it adds operational meaning;
- secondary actions grouped rather than scattered;
- embedded workspaces may expose actions but must not create a competing second title by default.

Duplicate Hub Header + Embedded Header composition, repeated register headings and decorative second titles are implementation defects under `UX-002` and `UX-008`.

## Dossier contract

**Entity dossier = relationship and operations. Financial analysis = Money/Reports.**

### Owner dossier

- identity/contact;
- properties;
- management agreements and versions;
- core documents;
- operational relationship context;
- links to statement/settlement/performance reports.

Do not create a separate owner-balance calculation inside the dossier when a canonical financial source already exists.
The owner dossier does not render a financial tab, balance, settlement list, collections total, expense total or management-fee total. Those are opened through the linked Money/Reports workspaces.

### Tenant dossier

- current unit;
- current/previous contract periods;
- due schedule/timeline;
- due/paid/remaining/overdue;
- services/utilities;
- receipts/evidence;
- documents;
- claims/damages;
- maintenance relevant to the tenant.

The tenant dossier's **Due schedule and payments** section is the operational ledger: it lists contractual due dates, paid and remaining amounts, arrears, and recorded receipts/payment evidence in chronological order. It does not alter the contractual schedule when a payment is posted.

### Property/unit dossiers

Use wide workspaces, tables/grids and purposeful sections. Avoid stacking a long sequence of unrelated cards. Unit state is operational (`vacant`, `rented`, `reserved`, `maintenance` or equivalent canonical mapping); reference rent/daily price is informational while contract price governs.

## Contract UX

Long-term routine flow:

1. unit + tenant;
2. duration;
3. agreed value/rent;
4. contractual due cadence and advance/arrears arrangement where applicable;
5. responsibilities/services;
6. review/approval.

Payment behavior never rewrites contractual due cadence. Renewal creates a linked new period/version; it does not overwrite historical terms.

Short Stay is a small contract for the same unit: from/to date, optional reference daily rate, negotiated actual rate/total and controlled extension/end. It is not a hotel/housekeeping module.

## Maintenance UX

Routine lifecycle:

`report → in progress → work completed → closed`

“Work completed” means the technical work is done. “Closed” requires the operational/financial resolution that applies: actual cost, responsible party, supporting evidence where required and authorized confirmation. AI may suggest responsibility; a human confirms it.

## Utilities UX

Track the operational obligation rather than becoming a utility-billing platform:

- meter/account reference;
- period;
- amount due;
- paid;
- remaining;
- responsible party;
- actual payer;
- evidence.

A tenant may pay outside MALEK and submit evidence without MALEK pretending the office collected that cash.

## Permission UX

Routine UI presents **Office Owner** and **Employee**. Employee access is configured by effective capabilities grouped by workspace, with simple controls for view/add/edit and sensitive approve/cancel behavior. The backend six-role/effective-permission model remains authoritative.

Sensitive controls should use operator language such as “يحتاج اعتماد” rather than exposing governance jargon where unnecessary.

## Desktop contract

- Desktop sidebar is **fixed, named and expanded**; do not reintroduce an icon-only/collapsed daily rail.
- Desktop uses width intentionally: tables, grids and multi-column workspaces rather than stretched phone layouts.
- Header stays quiet and compact; brand, theme and user/notification controls are proportionate.
- Avoid dead space and avoid dense unbroken walls of cards.

## Tablet contract

Tablet is first-class, not stretched phone. Use appropriate two-column compositions and dense registers while keeping touch accessibility. Phone-only floating controls do not automatically define tablet layout.

## Phone contract

- Primary navigation opens as a **bottom sheet**, not a right/left side drawer.
- The bottom navigation/control surface must not become a second competing destination architecture.
- Safe-area bottom clearance is mandatory.
- Minimum practical action targets are 44px.
- Mobile default register presentation may be Cards, but users may switch to Table where the register benefits from it.
- Compact summaries/grids should use two columns where content remains readable; avoid an unnecessary one-card-per-row train merely because the viewport is narrow.

## Register contract — Cards ⇄ Table

Relevant operational registers support both views through one shared register foundation.

### Default

- Desktop/tablet: Table is normally default.
- Phone: Cards are normally default.
- Preference may be remembered per user/register where appropriate.

### Card view

Concise identity + key status/amount/date + existing record actions. Do not hide the business fact the operator most needs to scan.

### Table view

- real useful columns ordered by business importance, not database schema;
- sticky header on long tables;
- search/filter/sort where useful;
- internal horizontal scrolling when additional columns require it;
- optional sticky leading identity columns where they materially help;
- **never** allow the whole page to horizontally scroll.

Phone Table mode may horizontally scroll **inside the table container only**. The previous card-only/no-table mobile rule is superseded by this target contract.

## Theme and visual system

- **Dark-first** is the flagship presentation direction.
- Light theme is mandatory and equal quality.
- Use semantic tokens; do not create page-specific raw palettes when a semantic token exists.
- MALEK's existing royal/deep-blue token foundation is preserved unless evidence proves a specific token defect; the runtime audit explicitly identified the palette/token base as a product strength.
- Medium density: no oversized empty surfaces, no cramped spreadsheet wall, no endless stacked cards.
- Cards are not the default answer to grouping; separators, sections, tables, anchored navigation and selective elevation should carry hierarchy where more appropriate.
- Charts/visual indicators must help a decision (trend, comparison, collection, occupancy, performance); decoration-only charts are rejected.
- Premium motion is short and functional, with reduced-motion support. Looping decorative motion, hover scaling and animated sheen are rejected in operational workspaces.
- Parent-LENA identity may influence ecosystem transitions/brand touchpoints, but it does not authorize ambient/fantasy decoration inside routine MALEK workspaces.

## Copy contract

Routine user-facing copy must not expose raw RPC names, DB/index/schema identifiers, UUIDs, implementation enum codes, stack traces or developer/status language. Use short business Arabic/English labels as appropriate. Do not add marketing slogans inside operational workspaces.

## Money/date contract

Use company-aware canonical formatters. OMR displays three decimals. Hand-built currency strings or competing local money formatters are prohibited when the shared formatter covers the case.

## State and accessibility contract

Every protected/loaded surface has intentional loading, empty, error and permission-denied behavior. Focus order, keyboard interaction, dialog labeling, semantic tables/forms, readable helper text and touch targets remain part of the Definition of Done.

## Printing, sharing and WhatsApp

Core reports/statements/contracts support professional PDF/print where applicable; Excel/export is used where structured data benefits from it. Print actions require actual document/company readiness.

WhatsApp integration initially prepares text/reference/link and opens WhatsApp/WhatsApp Web for the user to send manually. No automated messaging CRM is implied.

## Tenant Portal UX

Tenant Portal is a separate, constrained shell. v1 is read-only and shows only the authenticated tenant's unit, contract, due schedule, paid/remaining position, services, receipts/evidence, documents and relevant maintenance. It does not expose office navigation or core-edit controls.

## Evidence anchors

- `docs/execution/MALEK_RUNTIME_UI_UX_RECONSTRUCTION_BLUEPRINT.md` — active runtime-audit execution translation and screenshot self-review protocol;
- authenticated 2026-09-01 runtime screenshot campaign and structural audit evidence;
- `rentrix-app/src/app/navigation/route-contract.ts`
- `rentrix-app/src/app/router/route-tree.ts`
- `rentrix-app/src/app/layout/app-shell.tsx`
- `rentrix-app/src/app/layout/layout-navigation-view.tsx`
- `rentrix-app/src/features/active-register-inventory.ts`
- `rentrix-app/src/features/finance/shell/financeShellModel.ts`
- `rentrix-app/src/features/auth/permissions.ts`
- shared layout/register/components and company formatters.

## Release interpretation

This document locks the target UX/IA. Existing implementation that conflicts with it is reconstruction work, not a reason to silently redefine this contract. Document 7 remains the authority for what is already implemented versus partial/conflicting/unverified.
