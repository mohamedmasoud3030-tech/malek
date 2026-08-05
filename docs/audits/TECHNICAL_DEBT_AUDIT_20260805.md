# Technical Debt Audit & Remediation Roadmap — August 2026

**Date:** 2026-08-05  
**Author:** Arena.ai's Agent Mode (Technical Audit Team)  
**Status:** Completed Read-Only Audit (Ready for Feature-Sprint Planning)  
**Target Branch:** `arena/019fd002-malik`  

---

## 1. Executive Summary

This Systematic Technical Debt Audit identifies, categorizes, and prioritizes the technical debt of the MALIK (formerly Rentrix) property management platform. Over multiple iterations, the repository has been continuously hardened, leading to exceptional type safety, robust test coverage (1,100+ tests), and clean migration replays. 

However, as the system transitions from a **single-office pilot** to a commercial **multi-office SaaS model**, several architectural, performance, and security-hardening gaps must be addressed. 

This document provides a prioritized backlog of technical debt items, calculated using a quantitative impact-risk-effort framework, followed by a phased remediation plan designed to run alongside standard product feature delivery.

---

## 2. Technical Debt Categories & Inventory

The table below summarizes the identified technical debt categories, aligning them with the platform's architectural state.

| Type | Identified Debt | Core Risk | Affected Components / References |
| :--- | :--- | :--- | :--- |
| **Security Debt** | Mutable `search_path` on security-definer trigger function. | Potential SQL injection / privilege escalation. | Function: `public.audit_journal_entry_insert()` |
| **Performance Debt** | 224 Supabase Advisor performance/indexing warnings. | Query degradation at scale; high database costs. | Supabase Production instance (`nnggcnpcuomwfuupupwg`) |
| **Code Debt** | Grandfathered cross-feature presentation dependencies. | Code-level coupling; high refactoring friction. | `check-architecture.mjs` → `presentationServiceDebtAllowList` |
| **Quality-Gate Debt** | Overlapping SonarCloud exclusions masking test coverage. | Incomplete visibility into actual code coverage. | File: `sonar-project.properties` |
| **Architecture Debt** | Gaps in complete multi-tenant company isolation. | Potential data leak across customer offices. | `MIGRATION_AUDIT.md` (Tiers 1 & 2) |
| **Functional Debt** | Unimplemented core accounting & workflow gap registers. | manual workarounds leading to ledger errors. | `FORGOTTEN_PLANS_TODO_LIST.md` (Master Leases, Split Costs) |
| **Database Debt** | Mixed identifier types (`text` vs. `uuid`) for PKs/FKs. | Type mismatches; lack of native FK constraint safety. | Schema: `contracts.id` (text) vs. `owners.id` (uuid) |

---

## 3. Prioritization Framework

Each item is scored on:
- **Impact (1-5):** How much does it slow the team down? (1 = barely, 5 = team blocker)
- **Risk (1-5):** What happens if we don’t fix it? (1 = nothing, 5 = data breach/crash)
- **Effort (1-5):** How hard is the fix? (Inverted: 1 = extremely hard, 5 = extremely easy)

### Priority Formula
To prioritize high-impact, high-risk, low-effort items first:
$$\text{Priority Score} = (\text{Impact} + \text{Risk}) \times (6 - \text{Effort})$$

The table below ranks the identified items in order of remediation urgency:

| Rank | Debt Item | Impact | Risk | Effort | Priority Score |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | **Unpinned `search_path` on Audit Trigger Function** | 2 | 4 | 1 (Very Low) | **30** |
| **2** | **Database Performance & Missing FK Indexes** | 3 | 4 | 3 (Medium) | **21** |
| **3** | **Presentation Layer Cross-Feature Dependency Coupling** | 3 | 2 | 2 (Low-Medium) | **20** |
| **4** | **SonarCloud Exclusion Consolidation & Coverage Fixed** | 2 | 2 | 1 (Very Low) | **20** |
| **5** | **Incomplete Multi-Tenant Company Isolation** | 4 | 5 | 4 (High) | **18** |
| **6** | **Core Accounting & Operations Workflow Gaps** | 4 | 3 | 4 (High) | **14** |
| **7** | **Mismatched Database ID Types (`text` vs. `uuid`)** | 4 | 4 | 5 (Very High) | **8** |

---

## 4. Detailed Assessment of Debt Items

### Rank 1: Unpinned `search_path` on Security Definer Trigger
* **Technical Description:** The database trigger function `public.audit_journal_entry_insert()` handles auditing when a journal entry is posted. Although restricted to `service_role` execute permission, it historically lacked a pinned search path, presenting a security vulnerability where `pg_temp` or temporary schema overrides can hijack trigger context. 
* **Business Justification:** Securing the core ledger's integrity prevents potential privilege escalation and schema poisoning, satisfying security compliance required for financial multi-tenant SaaS products.
* **Remediation:** 
  1. Merge and apply the draft migration `20260730091000_reconcile_audit_journal_trigger_security.sql` which enforces `SET search_path = public, pg_temp` on the function.
  2. Add a verify-only query in preflight CI checks to enforce that all security definer functions carry a non-mutable search path.

