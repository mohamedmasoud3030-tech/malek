# Reports and Account Statements — UX Surface Audit

**Scope:** User-facing reporting and statement paths inspected in the current
application source: catalog, direct product route, navigation, filters,
document actions, entity entry points, state copy, and responsive composition.
This is an IA/presentation audit; it does not alter financial, document,
permission, RLS, or reporting authority.

## Product decision

- **Reports** are analytical and operational products. `/reports` is their
  catalog and `/reports/$reportId` is their canonical direct route.
- **Account statements** are financial records of a selected entity account.
  Owner statements begin at an owner dossier; tenant statements begin at a
  tenant/person's selected contract or contract detail. They retain their
  direct product URL and the established `ReportViewPanel` dispatcher, but do
  not appear as generic Report catalog cards.
- `REPORT_PRODUCTS` remains the only product/target registry. Its `kind`
  discriminator is presentation metadata; no second statement catalog,
  adapter, service, route family, or document implementation is introduced.

## Collisions found and implementation disposition

| Surface | Collision observed | Disposition |
| --- | --- | --- |
| `/reports` catalog | Five visually equivalent cards mixed two account statements with analytical reports, presenting all as generic report products. | Catalog derives and renders only `kind: 'report'` products. A compact, explicit guidance card directs users to owner/tenant/person/contract context for account statements. |
| Catalog hierarchy and mobile density | The mixed five-card catalog made a statement look like a report selection and increased small-screen card density. | Statements are removed from the catalog; the remaining three analytical cards use one readable column on phones, two at `sm`, and the guidance is a single non-card destination explanation. |
| Top-level navigation | Sidebar/mobile label and help text described `/reports` as “Reports & statements,” implying a global statement destination. | Navigation and command-palette language now identify `/reports` as analytical/operational reports only. No global Statements navigation entry is added. |
| Route title and shared translations | The Reports destination title and description conflated summary/report work with ready statements. | `/reports` uses the dedicated Reports label and analytical/operational description. Retired conflating terminology is removed from the navigation registry. |
| Direct product header | Owner and tenant account statements used the same catalog-returning “report” header, English report subtitle, card styling, and report-action landmark as analytical reports. | Statement products use `StatementProductHeader`: an explicit account-statement identity, entity context list, statement action landmark, distinct visual treatment, and contextual return action. Report products retain report chrome and catalog return. |
| Entity/account context | The direct statement route did not lead with who the statement belongs to, its contract/property context, period, or available financial position. | Owner statement chrome shows owner, property scope, period, and RPC-authoritative net movement. Tenant statement chrome shows tenant, property/unit, authoritative contract term, and RPC-authoritative closing balance. Context uses returned/selected data only; no balance or period is reconstructed. |
| Entity return path | A statement’s generic “catalog” back action lost the originating account context. | Owner statements return to the selected owner dossier; tenant statements return to the selected contract. Without an entity selection, the safe fallback is `/reports`. |
| Statement filters | Filters and their accessible region were named “report” for statements; tenant display metadata offered date filters although `rpt_tenant_statement` is contract-scoped. | Filter presentation receives content kind and labels statement scope as such. Tenant statement metadata exposes only `contract`; the current-month reset is absent when a period field is unavailable. |
| State/error language | Incomplete-data alert and stale-content label called a statement a report. | These labels become statement-aware while preserving the existing retry, read-only, and export-blocking behavior. |
| Document/export/share language | The existing guarded document platform described copied links and unavailable actions as reports, even for account statements. | The same action component and authority are reused with statement wording. Export permissions, document readiness, data completeness, PDF/Excel/print behavior, and server values are unchanged. |
| Owner dossier | The owner action “كشف المالك الكامل” was terse and did not establish an account-statement transition. The dossier subtitle sent financial detail to a generic reports space. | Owner action now says “فتح كشف حساب المالك,” and the dossier explains that it opens the owner account statement. |
| Tenant preview and person dossier | Tenant and person links named an account statement but not the contextual destination consistently. | Links now say “فتح كشف حساب العقد” and “فتح كشف حساب المستأجر للعقد”; both provide the contract ID required by the tenant statement authority. |
| Statement entry-point permissions | The tenant preview offered its statement link from the ledger section, which is gated by `arrears.view`, while the destination route requires `financial.reports.view` — an affordance that bounced the user to `/login`. | Every statement entry point (owner dossier, tenant preview, person dossier, contract detail) is now offered only when `financial.reports.view` is held, matching the route guard. No server-side authority changed. |
| Product target rail | The premium page hand-rolled a second partial ARIA tablist (`role="tab"` without roving focus, `aria-controls`, or arrow-key handling) while the app already owns a canonical `SectionTabs` rail, and the body panel's `aria-labelledby` pointed at the retired workspace tab id. | The page composes the canonical `SectionTabs`/`SectionTabPanel` pair under one `idPrefix`, so relations resolve and RTL arrow keys work; `ReportViewPanel` emits no tabpanel of its own. No new abstraction was added. |
| Contract detail | One action combined two product categories as “كشف وتقارير العقد,” although it opens only the tenant statement. | The action is now “فتح كشف حساب العقد,” has a statement-specific ID/icon, and targets the selected contract. |
| Direct dispatcher and data bodies | Replacing statement routes/sections would risk a duplicate renderer or calculation path. | `components/report-view-panel.tsx` remains the only direct lazy body dispatcher; only route chrome/IA and inputs to existing presentation controls change. |

