# MALEK Pro visual parity coverage contract

**Status:** active UX implementation contract — visual presentation only  
**Reference:** the MALEK Pro screenshots supplied in this session  
**Functional authority:** current MALEK repository and canonical routes/surfaces  

## Non-negotiable boundary

The screenshots define **presentation**, never business content. MALEK keeps its real data, fields, status meanings, permissions, calculations, mutations, navigation, route/search contracts, and workflows. Browser/Google AI Studio/Chat/Preview chrome in screenshots is excluded. A screenshot-only business field, option, action, identity, amount, currency, record, or calculation is not added.

Finance and Reports information architecture, route ownership, redirects, section models, search contracts, and architecture tests are owned by the parallel Finance/Accounting session. This UX pass may change safe shared primitives and non-architectural leaf presentation only; Finance/Reports structural integration is handed off when it risks conflict.

## Shared visual contracts

| Pattern | Screenshot contract | MALEK presentation source | Coverage |
| --- | --- | --- | --- |
| Application shell/top bar | White compact top surface; balanced RTL product identity; rounded existing icon controls; subtle bottom separation; mobile-friendly control sizing | `app/layout/*`, `components/brand/*`, `styles/malek-pro-visual-wave.css` | MATCHED — only existing shell controls are styled; screenshot-only controls are excluded |
| App canvas | Very light cool blue-gray background; white primary surfaces; restrained borders/shadows | `styles/tokens.css`, `globals.css`, `malek-pro-visual-wave.css` | MATCHED |
| Page header card | Large white radius card, module icon, bold Arabic title, useful muted subtitle, CTA inside surface when real action exists | `components/layout/page-header.tsx`, `page-header-actions.tsx` | MIGRATED |
| Contextual action colour | Contracts navy/orange; property green/navy; maintenance blue; finance positive green; document print navy — never one universal primary | `components/ui/button.tsx`, semantic tokens, feature-owned action variants | MIGRATED; each feature retains its existing action meaning |
| Filter / tab pills | Floating on page canvas, wrapping RTL pills, high-contrast selected state determined by module context | `filter-tabs.tsx`, `filter-bar.tsx`, `section-tabs.tsx`, `enterprise-filters.tsx` | MATCHED; context tokens rather than global fixed orange |
| Status badge | Compact rounded capsule, tint + border + optional icon, semantic accessible state | `status-badge.tsx`, `enterprise-status-badge.tsx` | MATCHED |
| Modal create/edit surface | Dim/blur backdrop, large radius, navy header, module icon/title, rounded close control, white body, generous padding, divider/action footer | `dialog.tsx`, `entity-form.tsx`, `bottom-sheet.tsx` | MIGRATED; existing modal/full-page/bottom-sheet workflow choice is preserved |
| Form fields | Label above control, pale surface, soft border, large radius, two-column RTL grid where existing layout permits, one column narrow | `entity-form.tsx`, `form-field.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx` | MATCHED |
| Semantic dialog actions | Property/invoice positive = green; contract approval/create = existing contextual variant; maintenance = existing blue/primary; document print = navy | `EntityForm.Actions`, `button.tsx` | MATCHED — no business action recolouring by guesswork |
| Selection cards | Small existing option sets use white unselected / semantic-tinted selected cards with strong border/text | `components/ui/selection-card.tsx` | MIGRATED shared primitive; use only where existing options safely support it |
| Table/register | Large white round surface, light gray header, bold identifiers, muted metadata, comfortable row height, compact contextual actions | `entity-table.tsx`, `table.tsx`, `enterprise-data-table.tsx`, `page-polish.css` | MIGRATED |
| Mobile dense table | Dense contracts/financial registers keep table hierarchy using controlled horizontal scroll; no hiding critical columns | `entity-table.tsx`, `enterprise-data-table.tsx` | MATCHED |
| Entity/property card | Identity icon/name/code/type + location/owner; divider; actual approved metrics; disclosure; nested real-unit content | `entity-card.tsx`, `mobile-card.tsx`, property workspace components | MATCHED where source data exists; no invented metrics |
| Alert/warning card | Semantic tinted renewal, overdue, and urgent maintenance surfaces with icon/detail/existing CTA | `alert.tsx`, dashboard alert and lifecycle components | MATCHED |
| KPI/chart card | White round card, heading, optional actual metric chips/link, clear legend, restrained grid, readable Arabic labels and tooltip | `kpi-card.tsx`, dashboard chart components, reports leaf chart components | MATCHED for Dashboard; Finance/Reports visual leaf integration is parallel-safe only |
| Printable document | Paper-like white document hierarchy; identity/number/date; grouped facts; amount summary; verification/metadata; navy print and neutral close | `features/financials/receipts/receipt-detail-page.tsx`, `receipt-detail-card.tsx`, print service | PARTIALLY MATCHED — no Finance/Reports architecture file modified by this session |
| Empty/loading/error | Icon-led, concise, truthful, accessible surfaces | shared state components and enterprise state surfaces | MATCHED |

## Screenshot-to-surface audit matrix