### Rank 2: Database Performance Warnings & Missing FK Indexes
* **Technical Description:** The Supabase Production Advisor reports 224 warnings. This includes 79 RLS policies suffering from `auth_rls_initplan` (evaluating `auth.uid()` per row instead of caching it once per query transaction) and 62 foreign keys lacking covering indexes (such as `bank_statement_lines(import_id)` and `owner_agreements(owner_id)`), leading to table scans.
* **Business Justification:** Resolving these bottlenecks prevents query performance from degrading exponentially as customer data grows, ensuring sub-second response times and avoiding costly database timeouts.
* **Remediation:**
  1. Optimize RLS performance by caching `auth.uid()` using Postgres session variables or pinning them inside wrappers.
  2. Systematically provision missing indexes on critical foreign keys identified in the Supabase Advisor log.
  3. Drop the 63 unused indexes to reduce insert/update transaction overhead.

### Rank 3: Presentation Layer Cross-Feature Dependency Coupling
* **Technical Description:** The platform's architecture check `check-architecture.mjs` enforces clean domain isolation. However, 8 presentation files are grandfathered into `presentationServiceDebtAllowList` because they import services, formatters, or state directly from other features (such as `owner-detail-view.tsx` importing financial formatters instead of shared library modules).
* **Business Justification:** Removing these exceptions prevents structural drift and component coupling, making it significantly easier to refactor individual modules without breaking unrelated page views.
* **Remediation:**
  1. Replace cross-feature formatting imports with direct imports from `@/lib/companyFormatters` or `@/lib/formatters`.
  2. Abstract direct cross-feature service calls inside feature-specific queries/hooks or shared hooks, decoupling presentation screens from target domain services.
  3. Incrementally remove the files from the allowlist in `check-architecture.mjs` until the list is empty.

### Rank 4: SonarCloud Exclusion Consolidation & Coverage Fixed
* **Technical Description:** In `sonar-project.properties`, duplicate declarations and overly broad wildcards in `sonar.coverage.exclusions` (specifically `**/*.ts` and `**/*.tsx`) completely exclude all source code files from coverage reports, hiding real test-suite coverage indicators.
* **Business Justification:** Accurate code quality metrics in SonarCloud provide immediate feedback on pull requests, ensuring developers maintain the target test coverage before merging code.
* **Remediation:**
  1. Consolidate and clean up duplicate properties in `sonar-project.properties`.
  2. Adjust `sonar.coverage.exclusions` to only ignore test files, documentation, and tooling, allowing true business logic coverage to reflect correctly on SonarCloud.

### Rank 5: Incomplete Multi-Tenant Company Isolation
* **Technical Description:** As detailed in `MIGRATION_AUDIT.md`, several Tier 1 operational tables (such as `properties`, `contracts`, `people`) and Tier 2 scoped tables require complete schema-level multi-tenant coverage with a mandatory `company_id` column. Currently, organization isolation is blocked until the schema has complete column coverage and matching JWT organization claims.
* **Business Justification:** Multi-tenant isolation is the fundamental security foundation of SaaS, ensuring that customers can never access, read, or write data belonging to another office under any circumstance.
* **Remediation:**
  1. Complete the database schema upgrade to add `company_id` across all Tier 1 and Tier 2 tables.
  2. Update database trigger functions and RLS policies to check the session `current_company_id()`.
  3. Adapt Supabase JWT claims to pass the active company membership safely.

### Rank 6: Core Accounting & Operations Workflow Gaps
* **Technical Description:** Key accounting policies established in `0001-product-accounting-policies.md` remain unimplemented or partially unlinked in the UI (documented in `FORGOTTEN_PLANS_TODO_LIST.md`). These include:
  - **Master Lease Fixed Obligations:** Lack of monthly obligation schedules for direct leasing contracts.
  - **Split Maintenance Cost Allocation:** Lack of frontend support to split costs between owner and tenant (despite backend RPC support).
  - **Utility Billing:** Missing periodic manual meter reading entry and automated utility invoice generation.
  - **Tenant Deletion Balance Guard:** Missing trigger-level safety protecting tenant deposits payable from cascading contact deletion.
* **Business Justification:** Bridging functional gaps between policies and software is necessary to move from a single-office pilot to a fully automated commercial product.
* **Remediation:**
  1. Implement a database trigger on the `people` or `tenants` table to prevent contact deletion if active safety deposits or pending ledger balances exist.
  2. Develop form fields inside `EntityForm` supporting Split Maintenance allocations and wire them to the `resolve_maintenance_with_expense` RPC.
  3. Map and construct the UI for Master Lease Obligation schedules and Utility billing.

