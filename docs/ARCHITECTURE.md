# Architecture

## System shape

Rentrix is a single-office rental-property management system.

- Frontend: React + TypeScript + Vite in `rentrix-app/`.
- Routing: TanStack Router.
- Server-state/cache: TanStack Query.
- Local UI state: Zustand.
- Backend: Supabase Auth + PostgreSQL.
- Database behavior: migrations, RLS, triggers, views, and RPCs under `supabase/migrations/`.
- Deployment: Vercel configuration in `rentrix-app/vercel.json`.
- Tests: colocated Vitest suites plus a financial-focused suite.

## Repository sources of truth

| Concern | Source |
| --- | --- |
| Active application | `rentrix-app/` |
| Active database history | `supabase/migrations/` |
| Historical rebuild archive | `supabase/migrations_consolidated/` (read-only) |
| Product description | `docs/PRODUCT.md` |
| Current operational snapshot | `docs/CURRENT_STATE.md` |
| Domain rules | `docs/DOMAIN.md` and decision records |
| Pending work | `docs/NEXT.md` |
| Release gates | `docs/RELEASE_READINESS.md` |
| Engineering policy | `docs/ENGINEERING_GOVERNANCE.md` |
| Production authorization | `docs/GOVERNANCE.md` |
| CI commands | `.github/workflows/ci.yml` and `docs/TESTING.md` |

## Data flow

1. Auth establishes a Supabase session and role claims.
2. Route guards control frontend visibility and navigation.
3. Feature services call Supabase tables or RPCs.
4. RLS and guarded RPCs enforce the backend authorization boundary.
5. Database constraints and triggers preserve relational and financial invariants.
6. TanStack Query refreshes server state after successful mutations.

Frontend guards are usability controls; they do not replace RLS, grants, or RPC authorization.

## Domain identity

- `public.people` is the canonical identity source for tenants.
- Properties, units, owners, contracts, invoices, payments, expenses, and maintenance records remain Supabase-backed.
- The legacy `public.tenants` table must not be used as the canonical target for new financial relationships.

## Contract lifecycle

Contract writes use atomic RPCs for create, update, renew, terminate, and soft delete behavior. The database path protects associated invoices and accounting state, including cancellation of eligible future unpaid invoices while preserving paid history.

## Financial architecture

- Invoice generation creates double-entry journal rows.
- Tenant receivables are debited; rental revenue and VAT payable are credited where applicable.
- Payments debit cash and credit tenant receivables.
- Posted journal entries are immutable.
- Corrections use explicit reversal entries.
- Receipt screens are backed by `public.payments`.
- Collection reports exclude deleted and VOID payments.
- Contract and tenant balance summaries are maintained through guarded database behavior.

Financial correctness belongs in database transactions and RPCs, not a sequence of unrelated client writes.

## Reporting

The reports area currently combines backend RPC-backed reports with service/client aggregation. Any migration from client aggregation to an RPC requires seeded parity tests before the source is switched. Owner/tenant statements, cash flow, VAT, daily collection, arrears, and accounting reports must use status filters consistent with the underlying financial lifecycle.

## Migration architecture

- New active migrations use `<14-digit-timestamp>_<snake_case_name>.sql`.
- Once merged to `main`, migration files are immutable.
- Forward fixes use new migrations.
- Out-of-band history reconciliation uses documented comment-only stubs when the effect already exists.
- A file in the repository is not proof it is applied to a target environment.
- Before release, compare the active directory with `supabase_migrations.schema_migrations` and inspect live definitions.
- `supabase/migrations_consolidated/` is never an active migration destination.

## Quality architecture

The standard verification sequence is:

```bash
pnpm install --frozen-lockfile
pnpm supabase:migration-evidence
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

Database or release work also requires read-only target-environment evidence and authenticated browser verification. See `docs/RELEASE_READINESS.md`.
