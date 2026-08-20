# SUPABASE SYSTEM MAP

> **Last updated:** 2026-08-20
> **SHA:** `fix/db-consolidated-baseline-closeout` branch

## Project Overview

| Attribute | Value |
|---|---|
| Application | MALEK (branded), rentrix-app (technical) |
| Supabase Project | Connected production project (RENTRIX EGY) |
| Vercel Project | Connected to repository + Supabase |
| Repository | mohamedmasoud3030-tech/malek |

## Schema Architecture

### Active Migrations (Single Consolidated Baseline)

| # | File | Description |
|---|---|---|
| 00 | `20260901000000_canonical_baseline.sql` | **Single authoritative baseline.** Merges original pg_dump baseline + 6 post-baseline feature migrations (ACL lock, AI Assistant budget, Support Requests, Communication preview, Admin Support Ops, Background Jobs) + security fixes. |

### Migration History

- `supabase/migrations_history/` contains 289 archived migration files (historical development chain)
- These are NOT replayed on fresh install; only the consolidated baseline is applied

### Canonical Layout

| Component | Path | Status |
|---|---|---|
| Active baseline | `supabase/migrations/20260901000000_canonical_baseline.sql` | ✅ Consolidated |
| Migration history | `supabase/migrations_history/` (289 files) | ✅ Archived |
| Seed script | `supabase/seed.sql` | ✅ Reference/bootstrap only |
| RLS per table | `supabase/migrations/rls_per_table/` | Present |

## Database Objects (Consolidated)

| Object Type | Count | Notes |
|---|---|---|
| Tables (public) | 112 | Core domain + feature extensions |
| Views | 12 | Including compatibility/snapshot views |
| Functions | ~346 | Including private `_internal` helpers |
| Indexes | ~179 | Performance + unique constraints |
| Triggers | ~4 | Audit, idempotency, sanitization |
| RLS Policies | ~205 | Company isolation + role-based access |
| Enums | ~6 | user_role, entity_status, charge_type, etc. |

## Feature Areas

| Feature | Tables | RPCs | Authentication |
|---|---|---|---|
| **Core Domain** | properties, units, contracts, invoices, payments, receipts, people, users | CRUD + business operations | RLS + company isolation |
| **Financial/GL** | journal_batches, journal_lines, accounts, accounting_periods | posting, reversal, reconciliation | Service role / RPC only |
| **Owner/Agency** | owner_agreements, owner_funds_events, settlements, commissions | lifecycle RPCs, maker-checker | RLS + role permissions |
| **Deposits** | tenant_deposits, deposit_transactions | governed RPC lifecycle | RPC only, maker-checker |
| **Support** | support_requests, support_request_events | create, triage, update | RPC only, service_role |
| **Communication** | communication_preferences, communication_delivery_outbox | preferences, preview | RPC only, service_role |
| **Admin Ops** | admin_support_audit_events, admin_user_access_change_proposals | lookup, propose | RPC only, service_role |
| **Background Jobs** | background_jobs, background_job_events, background_job_schedules | enqueue, process, cancel | Service role + authenticated |
| **AI Assistant** | ai_assistant_budget_reservations | authorize, reserve budget | RPC only, service_role |

## Security Architecture

### Roles
- Six canonical roles: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`
- Company-scoped via `company_members` with `user_role` enum

### Company Isolation
- Every company-owned table has `company_id` + RLS policy
- `current_company_id()` function derives from JWT claims
- Cross-company access fails closed

### Function Security
- SECURITY DEFINER functions pin `search_path` to `public, pg_temp`
- Company context re-validated server-side
- Internal helpers (`_internal`, `assert_*`, `backfill_*`, `recalculate_*`) revoked from authenticated

### Grant Model
- Public/anon: REVOKE ALL on all objects
- Authenticated: USAGE on schema, SELECT on tables (RLS enforces row-level)
- Service_role: Full access (for background workers)
- Audit_log: SELECT,INSERT,UPDATE,DELETE for authenticated

## Storage

| Bucket | Purpose | Access |
|---|---|---|
| documents | Contract evidence, signed documents | Private, RPC-based access |
| avatars | User profile images | Authenticated |

## Realtime

| Publication | Tables | Purpose |
|---|---|---|
| supabase_realtime | Various | Live updates for dashboard, notifications |

## Auth Hook

- `public.custom_access_token_hook` enriches JWT with company_id and role claims
- Not yet verified on live project (external gate GAP-003)

## Key Decisions

1. **Consolidated baseline**: All 7 migrations merged into one authoritative file for fresh-install simplicity
2. **recalculate_invoice_status**: Made internal-only (revoked from authenticated) as it's a SECURITY DEFINER internal helper
3. **ACL lock preserved**: The dump ACL restoration + internal function revocation is embedded in the consolidated baseline
4. **History preserved**: All 289 historical migrations remain in `migrations_history/` for audit/reference