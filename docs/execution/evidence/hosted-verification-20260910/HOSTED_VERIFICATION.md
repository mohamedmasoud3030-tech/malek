# Hosted verification — Malek-Plus (live), 2026-09-10

Project `nnggcnpcuomwfuupupwg` · `ap-southeast-1` · ACTIVE_HEALTHY.

A Supabase management token was made available this session. It was used **read-only**: `GET` on the management API and `SELECT`-only statements through the query endpoint. **No DDL, no DML, no migration was applied to production.** The token was used in-process only and never written to a file.

This closes the standing gap "local SQL with mocked auth cannot prove JWT/PostgREST behaviour". It does not close the gap for hosted *concurrency*, which was not exercised.

---

## 1. PROVEN GREEN on production (hosted, not inferred)

**The anonymous boundary is real and enforced at the grant level.** Against live PostgREST with the real anon key and an explicit `Accept-Profile: public`:

| Table | Result |
|---|---|
| `companies` | HTTP 401 `42501 permission denied for table companies` |
| `users` | HTTP 401 `42501 permission denied for table users` |
| `audit_log` | HTTP 401 `42501 permission denied for table audit_log` |
| `owner_balances` | HTTP 401 `42501 permission denied for table owner_balances` |

`42501` is a *privilege* refusal, not an empty RLS result — anon holds no table privilege at all. Confirmed independently in the catalog: **`anon` holds 0 grants** across the `public` schema. Root discovery (`GET /rest/v1/`) returns **401 with 0 exposed paths**, so the schema is not even enumerable.

Note on a false lead: the first probe returned `PGRST205 Could not find the table 'api.<name>'` for every table. That was **not** a security boundary — `db_schema` is `"api, public, graphql_public"` and `api` resolves first but is **empty (0 objects)**. Re-probing with `Accept-Profile: public` produced the real answer above. Worth recording so the 404 is not later mistaken for hardening.

**Structural isolation on the live schema:**

| Check | Result |
|---|---|
| Tenant tables (have `company_id`) | 105 |
| RLS disabled on a tenant table | **0** |
| Tenant table with no policy | **0** |
| SECURITY DEFINER without pinned `search_path` | **0** |
| Views not `security_invoker` | **0** (all 11 are `security_invoker=true`) |
| `anon` table grants | **0** |

---

## 2a. APPLIED TO PRODUCTION — both leaks are now CLOSED (authorized 2026-09-10)

The user explicitly authorized applying **only** `20260910000000` and confirmed **all current production data is test data**. Applied via the management query endpoint; the migration carries its own `begin/commit`.

**Before → after, measured by impersonating the real `authenticated` role with real JWT claims (each probe wrapped in `begin … rollback`):**

| Actor | `users` visible | `audit_log` visible |
|---|---|---|
| Admin of company `5138ff36` — **before** | 6 (all) | 41 (all) |
| Admin of company `5138ff36` — **after** | **2** (own company only) | **0** |
| Admin of company `ae96d298` — **after** | 6 (all 6 *are* its members) | **7** (its own attributed rows) |

The live policy expressions are now:
```
users     :: ((id = (SELECT auth.uid())) OR (is_admin() AND user_is_member_of_active_company(id)))
audit_log :: (is_admin() AND (company_id = current_company_id()))
```
`audit_log.company_id` exists, `user_is_member_of_active_company` exists, and both RESTRICTIVE deny policies (`audit_log_no_client_update`, `audit_log_no_client_delete`) are present.

**Data integrity: nothing lost.** 41 audit rows before and after, 6 users, 2 companies. Of the 41 rows, **7 recovered attribution** from evidence already embedded in `details->>'company_id'`; the remaining **34 stay NULL and are withheld from every admin** rather than being assigned to a guessed company — the fail-closed behaviour the migration was designed for, now confirmed on real data.

**No regression:** a definer-owned audit insert still succeeds and is auto-attributed by the new column default; a VIEWER still reads exactly their own user row; the anon boundary still returns `42501` after a PostgREST schema reload. The smoke transaction was rolled back and left **0** rows.

Recorded in `supabase_migrations.schema_migrations` as version `20260910000000` (ledger now 80 entries) so a future `db push` will not re-run it. Pre-change policy definitions are captured in `pre-change-policies.json` for rollback.

## 2. THE VULNERABILITIES AS FOUND (now fixed — see 2a)

