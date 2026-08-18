# SHARED_COMPONENT_ARCHITECTURE

## Principle

Smallest justified system already exists. **Prefer improving consumers over new libraries.**

## Classification

| Component | Class | Notes |
|---|---|---|
| AppShell | KEEP | Desktop sidebar + mobile drawer + floating Menu/Search |
| PageLayout / PageHeader / EmbeddableWorkspace | KEEP | Canonical page chrome |
| ListPage / list-controls | KEEP | Index template |
| EntityTable (+ DataTable alias) | KEEP | Sole dense register |
| EntityForm / FormField / TextField / Select / FileAttachment | KEEP | Forms |
| DetailFields / EntityDetailHeader / EntityPreviewDialog | KEEP | Detail |
| EmptyState / ErrorState / LoadingState / AsyncContentState | KEEP | States — use ErrorState for failures |
| ActionMenu / Button / IconButton | KEEP | Actions ≥44px |
| FilterBar / ActiveFilterBar / SectionTabs | KEEP | Filters |
| KPI/Stat cards | KEEP | Only with real decision value |
| MobileCard | IMPROVE/limit | Prefer EntityTable mobile path; MobileCard for non-register summaries only |
| ContractMobileCard | REMOVED | Deleted; EntityTable only |
| FinanceMobileCard | REMOVED | Unused page-local finance card; EntityTable mobile path |
| DataTable import path in features | IMPROVE→DONE | Features import entity-table; data-table.tsx stays alias |
| bottom-sheet | KEEP | Drawers on small screens |
| Dialog / ConfirmDialog | KEEP | Destructive confirms |
| DataTable name | KEEP alias | Do not fork implementation |

## Canonical patterns

### Index page
`ListPage` or `EmbeddableWorkspace` → FilterBar → EntityTable → pagination.

### Detail page
`PageLayout` → EntityDetailHeader → sections (DetailFields) → related EntityTables.

### Form page/modal
`EntityForm.Root` + sections + Actions; long forms: `MobileFormStepper`.

### Hub page
`PageLayout` → SectionTabs → embedded workspace (`embedded`).

## Anti-patterns

- Page-local mobile card implementations for registers.  
- Rendering EmptyState when `isError`.  
- KPI zeros from `data ?? []` while query failed.  
- New CSS framework or component library.
