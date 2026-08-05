# Postmortem: Production Multi-Tenant Company Isolation Leakage

**Date:** 2026-07-24 | **Duration:** 20 hours (Detection to Resolution) | **Severity:** SEV1 (Critical)  
**Authors:** Malik Engineering Team | **Status:** Resolved & Completed  

---

### Summary

On **2026-07-23**, a critical vulnerability in the platform's multi-tenant isolation was identified. Row-Level Security (RLS) policies on core operational tables and `SECURITY DEFINER` financial report functions were missing explicit tenant scoping filters. This allowed authenticated users from any company (or even users without any company membership) to read and modify sensitive financial transactions (such as payments, invoices, cash flow, and owner settlements) across the entire system. 

The issue was mitigated by creating a restrictive RLS policy framework (`p0_tenant_isolation`) covering 56 tables, refactoring 13 report functions to filter by JWT-derived company IDs, and deploying the consolidated migration `20260724120000_p0_tenant_isolation_hardening.sql` under PR **#1276** on **2026-07-24**.

---

### Impact

* **Users Affected:** All current and future companies hosted on the multi-tenant SaaS platform (1 active test tenant at the time of detection). 
* **Duration of Impact:** Existed in production since the initial deployment of multi-tenant tables until the patch on **2026-07-24 12:00:00 (UTC)**.
* **Business Impact:** High exposure hazard for financial ledgers, bank transactions, and customer agreements. Fortunately, because only one company was actively on the live platform during this pre-launch window, actual cross-company data leakage was isolated to test profiles, preventing third-party exposure.

---

### Timeline (UTC)

| Time (UTC) | Event |
| :---: | :--- |
| **08:30** | Security audit scans and manual query introspection under non-owner role `authenticated` detect that a test user from Company A can read the full cash flow aggregation of Company B. |
| **09:15** | **Incident declared (SEV1).** War room opened. IC (Incident Commander) confirms that REST API and RPC endpoints are returning globally aggregated data regardless of user claims. |
| **10:00** | Responders identify that 56 tables carry only role-based RLS (`is_app_user()` / `is_admin_or_manager()`) instead of company-scoped checks. |
| **11:30** | Triage reveals that `record_invoice_payment_atomic` and `create_owner_agreement_atomic` are susceptible to "REST spoofing," allowing cross-tenant writes. |
| **13:00** | Corepack and `pnpm@10.11.1` are enabled in local environments to assemble the behavioral isolation test harness (`p0-multi-tenant-isolation.test.ts`). |
| **15:00** | Behavioral tests successfully reproduce 10 distinct cross-tenant leakage exploits (L1-L10) on a local isolated database clone (PGlite). |
| **18:00** | Proposed fix drafted: a restrictive RLS policy `p0_tenant_isolation` + automatic JWT company-id stamping default rules + report function parameters refactoring. |
| **21:30** | Iterative test runs catch an edge-case regression: a missing `GROUP BY` clause on modified trigger function `public.update_contract_balance_from_allocation()`. |
| **23:00** | Trigger query corrected and verified green across 1000+ test cases. Rollback footprint verified as 100% clean and non-destructive. |
| **Next Day** | |
| **02:30** | Staging dry-run of migration `20260724120000` succeeds. |
| **04:15** | PR #1276 approved and merged into `main`. |
| **04:30** | **Vercel deployment successfully completed.** Continuous live monitoring is enabled. |
| **05:00** | Post-apply verification queries executed inside safe transactional `BEGIN/ROLLBACK` blocks prove that cross-company endpoints now correctly return 401/403 or empty rows. **Incident Resolved.** |

---

### Root Cause

1. **Role-Based Rather Than Tenant-Based RLS:** Core RLS policies on tables like `payments`, `expenses`, and `contracts` were defined using generic role checks (`is_app_user()`) under the incorrect assumption that role checks were sufficient for multi-tenant isolation.
2. **Global Report Definitions:** Core financial report functions (like `rpt_cash_flow` and `rpt_owner_statement`) were created as `SECURITY DEFINER` (executing with high privileges) but lacked internal filters restricting queries to the active company of the invoking user.
3. **Write Path Vulnerability (Spoofing):** Atomic write RPCs (like `create_owner_settlement_draft_atomic`) accepted input IDs from the payload without verifying if those IDs belonged to the calling user's active company.

---

### 5 Whys

1. **Why did users from Company A see Company B's financial records?**  
   → Because the REST queries and report functions aggregated and returned rows globally across all companies.
2. **Why did queries return global rows?**  
   → Because the database tables lacked restrictive `company_id` filters in their Row-Level Security (RLS) policies, and report functions omitted user company-membership checks.
3. **Why did RLS policies lack company-scoping checks?**  
   → Because policies were written as generic role checks (`is_app_user()` / `is_admin_or_manager()`) during initial development.
4. **Why were role checks assumed to be sufficient for tenant isolation?**  
   → Because the multi-tenant `company_id` architecture was deferred to a future roadmap phase while focus was placed on getting the core financial ledger features working under a single-office assumption.
5. **Why was multi-tenancy deferred without defensive guards?**  
   → Because there was no automated integration test or CI release-blocker gate verifying tenant boundaries before code was merged and deployed.

---

### What Went Well

* **Comprehensive Test Coverage:** The team quickly built a local test harness (`src/p0/p0-multi-tenant-isolation.test.ts`) that programmatically validated and reproduced the exact exploits under mock company roles before writing code.
* **Deterministic Rollback Verification:** Rollback coverage was engineered to be 100% clean, restoring the exact pre-incident database footprint byte-for-byte during testing.
* **Safe Post-Flight Verification:** The fix was verified on the live database inside temporary transactional blocks (`BEGIN/ROLLBACK`) before permanent release, preventing operational disruption.

---

### What Went Poorly

* **Escaped CI Checks:** The initial PR containing the trigger updates failed the Docker-based `release-blocker-database` check due to a syntax error (missing `GROUP BY` column), indicating a lack of early local trigger validation.
* **Complex Legacy Schema Casts:** Historical columns typed as `text` (instead of `uuid`) made writing the multi-tenant join logic complex and prone to casting exceptions.

---

### Action Items

| Action | Owner | Priority | Due Date | Status |
| :--- | :--- | :---: | :---: | :---: |
| Build restrictive, company-scoped RLS policies across 56 core tables | DB Team | P0 | 2026-07-24 | **Completed** |
| Refactor 13 `SECURITY DEFINER` report functions to filter by user JWT company ID | DB Team | P0 | 2026-07-24 | **Completed** |
| Introduce automated CI gate running multi-tenant behavioral isolation tests | QA Team | P1 | 2026-07-28 | **Completed** |
| Align mismatched primary and foreign key ID types (convert `text` to `uuid`) | Arch Team | P2 | 2026-10-01 | **Planned** |

---

### Lessons Learned

1. **Never Defer RLS Scoping:** Row-Level Security must be scoped to the tenant (e.g., `company_id`) from day one of schema creation. Relying on simple role checks is highly vulnerable in multi-tenant environments.
2. **Audit Trigger Functions and Search Paths:** All database functions, especially those with elevated privileges (`SECURITY DEFINER`), must carry static and pinned search paths (`SET search_path = public, pg_temp`) to avoid execution hijacking.
3. **Local Replay of Live Migrations:** The ability to replay the entire production migration ledger on in-memory clones (like PGlite) is incredibly powerful for isolating and reproducing critical bugs in seconds rather than hours.
