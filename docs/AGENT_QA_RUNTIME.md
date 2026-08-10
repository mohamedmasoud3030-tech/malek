# Agent QA Runtime

This repository supports an agent-operated hosted QA environment. It gives an
agent enough access to prove the real application, Auth, RLS, API contracts,
and financial lifecycle without using Production data or credentials.

## One-time environment setup

Create a separate Supabase project for QA, apply the same migrations as this
repository, and give it a distinct Vercel QA deployment. Do not reuse the
Production project reference.

In the agent runtime / CI secret store (not GitHub files), provide the values
listed in [`.env.qa.example`](../.env.qa.example). `QA_SUPABASE_PROJECT_REF`
and `PRODUCTION_SUPABASE_PROJECT_REF` are both mandatory and must differ; the
commands stop before contacting Supabase if that boundary is not proven. The
required roles are:

| Account | Purpose |
| --- | --- |
| `QA_ADMIN_*` | Auth, membership, RLS, and read-only application probes. |
| `E2E_SINGLE_OFFICE_*` | Disposable seed identity for the mutating financial lifecycle. |
| `SUPABASE_SERVICE_ROLE_KEY` | QA-only seed reset. It is never bundled into the browser. |
| `SUPABASE_DB_URL` | QA read-only schema/migration inspection. |

The QA project must have the same Auth custom-token hook and app metadata
contract as Production: an active membership and a `company_id` claim are
required for `current_company_id()` and RLS.

## Agent commands

```bash
# Authenticated, read-only: confirms the exact QA project, logs in, proves the
# active company/membership, and probes the core table contracts.
pnpm qa:preflight

# Read-only schema/RPC/RLS inspection through the approved QA DB credential.
pnpm qa:database-contracts

# Explicitly mutating, QA-only: seed -> browser payment/receipt/void -> verify.
# It refuses Production refs and requires QA_MUTATION_APPROVED=1.
pnpm qa:lifecycle
```

## Autonomous agent loop (required for affected work)

This runtime is for the coding agent's own repair loop, not merely a CI gate.
For any route, form, client/server mapping, authentication, permission, or
financial workflow it changes, the agent must:

1. Run the app locally or open the matching QA/preview deployment.
2. Drive the real route with its available browser automation. Check the
   rendered screen at desktop and mobile widths, console errors, failed network
   requests, route transitions, and both success and recoverable-error states.
3. Where the route relies on Supabase, run `pnpm qa:preflight` and
   `pnpm qa:database-contracts` against the separate QA project before assuming
   a frontend defect. These detect an incorrect deployed URL, Auth/JWT/company
   membership problems, RLS/API failures, and frontend-to-schema/RPC drift.
4. For the disposable invoice -> payment -> receipt -> void journey only, set
   `QA_MUTATION_APPROVED=1` in the QA secret runtime and run
   `pnpm qa:lifecycle`. It seeds and verifies QA only; it deliberately refuses
   Production.
5. If the browser or contract check exposes a defect, trace UI -> service/map
   -> RPC/API -> database, repair it, then re-open and re-run the same scenario.
   Do not report the task complete before the observed failure is rechecked or
   recorded as a real external blocker.

The agent should retain Playwright trace/screenshot/report artifacts on a
failure and include their result in its handoff. Browser automation may be
Playwright or an available browser-control integration; the required outcome is
an actual inspected application, not a claim inferred from source code.

## GitHub execution path

Use **Hosted QA Verification** when the QA secrets are held in GitHub rather
than in an interactive agent runtime. Every dispatch first runs the read-only
Auth/API/schema/RLS proof. The `run_financial_lifecycle` input defaults to
false; setting it to true is the separate, explicit authorization for the
disposable QA invoice → payment → receipt → VOID journey. It cannot target
Production because the same project-reference equality and exact-URL guards
run before any browser or seed action.

The GitHub environment must expose these QA-only secrets:

| Secret | Used for |
| --- | --- |
| `QA_SUPABASE_PROJECT_REF`, `QA_SUPABASE_URL`, `QA_SUPABASE_ANON_KEY` | exact QA identity and browser/API connection |
| `PRODUCTION_SUPABASE_PROJECT_REF` | comparison-only Production boundary |
| `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD` | read-only Auth/RLS/API proof |
| `QA_SUPABASE_DB_URL` | read-only PostgreSQL catalog contract |
| `QA_SINGLE_OFFICE_EMAIL`, `QA_SINGLE_OFFICE_PASSWORD`, `QA_SUPABASE_SERVICE_ROLE_KEY` | disposable QA lifecycle only |

`qa:lifecycle` is repeatable: it uses fixed QA-only identifiers and validates
the final invoice, receipt, journal, idempotency, and report state. It must
never target Production. The command is intentionally stopped by default until
the caller explicitly sets `QA_MUTATION_APPROVED=1` in the secret runtime.

Before configuring a hosted environment, run the guard tests locally:

```bash
pnpm test:qa-runtime
```

## What an agent can now prove without manual database inspection

1. The supplied URL belongs to the declared QA project, not Production.
2. QA credentials can sign in and resolve an active tenant company.
3. Authenticated RLS/API reads for properties, units, contracts, invoices, and
   receipts match the deployed schema.
4. The QA database exposes every table, key column, RPC, RLS policy, and
   `SECURITY DEFINER` financial-write boundary required by the application.
5. The isolated single-office dataset supports a real invoice -> payment ->
   receipt -> void -> report lifecycle and remains financially balanced.

`qa:database-contracts` opens a `BEGIN READ ONLY` transaction and fails on
schema drift, missing RPCs, disabled/missing RLS boundaries, or a financial RPC
that is no longer `SECURITY DEFINER`. It never writes application or migration
data. `qa:lifecycle` runs this check automatically before its approved browser
journey.

For a new QA project, run the repository migration process first, then
`pnpm qa:preflight`; only run `pnpm qa:lifecycle` after the preflight succeeds.
