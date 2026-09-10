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

---

## 7. CHAIN FULLY APPLIED — and a correction to section 6 (2026-09-10, later same day)

**Outcome: production ledger 98 → 108 rows. Zero unapplied migrations remain. Zero rows of data changed.**

Section 6 above is preserved as the honest record of what was known at the time, but **two of its conclusions were wrong**. Both are corrected here.

### 7.1 Correction: "Case 2 is real missing logic" — partly wrong

Section 6 claimed the two `20260909000015` anchor needles were absent from production. **They were present.** The error was methodological: production renders `pg_get_functiondef` output **without spaces after commas**, so an exact-string `grep` for `select s.net_payable, s.company_id, ...` scored 0 against a body that contained that exact logic. Re-testing whitespace-normalized found **both needles exactly once each.**

**Lesson (now a standing rule): never conclude logic is missing from a hosted function by exact-string grep. Normalize whitespace first.** A raw byte-length delta is likewise not evidence of drift — the 12,961 vs 16,662 gap was mostly formatting.

### 7.2 Correction: `wp05_rpt_cash_flow_gl` — production was AHEAD, not behind

The nested `RC1_WP05_CASH_FLOW_GUARD_ANCHOR_NOT_FOUND` guard was not drift. Production's `public.wp05_rpt_cash_flow_gl(date,date)` is only **323 chars** because migration `20260901000064` **moved** the function to `app_private` and renamed it `financial_cash_flow_gl_core`; the public name is now a thin wrapper. The relocated body (5,346 chars) **already contained byte-identical hardened text** to what `20260901000033`'s DO block intended to install — no `current_user` branch, guard reads `if public.current_company_id() is null or public.current_company_id() <> v_company_id then raise 'WP05_COMPANY_ISOLATION_VIOLATION'`. The objective was already satisfied; only the anchor lookup was stale.

**Lesson: before repairing a failing anchor, check whether a later migration moved or renamed the target.**

### 7.3 The drift that WAS real, and how it was fixed

Statement-level diff (whitespace-stripped, split on `;`) of `process_bank_reconciliation_match_atomic`: repo **156** statements vs production **132**, with **14 present only in the repo** —

- 11 × `Cross-company <entity> match rejected.` guards (`42501`)
- 2 × duplicate-match guards, receipt and expense (`23514`)
- 1 × the enriched `audit_log` write carrying `old_value` / `new_value`

Production contained **zero** occurrences of `Cross-company`. **Mitigating factor:** all 8 hosted entity lookups were already scoped `and <alias>.company_id = v_company_id`, so the missing guards were defence-in-depth rather than an open cross-company door. No evidence of exploitation; no data anomaly found.

**Fix:** `supabase/migrations/20260910000002_rc1_bank_reconciliation_hardening_forward_carry.sql` — a *forward-carry*, not an edit to the merged migration. It reproduces lines 1–776 of `20260901000033` **verbatim (copied by line range, never retyped)**, omitting only the obsolete wp05 DO block at 777–798 and its three trailing grants, re-wrapped in a single `begin;`/`commit;`.

Verified after apply: function now **16,655 chars** with **10 cross-company guards**; both `...015` needles match exactly once.

### 7.4 Ledger repair: two silently-missing rows

`20260909000012` and `20260909000014` had executed successfully — every schema effect present (`expense_owner_allocations`, `expenses.owner_allocation_version`, `guard_expense_owner_allocation`, the 8-arg `close_maintenance_with_expense`, the settlement quote fn) — but **their `schema_migrations` rows were absent.** Cause: both files contain `$s$`, which collided with the dollar-quote tag used by the recording step, so the bookkeeping INSERT failed while the DDL had already committed. Rows were re-inserted using base64 encoding to make the tag collision impossible.

**Lesson: executing migration SQL is not applying a migration — the ledger row must be confirmed, not assumed.**

### 7.5 Final verification

Repo carries **99** migration files; hosted ledger has **108** rows. Matching by version **and** name: **0 truly unapplied.** 18 repo files are recorded under earlier renumbered (pre-squash) versions; 27 ledger rows are pre-baseline squashed history with no repo file. Both sets are expected.

**Data integrity — every row count identical to `pre-financial-baseline.json`:**
journal_batches 26 · journal_lines 70 · owner_balances 5 · expenses 4 · contracts 16 · invoices 14 · properties 7 · units 19 · contract_balances 12 · bank_accounts 1 · utility_bills 4 · audit_log 41 · users 6.

**OMR precision now correct** — `numeric(18,3)` on `contract_balances.total_paid` / `total_invoiced` / `balance_due`, `bank_accounts.opening_balance`, `units.rent_amount`, `utility_bills.paid_amount`, `properties.purchase_value`, and all 4 `owner_balances` money columns. Deliberately left at scale 2: `properties.current_value` (a valuation) and `utility_bills.current_reading` (a meter reading) — neither is OMR ledger money. **Corrected in §8.4:** the complete scale-2 set is 7 columns, not 2; this line undercounted by filtering on `(14,2)` only. All 7 are non-money (rates, hours, valuation, meter readings) and identical in repo and production.

