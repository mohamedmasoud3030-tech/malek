# DATA_DISPLAY_DECISIONS

## Default rules

1. **Operational registers** → `EntityTable` / `DataTable` alias (desktop dense table; mobile identity+one datum+actions).  
2. **Single record** → Detail dossier (`DetailFields`, sections, `EntityDetailHeader`).  
3. **Create/edit** → `EntityForm` (+ mobile stepper when long).  
4. **Money comparison** → table; mobile primary datum = **amount** or **status** by task.  
5. **Charts** only when trend/threshold decisions need them (dashboard arrears, reports).  
6. **Never** horizontal-scroll a full desktop table on phone without a card transformation.

## Per-surface decisions

| Surface | Pattern | Mobile strategy | Why |
|---|---|---|---|
| Properties | EntityTable | title + status | Browse assets |
| Units (in property) | EntityTable | unit# + status | Occupancy ops |
| Owners | EntityTable | name + **active contracts** | Prioritize operational load |
| Contracts | EntityTable | ref/parties + status | Lifecycle ops |
| Tenants/People/Leads | EntityTable | name + status/type | Directory |
| Invoices/Receipts/Arrears | EntityTable | **amount** | Money first |
| Expenses | EntityTable/DataTable | amount | Spend control |
| Deposits/Settlements | EntityTable | balance/total | Liability |
| Bank lines | EntityTable | **amount** (was status) | Matching money |
| Maintenance | EntityTable/DataTable | status | Work queue |
| Service providers | ListPage+EntityTable | name + category | Vendor pick |
| Utilities | EntityTable | meter/bill amount | Billing |
| Reports collections panels | DataTable | contained table | Compare periods |
| Dashboard | KPI + lists | stack | Action before analysis |
| Settings lists | simple list/cards | stack | Low density |
| Auth | single column form | full width | Focus |

## Pagination

Server/range or `fetchAllRows` with deterministic order (`created_at,id`). Fail closed on unsafe caps where totals matter.

## Bulk actions

Only where domain already supports (future); do not add bulk delete without RPC+audit.
