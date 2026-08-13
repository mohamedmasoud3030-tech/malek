# WP-DB0 — Database Stabilization & Contract Freeze

> **Status:** Engineering COMPLETE for the repository-provable scope; hosted/live
> application PENDING (see §8).
> **Scope baseline:** `main@d1016c87` (after PR #1446).
> **Owns:** the data contract — migrations, schema, generated types, services,
> RPC calls, RLS.

## 1. Why this work package exists

Before WP-DB0, "the schema" existed in four places that were never mechanically
compared:

| Layer | Where it lived | How it drifted |
|---|---|---|
| Migrations | `supabase/migrations/*.sql` | 228 files, many fixing symptoms of earlier files |
| Actual schema | the live Supabase project | never inspected as an artifact |
| Types | `rentrix-app/src/types/database.ts` | **hand-written**, not generated |
| Usage | `.from()` / `.rpc()` call sites | discovered only when a page broke |

`supabase/migrations/README.md` states the problem plainly: the presence of a
migration in the repository does not prove the live schema matches it.

The result was the pattern this work package ends: a page breaks, someone adds
a migration for that symptom, the types are hand-edited to match, and the next
page breaks somewhere else.

**The rule from now on: the frontend follows the frozen contract. A page does
not get to invent a schema.**

## 2. What replaced the guesswork

WP-DB0 introduces a toolchain that turns each layer into an inspectable
artifact and diffs them. It runs entirely offline in an ephemeral PostgreSQL
(PGlite, PostgreSQL 18 compiled to WASM), so it needs **no hosted database and
no paid Supabase Database Branching**, and it never touches the live project or
its demo data.

| Command | Gate |
|---|---|
| `pnpm db0:replay` | Migration chain applies to a clean database |
| `pnpm db0:idempotency` | Re-running the WP-DB0 migrations is a no-op |
| `pnpm db0:check-types` | `database.ts` matches the migrations |
| `pnpm db0:contract` | Frontend/service/RPC usage matches the schema |
| `pnpm db0:isolation` | RLS, company isolation, FK and definer integrity |
| `pnpm db0:audit` | Full reality audit; writes `.db0-artifacts/` |
| `pnpm db0:gate` | **All of the above — this is the CI gate** |

`scripts/db0/bootstrap.sql` recreates only the Supabase *platform* preamble
(roles, `auth`/`storage` schemas, `auth.uid()`/`auth.jwt()`), so the repository
migration chain replays completely unmodified.

## 3. Database reality (measured, not assumed)

Replaying all 229 migrations into an empty database produces:

| Object | Count |
|---|---:|
| Tables | 89 |
| Columns | 1,292 |
| Views | 10 |
| Functions / RPCs | 255 |
| Enums | 4 |
| Foreign keys | 178 |
| Constraints | 1,054 |
| Triggers | 95 |
| RLS policies | 204 |
| Indexes | 293 |

The hand-written `database.ts` described **42 tables, 0 views, 65 functions and
0 enums** — under half the tables and a quarter of the functions.

## 4. The contract matrix and what it found

`pnpm db0:audit` classifies every mismatch. At the WP-DB0 baseline it reported
**328 findings, 37 of them blockers**. After the corrections in §5 and §6:
**47 findings, 0 blockers**, and the 47 are a single accepted class (§7).

| Class | Meaning | Baseline | Now |
|---|---|---:|---:|
| `DB0-01/01E` | Frontend selects a column that does not exist | 12 | 0 |
| `DB0-02/02B/C/D` | Relation/column present in one layer only | 114 | 0 |
| `DB0-03/03B` | RPC present in one layer only | 131 | 0 |
| `DB0-05/05B` | RPC signature drift / ambiguous overload | 0 | 0 |
| `DB0-06/06E/06N` | Scalar, enum or nullability drift | 29 | 0 |
| `DB0-07` | Financial precision not 3dp | 47 | 47 *(accepted — GAP-009)* |
| `DB0-08/08F` | Company isolation / FK integrity | 6 | 0 |
| `DB0-09/09A/09C/09E` | Unresolvable or ambiguous PostgREST embed | 6 | 0 |

## 5. Root-cause corrections (one migration, not twenty)

All schema corrections are in a single forward-safe, idempotent migration:
`supabase/migrations/20260815000000_wp_db0_contract_freeze_corrections.sql`.

### C1 — Six-role authorization was physically impossible *(blocker)*

`20260811120000_wp01_six_role_authorization_foundation.sql` added a CHECK
constraint listing six roles, but `users.role` is the `user_role` **enum**,
which only ever had four labels. A CHECK constraint cannot widen an enum.

Proven with `node scripts/db0/probe-role-enum.mjs`:

```
before:  user_role enum labels : [ADMIN, MANAGER, USER, ACCOUNTANT]
         NOT STORABLE OPERATIONS -> invalid input value for enum user_role
         NOT STORABLE VIEWER     -> invalid input value for enum user_role
         Result: 4/6 canonical roles are physically storable.

after:   Result: 6/6 canonical roles are physically storable.
```

WP-01's OPERATIONS and VIEWER roles could never have been assigned. The
migration adds the missing enum labels; the probe is now a permanent gate.

### C2 — `cost_centers` leaked across companies *(blocker)*

The table has `company_id` with an FK to `companies`, but both policies
authorised on role alone (`is_admin_or_manager()`, `is_app_user()`) with **no
company predicate** — any user of company A could read, and any manager could
mutate, company B's cost centres. Policies are replaced with company-scoped
equivalents, and `costCenterService` now stamps the active company on writes
(it previously inserted no `company_id` at all).

### C3 — `document_reference_sequences` fail-closed intent made explicit

RLS enabled, zero policies, and no FK to `companies`. The deny-all was
intentional (only the SECURITY DEFINER writer touches it) but indistinguishable
from an oversight. Now an explicit deny-all policy plus the missing FK.

### C4 — Unresolvable PostgREST embed

`maintenance_records.service_provider_category_id` was reachable only through a
composite FK, which PostgREST cannot use as an embed hint, so
`category:service_provider_category_id(id,name)` could not resolve — the call
site hid this with `as any`. A single-column FK is added; **the composite FK is
kept**, because that is what makes a cross-company category assignment
unrepresentable.

### C5 — View bypassed RLS

`vw_active_owner_agreements` was the only view without `security_invoker`, so
it read with the definer's privileges.

## 6. Frontend/backend alignment

`database.ts` is now **generated from the migration chain**
(`pnpm db0:gen-types`) and marked `DO NOT EDIT BY HAND`. It recovers full
fidelity that a naive generator loses: literal unions from single-column CHECK
constraints (58 of them), enum labels, FK `Relationships`, nullability, and
correctly-nullable RPC arguments.

Adopting it surfaced 85 real type errors. All are fixed at the source, with
**no new casts or `as any`**; several removed existing ones:

- `invoiceService` / `tenantWorkspaceService` — helpers typed their parameter as
  `ReturnType<typeof supabase.from>` (a *query* builder), which has no `.in()`
  or `.or()`. Corrected to constrain the *filter* builder actually passed in.
- `journalService` — the `list_journal_batches` mapper silently dropped
  `posting_date` and `late_posting`, columns the late-posting contract
  (`20260807173000`) depends on.
- `companySettingsService` — local fallback row was missing NOT NULL `company_id`.
- `contract-form-modal` / `useContractForm` — normalise stored contract status
  before loading it into a canonical form.
- e2e fixtures — updated to satisfy the real row contracts.

## 7. Accepted, governed exception

`scripts/db0/contract-baseline.json` pins exactly one accepted class. The gate
fails if the count rises, and any *new* finding class fails immediately.

**DB0-07 — 47 financial columns are `numeric(_,2)`, not 3dp** (PRD-004,
FIN-013, **GAP-009**, owned by **WP-02**).

Deliberately **not** fixed here: widening these is a data conversion over posted
financial history requiring accounting sign-off and a reconciliation plan —
precisely the kind of change this freeze exists to keep out of unrelated
migrations. The authoritative GL (`journal_batches` / `journal_lines`) is
already `numeric(18,3)`; the 47 are subledger and snapshot columns.

Also deferred, for the same reason: `contracts.status` still permits the legacy
spellings `ACTIVE`/`ENDED` beside the canonical lowercase set. Narrowing the
CHECK would reject existing live rows. `@/lib/contractStatus` remains the
single normalisation point, and the type system now enforces its use.

## 8. Verification actually performed

| Check | Result |
|---|---|
| `pnpm db0:gate` (6 gates) | **6/6 PASS** |
| Migration chain, clean DB | 229/229 applied, 0 failures |
| Idempotency (re-run) | Schema fingerprint identical |
| Schema/type drift | `database.ts` matches migrations |
| Contract drift | 0 blockers; 47 accepted (GAP-009) |
| RLS/company isolation | 76 tenant tables, 204 policies, 0 violations |
| Six-role probe | 6/6 storable |
| `pnpm typecheck` | PASS (0 errors) |
| `pnpm lint` | PASS |
| `pnpm test` | 2,534 passed |
| Gate negative-tests | Injected type drift and a bogus column were both caught |

**Not performed — and not claimed:** nothing was applied to, or read from, the
live `nnggcnpcuomwfuupupwg` project. The sandbox blocks TLS egress to
`*.supabase.co`, so live verification must run in CI/hosted QA (§9). Every
number above is from the migration chain replayed locally, which is exactly the
distinction `supabase/migrations/README.md` warns about: **this proves the
repository is internally consistent, not that the live schema matches it.**

## 9. Applying to the live project

The corrective migration is forward-safe, idempotent, and preserves demo data.
It performs no destructive operation: no `DROP TABLE`, no `DELETE`, no reset.
Every statement is guarded, and each data-dependent change (NOT NULL, new FK)
is skipped if existing rows would violate it, so a partial live schema degrades
gracefully instead of failing the deploy.

```bash
supabase link --project-ref nnggcnpcuomwfuupupwg
supabase db push          # applies 20260815000000_wp_db0_contract_freeze_corrections.sql
pnpm qa:database-contracts
```

Then confirm the live schema matches the frozen contract by running
`pnpm db0:gate` in CI against the pushed state.

## 10. Keeping the contract frozen

> **Action required — one manual step.** The CI wiring could not be pushed from
> this session: the GitHub App token lacks the `workflows` permission, so it is
> refused from modifying `.github/workflows/`. The exact change is saved as
> [`wp-db0-ci-gate.patch`](wp-db0-ci-gate.patch) and must be applied by a
> maintainer for the freeze to be enforced automatically:
>
> ```bash
> git apply docs/database/wp-db0-ci-gate.patch
> git commit -am "ci: run WP-DB0 database integrity gates"
> ```
>
> Until it is applied, `pnpm db0:gate` still passes locally but nothing blocks a
> future PR from reintroducing drift.

Once applied, CI (`.github/workflows/ci.yml`) runs `pnpm db0:gate` on every PR.
From now on:

1. Change the schema **only** by adding a migration.
2. Run `pnpm db0:gen-types` and commit the regenerated `database.ts`.
3. Update services to the new contract.
4. A change that alters the contract shows up as a **reviewable diff in the
   generated types**, not as a surprise migration in the middle of a page fix.

A new drift class can never be introduced silently, because anything not listed
in `contract-baseline.json` is allowed **zero** occurrences.