## Responsive and state review criteria

The changed composition deliberately uses the same small-screen protections as
the existing shell: `min-w-0`, wrapping header/action rows, `min-h-11` action
targets, and a compact `sm` label for the contextual back action. The statement
context changes from one column to two at `sm` and three at `xl`; long names
use `break-words`. The analytical catalog keeps its existing responsive grid.

## Browser validation (executed)

Real headless Chromium (Playwright 1.61.1, Chrome for Testing 149) executed the
Reports/Statements suites against the running application and the hermetic
fake-Supabase acceptance backend. All three configured projects
(`chromium-desktop`, `chromium-tablet`, `chromium-mobile`) pass:

1. Desktop 1440: entity context, document actions, and return control coexist
   without crowding; print opens a real scoped A4 RTL popup; the PDF is a
   genuine multi-page `application/pdf` artifact; share falls back honestly
   when the Web Share API is absent.
2. Tablet 768 and mobile 375/390: one readable catalog column, no horizontal
   overflow, statement context and filters wrap without clipping.
3. The product target rail was verified as an honest tab/tabpanel pair: exactly
   one tab is in the tab order, every `aria-controls`/`aria-labelledby`
   relation resolves to a real element, and RTL arrow-key navigation moves the
   selected target and the body it controls.
4. Money on printed documents keeps three-decimal OMR rendering; the printed
   document carries the company identity and never the app screen.

The browser run is what exposed a catalog title assertion that had never matched
the canonical product title; source-level suites had passed it unnoticed.

## Authority protections reviewed

- `rpt_owner_statement` remains the owner row/total authority.
- `rpt_tenant_statement` remains contract-scoped; its running balance is not
  calculated in the client and no arbitrary reporting-period filter is shown.
- Existing VAT, accounting, GL, period/as-of, OMR three-decimal, ordering,
  export/view permission, company isolation, RLS, and document-platform
  boundaries remain intact.
- The header presents contextual values already supplied by the selected
  filter/read model. It neither creates a financial value nor changes document
  data.

## Follow-up validation

Source-level coverage and focused application tests must assert: exactly three
analytical catalog cards; no statement card in the catalog; statement identity,
context, and entity return wiring; report/catalog return wiring; direct
`ReportViewPanel` dispatch; statement entry-point permission parity; and
preserved document authority. Browser evidence is recorded above and was
produced by actual Chromium execution, not simulation.
