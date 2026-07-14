# TICKET: &lt;Title&gt; (&lt;FGR-ID if applicable&gt;)

- **Slug**: `&lt;kebab-case-slug&gt;`
- **Area**: `&lt;financials | contracts | owners | …&gt;`
- **Priority**: P0 / P1 / P2
- **Status**: Draft
- **Related FGR**: FGR-XXX
- **Related ADRs**: `docs/decisions/XXXX-*.md`
- **Related Skills**: comma-separated list
- **Wave**: 1 / 2 / 3 / 4

---

## Context

&lt;Why this feature exists, what problem it solves, which docs/ADRs constrain it.
Quote the ADR where relevant — do not paraphrase business rules.&gt;

## Business Rules (verbatim from ADRs)

1. **Rule 1** — …
2. **Rule 2** — …
3. …

## Out of Scope

- … (explicit list to prevent gold-plating)

## Existing code to extend / imitate

- Migrations: `supabase/migrations/&lt;existing-similar-file&gt;.sql`
- Services: `rentrix-app/src/features/&lt;area&gt;/*Service.ts`
- Hooks: `rentrix-app/src/features/&lt;area&gt;/use*.ts`
- Page: `rentrix-app/src/routes/_protected.&lt;similar&gt;.tsx`
- Components: `rentrix-app/src/features/&lt;area&gt;/components/*`

## DB Changes

### New tables

| Table | Key columns | Constraints |
|---|---|---|
| `&lt;table_name&gt;` | id, … | pk, fk, checks |

### New columns (on existing tables)

| Table | Column | Type | Default/Constraint |
|---|---|---|---|

### Indexes

- `&lt;index_name&gt;` on …

### RLS policies

- `&lt;policy_name&gt;`: &lt;SELECT/INSERT/UPDATE/DELETE&gt;, predicate: …

### Atomic RPCs (mandatory for money-moving flows)

| RPC | Purpose | Idempotency key | Audit? |
|---|---|---|---|
| `&lt;rpc_name&gt;_atomic(payload jsonb)` | … | `request_id` | yes |

Each SECURITY DEFINER RPC must:
- `SET search_path = public, pg_temp`
- `REVOKE … FROM PUBLIC, anon` (helpers) / `GRANT … TO authenticated` (UI)
- Use `pg_advisory_xact_lock(hashtextextended(...))` for uniqueness
- Upsert into `financial_operation_idempotency`
- Write an `audit_log` row

### Migrations to add

- `YYYYMMDDHHMMSS_&lt;snake_case&gt;.sql` — …

## Backend / Service Changes

- New service file(s): `features/&lt;area&gt;/services/&lt;thing&gt;Service.ts`
  - Functions: `create…`, `approve…`, `pay…`, `list…`, `get…`
- New hook(s): `features/&lt;area&gt;/use&lt;Thing&gt;.ts`
  - Queries: `use&lt;Thing&gt;(id)`, `use&lt;Thing&gt;List(filters)`
  - Mutations: `useCreate&lt;Thing&gt;`, `useApprove&lt;Thing&gt;`, `usePay&lt;Thing&gt;`
- Type updates: `types/domain.ts`, `types/database.ts` (regenerate after migration with supabase gen types)
- Permission keys added to `features/auth/permissions.ts`:
  - `&lt;area&gt;.&lt;action&gt;`

## Frontend Changes

- Route: `/&lt;route&gt;` (file: `routes/_protected.&lt;route&gt;.tsx`)
- Nav group: **&lt;group name from app-nav-items&gt;** — add entry in
  `app-nav-items.ts` with icon and permission.
- Pages/Components:
  - `&lt;Thing&gt;ListPage` (DataTable with filters: owner, period, status)
  - `&lt;Thing&gt;DetailPage` (header + summary cards + timeline/activity)
  - `&lt;Wizard/Dialog&gt;` (multi-step generation/action form)
- Reuse: `EntityCard`, `EntityForm`, `DataTable`, shadcn `Button`/`Dialog`/`Form`, `useToast`
- Arabic labels (add to `lib/i18n.ts`):
  - `&lt;key&gt;`: "النص العربي"
- Mobile: ensure list actions are accessible via bottom sheet / drawer at 320px.

## Contract Tests to write BEFORE implementation

1. **Id-type contract**: verifies every id column referenced by the RPC is
   the correct type (`text` / `uuid` / `date`).
2. **RLS grant contract**: verifies SECURITY DEFINER helper/UIs functions
   have appropriate grants.
3. **Atomicity contract**: two concurrent calls with the same `request_id`
   produce exactly one row.
4. **Role matrix contract**: ADMIN can do X, MANAGER can do Y, USER cannot do Z.
5. **Business-rule contracts** (one per business rule above): e.g. "office
   fee excluded from deposits", "void reverses fee", "VAT separate line".
6. **Trigger-hygiene contract**: insert into the target table succeeds (no
   missing-column trigger failure).

## Acceptance Checklist

- [ ] Migration files created, named correctly, wrapped in `begin;commit;`
- [ ] `pnpm supabase:migration-evidence` → PASS
- [ ] Atomic RPCs created, secured, idempotent, audited
- [ ] Service layer wraps RPCs with zod validation + error handling
- [ ] Hooks wire up with query invalidation
- [ ] Route + nav item + permissions added
- [ ] UI pages (list/detail/action) implemented with Arabic labels, loading/error/empty states
- [ ] Contract + unit + component tests added and passing
- [ ] If financial: `pnpm --filter ./rentrix-app run test:financials` → PASS
- [ ] `pnpm typecheck` → PASS
- [ ] `pnpm build` → PASS
- [ ] `pnpm e2e` → PASS (new spec added)
- [ ] RTL manual check at 320/768/1280 → PASS
- [ ] Docs updated (CURRENT_STATE, FEATURE_GAP_REGISTER, NEXT, DOMAIN if needed)

## Open Questions

1. …