**Security sweep:** 107 tenant tables · **0** RLS-disabled · 260 policies · **0** SECURITY DEFINER functions missing `search_path` · **0** anon grants · **0** non-`security_invoker` views.

**Local gates at this commit:** replay **99/99** · `db0:gate` **7/7** · typecheck clean · migration-hygiene OK · business-rules `v2.0.0 382a0b8c00bb605be0e6e5e2310f7f8ee3c59d584b3a7468a6b49ecaa5e74a79` (unchanged) · guardian **PASS 4/4**.

### 7.6 Still NOT proven

- Runtime behaviour of the newly-applied migrations under **real traffic** — applied and structurally verified, not exercised.
- Hosted **concurrency / Web Locks**.
- The **intermittent bootstrap stall** (still needs `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`).
- Whether the two live leaks were **ever exploited** (no historical access logs available).
- All of **Priority 1** — migration16 owner financial position and the professional document — untouched by this work.

> **Credential hygiene:** the Supabase access token and GitHub PAT used for this session were held in-process only and were never written to any file. **Both should now be revoked.**

---

## 8. FULL REPO↔PRODUCTION PARITY PROOF (2026-09-10, later)

Section 7 proved the *ledger* was complete. This section proves the *schema itself* agrees, which is the stronger claim and the one that actually matters.

### 8.1 Method

A raw `pg_get_functiondef` hash is useless for this comparison: production stores minified bodies (comments stripped, whitespace collapsed), so 26 functions looked different while being identical code. The comparison therefore normalizes **comments, all whitespace, semicolons, and `public.` schema prefixes**, then hashes, on both sides, for every function in `public` + `app_private`.

### 8.2 Result — zero drift

| Check | Repo (clean replay) | Production | Verdict |
|---|---|---|---|
| Functions compared | 431 | 432 | — |
| **Semantically different** | — | — | **0** |
| Present only in production | — | 1 | benign (below) |
| Columns at `numeric(18,3)` | 74 | 74 | identical |
| Columns at scale 2 | 7 | 7 | identical set |

The 26 raw-text differences — including `custom_access_token_hook` (JWT claims), `role_has_app_permission`, `update_tenant_balance`, `guard_journal_line_rc1_revenue_scope` and `wp05_reconcile_all` — are **entirely** comments/formatting. Worked examples: `wp05_reconcile_all` differs only by `current_company_id()` vs `public.current_company_id()`; `role_has_app_permission` differs by **one trailing semicolon** after `end`.

**`custom_access_token_hook` is byte-equivalent after normalization.** This is the function that mints JWT claims, so its parity is the most security-relevant single result here.

### 8.3 The one production-only function is not drift

```sql
CREATE OR REPLACE FUNCTION public.wp05_rpt_cash_flow_gl(p_from date, p_to date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_cash_flow_gl_core(p_from, p_to);
end; $function$
```

It is the permission wrapper left behind when `20260901000064` relocated the body to `app_private` (§7.2). It **adds** an authorization check, is `SECURITY DEFINER` with a pinned `search_path`, and **no application code calls it** (`grep` over `rentrix-app/src/` returns nothing). Production is ahead here, not divergent.

### 8.4 Money precision — earlier note corrected

§7.5 said "only 2 `numeric(14,2)` remain". That undercounted because it filtered on `(14,2)` specifically. The complete scale-2 set is **7 columns**, identical in repo and production, and **none is OMR ledger money**:

| Column | Type | Why scale 2 is correct |
|---|---|---|
| `company_settings.vat_rate` | `numeric(5,2)` | percentage rate |
| `invoices.tax_rate` | `numeric(5,2)` | percentage rate |
| `maintenance_records.response_time_hours` | `numeric(10,2)` | duration in hours |
| `properties.current_value` | `numeric(14,2)` | valuation, not a ledger posting |
| `utility_bills.consumption_units` | `numeric(14,2)` | metered units |
| `utility_bills.current_reading` | `numeric(14,2)` | meter reading |
| `utility_bills.previous_reading` | `numeric(14,2)` | meter reading |

All **74** true money columns are `numeric(18,3)` on both sides. The OMR 3-decimal (baisa) requirement is met.

### 8.5 `rpt_owner_statement` authority — independently re-verified on both sides

Probed the deployed body rather than trusting the inventory note. Identical on both (4,519 chars):

| Probe | Repo | Production |
|---|---|---|
| legacy `s.date` | 0 | 0 |
| legacy `s.amount` | 0 | 0 |
| `owner_settlement_paid_cash` | 3 | 3 |
| `s.paid_at` | 3 | 3 |
| `_owner_statement_expenses` | 1 | 1 |

Settlement movements key on `paid_at`, value on **proven cash**, and the `status='PAID' and paid_at is not null` filter means a CANCELLED settlement is no longer presented as a deduction. The three defects recorded in commit `8d1d5e75` are closed in both places.
