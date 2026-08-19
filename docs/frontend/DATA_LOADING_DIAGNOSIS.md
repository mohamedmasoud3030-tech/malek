# Data loading failures — network evidence (2026-08-19)

## Finding: dashboard read-model RPC is missing from the live database

**Symptom:** `تعذر تحميل البيانات` on the Today/dashboard page (and any surface
reading the new dashboard read model).

**Frontend request (from `features/dashboard/dashboard-snapshot.ts`):**
```
supabase.rpc('rpt_dashboard_snapshot', { p_from, p_to, p_as_of })
```

**Actual network response (captured against the live project):**
```
POST /rest/v1/rpc/rpt_dashboard_snapshot → HTTP 404
{"code":"PGRST202","message":"Could not find the function api.rpt_dashboard_snapshot(...)"}
```

**Root cause (backend, not frontend):**
The canonical function `rpt_dashboard_snapshot` is defined in migrations
`20260821000000_r1_dashboard_truth_read_model.sql` and
`20260829000000_r13_financial_truth_hardening.sql`, but those migrations are
**not applied to the live production database**. The live schema only exposes
the older `rpt_dashboard_overview` (July migrations). Verified via the public
schema OpenAPI: `rpt_dashboard_overview` present, `rpt_dashboard_snapshot` absent.

**Classification:** BLOCKED BY BACKEND — the fix is applying pending migrations
to the production Supabase project. This task is frontend-only; no migration,
RPC, or schema change was made.

**Frontend behavior is already correct:** the query surfaces a recoverable
`ErrorState` with retry, and the honest empty/error contract is preserved (no
fake-zero KPIs).