### Rank 7: Mismatched Database ID Types (`text` vs. `uuid`)
* **Technical Description:** Historical schema decisions caused columns like `contracts.id`, `invoices.contract_id`, `expenses.id`, etc. to be typed as `text`, while newer tables use `uuid` (like `owners.id`). This causes type mismatch issues when writing triggers, RPCs, or foreign keys, forcing the team to write custom casts (`::text` or `::uuid`) and trigger-level hard-delete restriction hooks instead of native PostgreSQL foreign keys.
* **Business Justification:** Type alignment across the database prevents runtime casting overhead, guarantees database-enforced reference safety, and simplifies backend query writing.
* **Remediation:**
  1. This is a highly invasive change requiring database-wide table locking. It must be scheduled as a dedicated offline migration block.
  2. Introduce a systematic database refactoring phase where older text columns are systematically converted to `uuid`, adjusting all referencing foreign keys, triggers, and RPC signatures.

---

## 5. Phased Remediation Plan

To minimize delivery risk and allow standard feature development to continue unimpeded, the technical debt remediation is structured into **four sequential phases** that can be executed alongside standard product sprints.

```
       PHASE 1 (Weeks 1-2)             PHASE 2 (Month 1)             PHASE 3 (Months 2-3)            PHASE 4 (Months 4-6)
 ┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌─────────────────────────────┐
 │ • Pin audit trigger search  │ │ • Index unindexed FK cols.  │ │ • Decouple presentation     │ │ • Structural ID migrations  │
 │   path in DB.               │ │ • Fix Sonar coverage rules  │ │   exceptions (Allowlist).   │   (text -> uuid).             │
 │ • Enable Leaked Password    │   and properties.             │ │ • Add Tenant Deletion       │ │ • Complete Multi-Tenant     │
 │   Protection in Supabase.   │ │ • Remove unused indexes     │   Balance Guard trigger.      │   isolation across Tiers 1&2. │
 │ • Clean legacy asset files. │   flagged by Advisor.         │ │ • Wire Split Cost UI.       │ │ • Master Leases & Utilities │
 └─────────────────────────────┘ └─────────────────────────────┘ └─────────────────────────────┘ └─────────────────────────────┘
```

### Phase 1: Security & Low-Effort Quick-Wins (Weeks 1–2)
* **Goal:** Resolve immediate low-effort vulnerabilities and clean repository structure with zero risk to existing flows.
* **Actions:**
  - **Search Path Hardening:** Deploy the pending migration `20260730091000_reconcile_audit_journal_trigger_security.sql` to secure the `audit_journal_entry_insert` function.
  - **Enable Password Protections:** Manually enable "Leaked Password Protection" inside the Supabase Auth Dashboard settings for production.
  - **Legacy Assets Clean-up:** Permanently delete the legacy unused raster icons `icon-rentrix-192.png` and `icon-rentrix-512.png` since the app shell and login now exclusively consume Cairo/MALIK SVGs.

### Phase 2: Performance Tuning & Quality Gates (Month 1)
* **Goal:** Hardened execution performance and visibility.
* **Actions:**
  - **SonarCloud Properties:** Consolidate `sonar-project.properties` and correct the wildcard exclusions to reactivate unit test coverage reporting.
  - **FK Indexes:** Deploy a focused migration that adds `CREATE INDEX IF NOT EXISTS` for all 62 foreign key column relations highlighted by the Supabase Advisor.
  - **Unused Index Pruning:** Drop the 63 redundant and unused indexes to improve transactional write speeds on tables like `journal_entries` and `receipt_allocations`.

### Phase 3: Modularization & Architecture Alignment (Months 2–3)
* **Goal:** Eliminate domain boundary leakage and secure operational deletes.
* **Actions:**
  - **Decouple Presentation Components:** Systematically resolve grandfathered coupling by migrating formatting imports in `owner-detail-view.tsx` and report sections to the shared `@/lib/companyFormatters` utility. Remove files one-by-one from the `check-architecture.mjs` allowlist.
  - **Tenant Balance Trigger:** Write and apply a database trigger on the `people` / `tenants` tables preventing deletion if outstanding safety deposits or active ledger balances exist, replicating the safety standard of `trg_prevent_owner_delete_with_balances`.
  - **Split Maintenance cost UI:** Bind the existing `resolve_maintenance_with_expense` RPC with a robust split-cost allocation UI form, resolving the gap between business policies and feature delivery.

### Phase 4: Core Gaps, Structural Types & Full Multi-Tenancy (Months 4–6)
* **Goal:** Large-scale schema refinement, complete multi-tenancy, and advanced business logic.
* **Actions:**
  - **Complete Multi-Company Isolation:** Roll out `company_id` columns and enforce company-scoped RLS policies across the entire set of Tier 1 and Tier 2 database tables.
  - **Systematic ID Alignment:** Execute an offline database maintenance plan to align database columns from `text` to `uuid`, removing complex string casts from trigger functions and replacing custom trigger checks with native database constraints.
  - **Master Lease & Utility Billing:** Construct the billing schedules, read-out forms, and accrual accounting ledger links for direct leasing and utility meter systems.