The two defects found and fixed this session in `20260910000000_audit_log_and_users_company_isolation.sql` are **live in production right now**. Verified by reading the actual policy expressions from `pg_policy`:

```
[PERMISSIVE/r] users     :: users_read_self_or_admin
     USING ((id = ( SELECT auth.uid() AS uid)) OR is_admin())
[PERMISSIVE/r] audit_log :: admin_read_audit_log
     USING is_admin()
```

Both are byte-for-byte the vulnerable forms. `audit_log.company_id` **does not exist** in production (column count 0), and `user_is_member_of_active_company` **does not exist** (function count 0).

**This is exploitable on real data, not a theoretical finding:**

| Fact | Value |
|---|---|
| Companies | 2 (both active) |
| Users | 6 |
| Memberships | 8 |
| Users belonging to exactly one company | **4** |
| Company A members | 2 (ADMIN, MANAGER) |
| Company B members | 6 (ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER) |
| `audit_log` rows | 41 |
| ADMIN memberships | 2 |

Membership is **disjoint** and each company has its own ADMIN. So company A's admin can currently read company B's user rows (email, name, role, status, last_login) and all 41 audit rows including `old_value`/`new_value`.

---

## 3. Migration drift: production is materially behind the repository

Repository: **97** migrations. Production ledger: **79**.

Matching by name (the squash re-timestamped many files), the drift resolves to:

- **18** repo migrations already applied under a *different* version number — same content, renumbered by the canonical squash. Not a real gap.
- **27** migrations **truly not applied to production**, listed in `not-applied-to-production.txt`.
- **27** production entries absent from the repo — all but two are the pre-squash originals of those same 18; the historical originals are expected to differ post-squash.

The 27 unapplied migrations are the entire owner-financial reconstruction chain (`20260909000000`–`20260909000021`), the portal/permission/tax hardening from `20260904*`, and this session's security fix.

Corroborated structurally rather than trusting the ledger:

| Object | Production |
|---|---|
| `rpt_owner_statement` | present |
| `s09_apply_correction` | present |
| `is_admin_or_manager` | present |
| `user_is_member_of_active_company` (SEC-003 fix) | **absent** |
| `audit_log.company_id` (SEC-004 fix) | **absent** |
| `owner_expense_allocations` (migration 18) | **absent** |
| `owner_balances` columns at `numeric(18,3)` | **0 of 7** |

**Money precision on production is not OMR-correct.** Across money-named columns: 42 are `numeric(18,3)`, but **27 are unconstrained `numeric`, 11 are `numeric(14,2)`, 7 are `numeric(14,3)`, 2 are `numeric(14,4)`, 2 are `numeric(18,6)`**, plus assorted others. The `numeric(14,2)` group cannot represent a baisa (3rd decimal) at all.

---

## 4. What is NOT proven

- **Hosted concurrency / Web Locks / bootstrap stall.** Not exercised. The bootstrap defect still needs authenticated e2e credentials; a management token does not provide a browser session.
- **Behaviour of the 27 unapplied migrations on production data.** They are proven against a clean local replay only. Applying them to a database carrying 41 audit rows and live financial history is a separate, authorized exercise requiring a backup and a rehearsal on a restored copy.
- **Whether the two live leaks were ever actually exploited.** Determining that requires log analysis outside this repository.

---

## 5. Standing recommendation

The two policy fixes are small, additive, forward-only and idempotent (verified: re-applies cleanly 3×). They are the highest-value change available and are **not** coupled to the 26 financial migrations — `20260910000000` touches only `users`/`audit_log` policies plus one new predicate function, and depends on nothing from the `20260909*` chain.

Applying the financial chain to production is a much larger decision: it alters money-column precision on tables that already hold posted history, and must not be done without an authorized backup, a rehearsal against a restored copy, and an accounting review of the precision migration's view capture/restore.

---

## 6. Financial chain apply — 20 of 27 applied, then a HARD STOP at a real drift

The user authorized applying the remaining chain, stating all current production data is test data. Each migration was applied atomically and recorded in `supabase_migrations.schema_migrations` only on success.

**Applied successfully (20):** `20260901000069`, `20260904000000`–`20260904000002`, `20260909000000`–`20260909000014`, plus `20260910000000` (security) and `20260910000001` (new, see below).

