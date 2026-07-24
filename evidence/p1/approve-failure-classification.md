# P1 probe archive — approve 42501 in PGlite replay: classification (2026-07-24)

## Symptom
In `release_lifecycle_rehearsal.sql` run through the Docker-free PGlite shim,
assertions #52+ failed with `42501 permission denied for table owner_settlements`
at `approve_owner_settlement_atomic` (and pay/cancel knock-ons). Docker CI on
#1276 passed the same assertions (13/13 checks green).

## Isolation protocol (probes v2–v5, before/after P1 with identical fixture+identity)
- BEFORE replay = main@8cd87a1 (P0 harness + P0 fix applied); AFTER = full chain (P0+P1).
- pg_proc: approve/pay/cancel/create all `prosecdef=true`, owner `postgres` (superuser),
  `search_path=public, pg_temp`, proacl `{postgres,service_role,authenticated}=X`.
- pg_class: `owner_settlements relrowsecurity=true, relforcerowsecurity=true`;
  journal_entries/owner_balances/account_balances/audit_log RLS on, not forced.
- No triggers on owner_settlements; journal triggers all SECURITY DEFINER (postgres).
- Live body extracted from replay = 20260722000002 definer body. Call chain:
  auth.uid()/is_admin_or_manager() (definer) → idempotency select → FOR UPDATE →
  UPDATE (company-scoped) → audit_log insert. No SECURITY INVOKER fn in the path.

## Root cause (category 2 — PGlite-vs-Supabase harness difference)
The failing statements were NOT inside the RPC. The suite's *payload expressions*
(`jsonb_build_object('settlement_id', (select id from public.owner_settlements
where request_id = ...))`) are plain table reads evaluated as `authenticated`.
Real Supabase (Docker `supabase test db`) grants broad table privileges to
`authenticated` and enforces via RLS; the raw PGlite replay never GRANTs
`owner_settlements` to `authenticated`, so the payload subselect fails there
only. Probes proved the RPCs themselves execute perfectly as `authenticated`
(direct AND through an invoker `execute` wrapper; seeded AND fn-created rows).

## Resolution (harness-only; no production change, no grant expansion in migrations)
`src/p1/zz-rehearsal-verify.test.ts` adds Supabase-local-dev default-privilege
parity (`grant select/insert/update/delete on all tables in schema public to
authenticated`, sequences + functions) scoped to THIS gate's ephemeral replay,
with RLS (incl. P0 RESTRICTIVE policies) as the enforcement layer — exactly the
Docker posture. Result: REAL suite file, 65/65 assertions, 0 failures,
0 top-level errors. P0 harness/stub intentionally untouched (its suites encode
the stricter no-grant posture on purpose).

## Before/after proof
probe-v2 ran the same cycle on BEFORE (main) and AFTER (P1): identical posture
and function attrs — no P1 regression; no production defect found. The earlier
"approve failed as postgres too" observation was a probe-side bug (payload lost
its `settlement_id` because the plain-ACL read of owner_settlements is denied
in the no-grant harness — the expected P0 posture).

---

# Appendix B — lifecycle-pay failure: "accounts not configured" (CLOSED 2026-07-24)

## Full error anatomy (directive §1 — not just the last line)
Captured in the failing identity from the full-chain replay
(`evidence/p1/pay-accounts-diagnosis.json`):

- SQLSTATE: **P0001** (raise_exception), severity ERROR, routine `exec_stmt_raise`
- message: `Owner payable or cash accounting account is not configured.`
- detail: none — hint: none
- context: `PL/pgSQL function pay_owner_settlement_atomic(jsonb) line 37 at RAISE`
- identity snapshot: `current_user=postgres session_user=postgres`,
  claims = `{sub: <ADMIN>, role: authenticated, app_metadata.company_id: <diag-co>}`,
  `auth.uid()` = ADMIN, `jwt role` = authenticated, `current_company_id()` = diag-co,
  `current_app_role()` = ADMIN, `is_admin_or_manager()` = true, `is_app_user()` = true.

