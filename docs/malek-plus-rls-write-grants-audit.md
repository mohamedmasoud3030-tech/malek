# Malek-Plus — Authenticated Write-Grants Permission Audit (Closed)

**Project:** Malek-Plus (Supabase project `nnggcnpcuomwfuupupwg`)
**Status:** CLOSED
**Database state:** No further changes made or pending. Audit is documentation-only from this point forward.

---

## 1. What triggered this audit

Every UI save/update/insert action was failing with Postgres error `42501 — permission denied for table <name>`. Investigation found that all RLS-enabled tables in `public` had SELECT-only grants for the `authenticated` role — INSERT/UPDATE/DELETE had never been granted, so every write request was rejected before RLS policies were even evaluated.

## 2. What was actually done

One migration was applied: **`fix_missing_authenticated_write_grants`**.

It granted INSERT, UPDATE, DELETE to `authenticated` on **41 tables**, and only those 41. Each of the 41 was individually verified beforehand to have complete, real (non-hardcoded-`false`) RLS policies covering all three operations, and none is on the sensitivity list.

Verification after applying the migration confirmed the fix landed exactly as intended: the number of tables still missing a write grant dropped from 115 to 74, with no unintended table affected in either direction.

## 3. Final state (as of audit close)

- **41 tables** — write-enabled. Unchanged since the migration. No further action.
- **74 tables** — left exactly as found. No grants added. No revokes reversed. No policies changed.
- **Total RLS-enabled tables in `public`:** 116 (the original ticket cited 103; the true count was confirmed by direct query during the audit).

No table has moved between these two groups since the migration was applied, and none will move without a separate, explicit decision.

## 4. Why the 74 were left alone — in plain terms

A full trace of the actual application code (every screen, every save button, every backend procedure) against all 74 tables found:

- **Zero tables** where the app is trying to write directly and failing. There is no active bug here.
- **Most of the 74** (invoices, payments, deposits, commissions, owner settlements, journal entries, tax records, and similar) are written *only* through dedicated backend procedures — never directly by the app. This is the system's normal, intended design for anything financial: the backend procedure enforces the business rules; a direct table write would bypass them. Every one of these procedures was confirmed to exist and to be wired up correctly.
- **A smaller group** (user accounts, automation job scheduling, admin/audit tables, permission-override tables, portal-link tables) has direct app writes **deliberately switched off**, each with its own on-record reason found in the migration history:
  - `users` — direct role/authority editing from the browser was intentionally retired. A replacement request-and-approval workflow was partly built (the request/proposal side exists); the final approval step does not exist yet. This is a known, open architectural item — not something this permission audit can or should resolve by granting access back.
  - `automation_jobs` and related automation log tables — job scheduling was intentionally moved to backend-only management as part of a prior security hardening pass.
  - Admin support/audit tables, permission-override tables, tenant/owner portal link tables — each explicitly locked to backend-only access for security or audit-integrity reasons.
- **Two tables** (`companies`, `company_members`) have no creation path anywhere in this codebase at all — meaning company and team-member setup happens through some other system entirely, outside what this repository controls.

None of this is something a database grant can or should fix. Restoring write access to any of these 74 would either do nothing (because the table has no working policy to allow it) or would undo a deliberate, documented security decision.

## 5. Explicitly out of scope for this audit, tracked separately

Per your instruction, the following are **not** permission-audit items and should be picked up as their own architectural follow-ups whenever convenient:

- **Users / role-change workflow** — decide whether to finish building the approval step for the existing request-and-approval flow, or take a different approach to how user roles get changed.
- **Company / company-member provisioning** — confirm where and how new companies and their members are actually created today (likely a system outside this repository), and decide whether that should be brought into Malek-Plus directly or documented as an intentionally external process.

## 6. Standing rule going forward

No table should move from the "74 untouched" group to "write-enabled" without:
1. A specific decision on that table (or a small, clearly related group of tables), and
2. Confirmation of the real application write-path for it, the same way this audit confirmed it for the 41.

This document is the record of what was changed, what was deliberately left alone, and why. The audit is closed.