Ledger went **79 → 98**. **Zero data change**: every row count is byte-identical to the pre-apply baseline (`pre-financial-baseline.json`) — journal_batches 26, journal_lines 70, owner_balances 5, expenses 4, contracts 16, invoices 14, properties 7, units 19, contract_balances 12, bank_accounts 1, utility_bills 4, audit_log 41, users 6. Security posture re-verified after the halt: 0 RLS-disabled tenant tables, 0 definers without `search_path`, 0 anon grants, 0 views not `security_invoker`.

### The systemic cause: anchor-based patching vs. a rewritten migration

**24 migrations in this repository modify existing functions by string-patching the output of `pg_get_functiondef()`** against exact-text anchors. That technique assumes the stored function text matches the repository byte-for-byte. On the hosted database it frequently does not, because the hosted database applied the **pre-squash originals** while the repository files were later rewritten.

This is an **immutable-migration violation**: e.g. repo commit `8258c528` edited `20260901000038` *after* production had already applied it. The rule "a merged migration is immutable; fixes are new forward migrations" exists precisely to prevent this, and the divergence is the cost of having broken it.

**Case 1 — `20260909000012` (RESOLVED).** Aborted at `OWNER_EXPENSE_MAINTENANCE_CONTRACT_PRECONDITION`; 4 of its 5 anchors did not match. Proven to be **whitespace-only**: stripping all whitespace from the hosted and repository definitions of `close_maintenance_with_expense` yields the identical 3165 characters (hosted `'charged_to',v_charged_to,` vs repo `'charged_to', v_charged_to,`). Fixed by new migration **`20260910000001_normalize_maintenance_close_anchors.sql`**, which restores the canonical text. Its body was **captured mechanically from a clean replay**, not hand-written — an earlier hand-written attempt was caught by its own verification step as wrong and discarded. It refuses to act unless the hosted body is whitespace-identical to the canonical text, and returns quietly when the 6-arg overload is absent, so it is order-independent and a no-op on a fresh chain. After applying it, all 5 anchors matched and `...012`, `...013`, `...014` applied cleanly.

**Case 2 — `20260909000015` (NOT RESOLVED, correctly halted).** Aborts at `OWNER_PAYOUT_CASH_MATCH_PRECONDITION`. This one is **not** cosmetic: the hosted `process_bank_reconciliation_match_atomic` is **12,961 chars vs the repository's 16,662**, and genuinely lacks the `20260901000033` fail-closed hardening (`OWNER_PAYOUT_NOT_PAID`, `RECONCILIATION_ENTITY_COMPANY_MISMATCH`, the `net_payable` company/status read). Production applied three smaller pre-squash migrations (`20260824060415/060451/060503`, ~28 KB total) where the repository now carries one 35 KB `20260901000033`.

Attempting to apply repo `20260901000033` **also** aborted, at `RC1_WP05_CASH_FLOW_GUARD_ANCHOR_NOT_FOUND` — a *nested* anchor guard, one level deeper. **Work stopped there rather than improvising further.**

### Why the stop is the correct outcome

Every guard that fired did its job: each refused to patch a function whose text it did not recognise, and each aborted its transaction leaving no partial state. Forcing past them would mean either weakening the guards or hand-reconstructing production function bodies — both of which would risk silently dropping real authorization logic (`20260901000033` is exactly the fail-closed reconciliation hardening). That is not a safe unattended action on a database, even one holding test data.

### Remaining: 7 migrations

`20260909000015`, `...016`, `...017`, `...018`, `...019`, `...020`, `...021` — the owner payout/position/statement authority, the co-ownership allocation pair, and both OMR precision repairs. Production therefore still has **`owner_balances` at 0 of 7 columns in `numeric(18,3)`** and the 7 `numeric(14,2)` money columns that cannot represent a baisa.

**Recommended path (not taken unattended):**
1. Reconcile `process_bank_reconciliation_match_atomic` first, the same way `20260910000001` reconciled the maintenance function — but only after diffing the hosted body against repo `20260901000033` **statement by statement**, since this is real logic drift and a whitespace-equality proof is not available.
2. Re-run the nested `RC1_WP05` guard's own anchor check and resolve it the same way.
3. Then apply `...015` through `...021` in order.
4. Because these are anchor-patches over drifted text, each step needs its own before/after verification rather than a bulk apply.

The deeper fix is to stop rewriting merged migrations. While the repository and the hosted database disagree on the text of already-applied functions, every future anchor-based migration is at risk of the same halt.
