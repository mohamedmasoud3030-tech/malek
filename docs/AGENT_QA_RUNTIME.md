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