## Call-chain trace (directive §2; live code, migration 20260722000002)
`pay_owner_settlement_atomic`: auth guard (ADMIN/MANAGER) → idempotency cache →
`select … for update` on `owner_settlements` → status must be APPROVED →
**guard**: `accounts.id where no='2000' and company_id=v_company_id` and same for
`no='1111'` → balanced journal (`journal_entries` DEBIT 2000 / CREDIT 1111, one
batch) → settlement → PAID → `audit_log` → idempotency row.

Probe verdicts on the guard inputs (failing identity):
- `accounts` census: exactly two rows, `id/no` = `1111`,`2000`, both owned by the
  DEMO company `00000000-0000-4000-8000-000000000001` (phase2 backfill).
- Company-filtered lookups for the fixture company return **NULL** → raise.
- `accounts.no` is **globally UNIQUE** (core_schema, never relaxed) → a second
  chart with the same numbers cannot exist.
- `pg_trigger` on `public.companies`: **0** — no trigger provisions a chart for a
  newly inserted company; production leaves provisioning to deployment seeding.
  The guard is therefore production-by-design behaviour for an unprovisioned
  company, with a precise, actionable message.

RLS posture of the touched tables (recorded for the audit trail, not the cause —
the RPC is SECURITY DEFINER owner postgres and bypasses RLS):
`owner_settlements` relrowsecurity=t **relforcerowsecurity=t**,
`journal_entries`/`owner_balances`/`account_balances`/`audit_log`
relrowsecurity=t force=f, all owned by postgres. Triggers on the five tables:
none relevant to the guard. `pay` does not touch `owner_balances`/`account_balances`.

## Before/after on the same data + identity (directive §3)
Full chain (AFTER) vs chain-minus-P1 (BEFORE), same mini fixture, same claims:
- pay failure **byte-identical**: same SQLSTATE, message, and `line 37 at RAISE`.
- `pay` body **md5 `9ad0ef78fd7ff3dd61a73ee73e2a3da4` in BOTH** — P1 never touches pay.
- `calculate_owner_net_payout` exists only AFTER (expected).
- create divergence IS the intended P1 change: BEFORE stores client tuple
  verbatim (net = greatest(1230−150−120−0)=**960**, all client-sent); AFTER stores
  server-derived zeros (`amounts_source: server_derived`) — the probe fixture has
  no collections, and the client's forged tuple is ignored.

## Classification: **fixture-harness gap** (NOT P0-regression, NOT PGlite-vs-Supabase, NOT production defect)
The P1 fixture inserted `('1111','1111',…) ON CONFLICT (id) DO NOTHING` — a silent
no-op against the seeded row — leaving its operating company without the chart the
pay guard requires. Resolution (harness-only, directive §4): the fixture now
assigns the provisioned chart to its operating company
(`update public.accounts set company_id = <company-1> where no in ('1111','2000')`),
documented in-line; zero production-migration changes, zero grant changes, zero
logic changes to satisfy the harness.

## Secondary harness fix (same test, PG semantics)
With pay fixed, two consecutive expected-error assertions inside the rehearsal
`BEGIN/ROLLBACK` block hit `25P02 current transaction is aborted` — real Supabase
executes each RPC in its own request-scoped transaction. Savepoints now reproduce
that isolation (`SAVEPOINT` → expected reject → `ROLLBACK TO SAVEPOINT`), so the
second assertion observes the true guard message (`/controlled reversal/`).

## Final posture
`p1-owner-settlement-integrity.test.ts` **18/18**, incl. full lifecycle
create(1230 derived) → approve(APPROVED, stored-tuple) → pay(PAID, balanced
journal 2 rows, debit=credit=1230, one batch, 3 audit rows) → idempotent replay
(no second financial trace) → cancel lifecycle → paid settlement rejects re-pay
(/APPROVED/) and cancel (/controlled reversal/).
