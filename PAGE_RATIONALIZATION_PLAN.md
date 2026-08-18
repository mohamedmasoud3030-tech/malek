# PAGE_RATIONALIZATION_PLAN

> Decision: keep the **task-centric 7-root IA**. Do not invent a second product tree.

## Keep (canonical)

| Item | Evidence | Roles |
|---|---|---|
| 7 roots: Today, Portfolio, Leasing, Money, Services, Reports, Settings | `app-nav-items.ts`, phase2 IA tests | all |
| Workspace children under roots via search params | progressive disclosure | perm-gated |
| Deep links `/invoices`, `/owners/$id`, etc. | bookmarks + redirects | |
| Mobile Menu + Search only (no 5-tab bar) | WP-06 / `mobileNavItems=[]` | phone |
| EntityTable as sole dense register | UX completion contract | |
| PageLayout + EmbeddableWorkspace templates | layout package | |
| Reports separate from Financials | PRD-007 | |

## Merge (composition, not route deletion)

| Decision | How | Risk |
|---|---|---|
| Commissions under Money | MoneyPage embeds CommissionsWorkspace when view=commissions | low |
| Finance standalone paths | viewBinding into `/financials?section&view` | low — keep redirects |
| Settings automation | `/automation` → settings section | already |

## Split (content, not new product pillars)

| Overloaded | Split into | Status |
|---|---|---|
| Property dossier | Overview / Units / Owners-agreements / Docs sections | already sectioned |
| Contract detail | Lifecycle / Money / Evidence | already |
| Money hub | collections / expenses / funds / banking tabs | already |

## Move

| From | To | Why |
|---|---|---|
| Owners under people historically | Portfolio children | Ownership is asset context |
| Tenants under leasing | Contracts children | Occupancy relationship |

## Replace

| Current | Replacement | When |
|---|---|---|
| Page-local mobile cards | EntityTable mobile register | Done for high-volume; residual ContractMobileCard unused in prod lists |
| Empty state on query error | ErrorState | Bank recon + payment terms done; continue scan |

## Remove (only after zero consumers)

| Artifact | Condition |
|---|---|
| `ContractMobileCard.tsx` | After tests stop importing; no production import today except self |
| Unused `EntityCard` imports | Clean as touched |
| Legacy finance routes without redirect | Never — keep redirects |

## Redirect (preserve)

All `legacyAliases` and `/finance/*` → hub bindings in route-contract/route-tree. **Do not delete** until analytics show zero hits AND redirects remain one release.

## Rejected changes

- Adding phone bottom tabs for 5 destinations (contradicts locked mobile chrome tests).
- Merging Reports into Money (violates PRD-007).
- Collapsing Settings into Today.