| Reference surface | Current canonical MALEK route/surface | Relevant screenshot patterns | Status / constraint |
| --- | --- | --- | --- |
| Dashboard priority workspace | `/dashboard` | KPI/stat cards, occupancy donut + legend, overdue collection register, quick property list, renewal warning, urgent maintenance, collection trend, metric chips, cashflow bars, tooltip, contextual links | MATCHED — calculations and data sources untouched |
| Property register | `/properties` | Header card, green create CTA, navy selected filter, floating filter pills, property identity/metric cards, disclosure | MIGRATED |
| Property detail / units | `/properties/$propertyId`, `/properties/$propertyId/units`, `/properties/$propertyId/units/$unitId` | Expanded property card, section header, real unit surfaces, clear disclosure | MATCHED |
| Property form | `/properties/new`, `/properties/$propertyId/edit` | Navy dialog/header, white body, field rhythm, semantic save/cancel | MIGRATED |
| Contract register | `/contracts` | Header card, navy create CTA, orange contextual selection, rounded register, identifiers, tenant/property/rent/date hierarchy, badges, renewal/view/destructive actions | MIGRATED |
| Contract detail/form | `/contracts/new`, `/contracts/$contractId`, `/contracts/$contractId/edit` | 2-column form composition, agreement/terms grouping, semantic actions, selection presentation only for existing small option sets | MATCHED |
| Finance collections/register | current canonical Finance Collections surface | Header, finance tabs/pills, invoice register, identifiers, tenant/unit hierarchy, due/amount/status/action hierarchy | DEFERRED TO PARALLEL FINANCE SESSION — Finance surface/section/route architecture ownership |
| Invoice issue/payment dialog | real current collection payment/issue overlays | Navy header, soft summary panel, real invoice prominence, amount/method/reference, divider, green confirm/cancel | PARTIALLY MATCHED — safe shared dialog primitives migrated; workflow leaf integration deferred when overlapping Finance work |
| Receipt register/detail/print | current canonical receipts surface | Receipt cards, receipt document surface, print action, paid/overdue treatment | PARTIALLY MATCHED — visual document leafs exist; no Finance IA files touched |
| Finance deposits/banking/expenses/settlements | current canonical Finance surfaces | semantic registers, badges, summary surfaces | DEFERRED TO PARALLEL FINANCE SESSION — exact file/architecture ownership is Finance/Accounting consolidation |
| Maintenance workspace | `/maintenance` | Header card, blue CTA, pills, large operational cards: code/priority/category/title/description/entity/cost/status/contextual action | MATCHED — intentionally card-first, not forced into generic table |
| Maintenance request form | existing maintenance form overlay | Navy header, two-column responsive field rhythm, description, priority/cost, selection-card pattern only for existing option sets | MIGRATED |
| Owners/agreement | `/owners`, `/owners/$ownerId`, existing owner agreement/settings surfaces | grouped contact, bank settlement, account/IBAN, existing agreement choices, owned-property links, notes and footer | MATCHED — existing legal options only; screenshot-only agreement models excluded |
| People/tenants | `/tenants`, current supporting People surface | entity card/table, metadata hierarchy, form/dialog treatment | MATCHED |
| Reports | `/reports` | chart/table card framing, filters, numeric hierarchy | DEFERRED TO PARALLEL FINANCE SESSION — Reports IA/route/section architecture ownership |
| Settings/system/audit | `/settings`, `/system`, `/audit-log`, `/data-integrity` | grouped cards/forms/registers/statuses | MATCHED |
| Auth / password | `/login`, `/change-password` | product-consistent surfaces and form controls | MATCHED |

## Required visual behavior checks

- **RTL:** logical start/end layout; title/icon and close-action placement; arrow/chevron direction; pills; table flow; button icon order.
- **LTR islands:** IDs, codes, phone numbers, IBAN, dates, invoice/contract/receipt numbers, and amounts use `dir="ltr"` / tabular figures where their component already identifies them as such.
- **Responsive:** headers stack without clipping; filters wrap; forms collapse to one column; dialogs remain reachable; dense tables retain component-level horizontal scroll; no application-level horizontal scroll.
- **Accessibility:** 44px interactive controls, visible keyboard focus, label association, dialog semantics, icon names, disabled/loading states, and status meaning beyond colour.

## Explicitly excluded from visual copying

| Reference element | Reason |
| --- | --- |
| Browser, Google AI Studio, Chat/Preview chrome | External host UI, not MALEK |
| “Pro” badge, notification count, AI/shield/quick-create controls | Not added unless an existing MALEK capability owns the control |
| Screenshot names, codes, dates, amounts, currencies, contacts, addresses, IBANs, status examples | Demo content; MALEK data remains authoritative |
| Screenshot-only fields/options/actions/calculations | Functional/business additions prohibited |

## Change slices and handoff discipline

- Shared primitives and app/operational page presentation: UX session owned.
- Finance/Reports section and route architecture: intentionally not touched here.
- Any Finance/Reports visual integration that cannot be applied by consuming shared primitives without editing parallel-owned architecture is a handoff item, not a silent omission.
