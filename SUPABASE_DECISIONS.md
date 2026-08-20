# SUPABASE DECISIONS

> **Last updated:** 2026-08-20
> **Author:** Autonomous database architect (Arena.ai agent)
> **Owner:** Mohamed Masoud

## Decision Record

### D01: Consolidate all pre-canonical migrations into one baseline

| Field | Value |
|---|---|
| **Decision** | Merge `00` (canonical baseline) + `01-06` (post-baseline migrations) into a single authoritative `20260901000000_canonical_baseline.sql` |
| **Rationale** | Fresh installs should apply one file, not 7 sequential migrations. Reduces CI complexity and ensures deterministic schema. |
| **Risk** | Any future migration must be a forward migration numbered `20260901000007+`. No more editing the consolidated baseline. |
| **Status** | ✅ EXECUTED |

### D02: Fix recalculate_invoice_status grant

| Field | Value |
|---|---|
| **Decision** | Revoke `recalculate_invoice_status(uuid)` from `authenticated` role; keep only `service_role` |
| **Rationale** | This is an internal SECURITY DEFINER helper called only by other SECURITY DEFINER functions. Browser users should not execute it directly. |
| **Risk** | Low — no frontend code calls it directly (confirmed by code scan) |
| **Status** | ✅ EXECUTED |

### D03: Keep historical migrations in migrations_history

| Field | Value |
|---|---|
| **Decision** | Preserve all 289 historical migration files in `supabase/migrations_history/` |
| **Rationale** | Enables forensic audit of the development chain. These files are never replayed on fresh installs. |
| **Status** | ✅ EXECUTED |

### D04: ACL lock must be part of the baseline, not a separate migration

| Field | Value |
|---|---|
| **Decision** | The ACL restoration + internal function revocation (`01_restore_dump_acl_lock.sql`) is embedded at the end of the consolidated baseline |
| **Rationale** | Security hardening should apply automatically on every fresh install, not require a second migration step |
| **Status** | ✅ EXECUTED |

### D05: Types regeneration after database rebuild

| Field | Value |
|---|---|
| **Decision** | `rentrix-app/src/types/database.ts` must be regenerated (`pnpm db0:gen-types`) against the rebuilt database before frontend compatibility can be verified |
| **Rationale** | The types file must exactly match the live schema. The existing types file predates migrations 02-06 (missing 10 new tables) |
| **Status** | ⏳ PENDING — requires running Supabase instance |

### D06: Database-first, frontend-second verification order

| Field | Value |
|---|---|
| **Decision** | Rebuild Supabase from consolidated baseline FIRST, then verify frontend compatibility, then deploy Vercel |
| **Rationale** | The database is the source of truth. Frontend queries must match the verified schema, not the other way around. |
| **Status** | ⏳ PENDING — requires live Supabase access |