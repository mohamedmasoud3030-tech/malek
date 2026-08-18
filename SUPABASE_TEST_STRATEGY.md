# Supabase Test Strategy

This is the smallest high-confidence proof system for MALEK's Supabase data
boundary. It does **not** claim the live Production project is tested because
one admin account can query it. Every critical role is proven as both
**allowed** and **denied**.

The product name is MALEK. Technical paths still use the legacy `rentrix`
spelling.

## 1. What must be true

| Risk | Intended truth | Lowest-cost proof |
|---|---|---|
| Cross-company read/write | Company A never sees or mutates Company B | Current-schema PGlite RLS matrix + existing two-company pgTAP |
| Spoofed JWT company claim | `app_metadata.company_id` is not trusted without membership | Auth hook tests in the matrix + `two_company_readiness.sql` |
| Anonymous access | No operational rows, no RPCs, no private files | Matrix `anon` identity + storage smoke in CI |
| Inactive / deleted user | A leftover JWT is not enough | `is_app_user()` / `is_admin_or_manager()` matrix cases |
| Privileged key in the browser | Only the public anon key exists in client code and the built bundle | `test:supabase:secrets` + `check-release-secret-leaks.sh` |
| Hidden query failure | Error is not rendered as an empty success | Dashboard / contracts / properties / tenants state tests |
| Financial mutation integrity | Payments are atomic, idempotent, overpay-safe, company-scoped | Existing `release_blockers.sql` + financial Vitest |
| Role capability | Six roles allow and deny the locked matrix | DB `role_has_app_permission` + R5 Vitest |
| Storage | Private bucket, signed URL for owner, no public/anonymous download | pgTAP bucket contract + isolated Storage smoke (Docker CI) |
| Edge Function | Auth, CORS, validation, no SQL, no writes | Source contract tests |
| Live schema drift | Repository migrations are not assumed to match Production | `db0:gate` locally; `supabase:live-readiness` / QA contracts when credentials exist |

## 2. Selected tools

Chosen from what the repository already uses. No new framework.

| Layer | Tool | Why this layer |
|---|---|---|
| Schema / types / structural RLS | WP-DB0 PGlite (`pnpm db0:gate`) | Offline, already in CI, proves the chain the repo builds |
| Behavioral allow/deny on **today's** schema | `scripts/supabase-tests/rls-matrix.mjs` | P0 probes use a historical checkpoint; pgTAP needs Docker |
| Launch-critical SQL journeys | `supabase/tests/*.sql` via `supabase test db` | Real PostgreSQL + pgTAP when Docker exists |
| Client session / visibility / functions | Vitest + Testing Library | Already the app test runner |
| Browser journeys | Playwright | Existing e2e / single-office isolated spec |
| Hosted QA | `pnpm qa:preflight` / `qa:lifecycle` | Separate project, explicit mutation approval |
| Production | Read-only smoke only | Never mutates important data |

Docker, `psql`, and hosted credentials are **not** required for the local
`pnpm test:supabase` proof. They remain required for Storage HTTP, Auth HTTP,
Realtime reconnect, and live drift.

## 3. Test-data model

All disposable identities live in memory. They are never written to a hosted
project.

| Identity | Company | App role | Membership | Purpose |
|---|---|---|---|---|
| anon | none | none | none | Public/unauthenticated deny |
| Admin A | A | `ADMIN` | OWNER, active | Intended full access in A |
| Manager A | A | `MANAGER` | ADMIN, active | Operational write in A |
| Accountant A | A | `ACCOUNTANT` | MEMBER, active | Financial view, no property write |
| Operations A | A | `OPERATIONS` | MEMBER, active | UI write role; DB write still `is_admin_or_manager()` |
| User A | A | `USER` | MEMBER, active | Read own company, no privileged writes |
| Viewer A | A | `VIEWER` | VIEWER, active | Read only |
| Inactive A | A | `ADMIN` JWT | OWNER, user inactive | Stale JWT must fail closed |
| Deleted A | A | `ADMIN` JWT | OWNER, `deleted_at` set | Soft-delete must fail closed |
| No membership | claims B | `ADMIN` | none | Hook must issue no company |
| Admin B | B | `ADMIN` | OWNER, active | Unrelated tenant |
| Admin A spoofing B | claims B | `ADMIN` | member of A only | Cross-tenant JWT spoof |
| `service_role` | n/a | n/a | bypass RLS | Server-only privilege, never in the browser |

Seeded rows: one property, owner, unit, person, and expense per company. No
Production data. The database is discarded when the process exits.

## 4. Coverage map by journey

### 4.1 Auth lifecycle

| Journey | Proof | Gap |
|---|---|---|
| Login | Login page + `auth-service` Vitest | Real GoTrue password check needs hosted/local Auth |
| Session refresh | `use-company` refresh/fail-closed tests | Live token refresh needs Auth HTTP |
| Logout | `signOut()` service test | Hosted cookie/session cleanup not run here |
| Recovery | Forgot/reset password pages | Email delivery is external |
| Profile / membership | Hook + `company_members` + `is_app_user()` | Hosted signup trigger not executed |
| Deletion | Soft-deleted user denied | Auth admin `deleteUser` only in Storage smoke (Docker) |

### 4.2 Role access and RLS

Proven on the **current** migration chain for `properties`, `owners`, `people`,
`units`, `expenses`, plus RPC/commission/payment denials and the six-role
helper.

Existing pgTAP already covers two-company switching, six-role catalog,
SECURITY DEFINER search_path, and financial write RPCs when Docker is
available (`scripts/ci/run-supabase-database-gate.sh`).

### 4.3 Page visibility

| Page | Loading | Error ≠ empty | Empty success |
|---|---|---|---|
| Dashboard | yes | yes (`تعذر تحميل بيانات اليوم`) | does not invent zero KPIs |
| Contracts | yes | yes | `لا توجد عقود` |
| Properties | yes | yes (new state test) | `لم تُضف عقارات بعد` |
| Tenants | yes | yes | empty discriminant |
| Expenses / receipts | yes | yes | workspace-level |

### 4.4 Mutations and integrity

Local matrix: property insert/update/delete allow/deny, spoofed `company_id`,
idempotency table sealed, OPERATIONS vs ADMIN/MANAGER write fence.

Docker/CI pgTAP: invoice payment idempotency, overpay atomicity, overlapping
contracts, owner-statement math, owner-settlement concurrency, Stage 3 posting
concurrency.

### 4.5 Storage / Realtime / Functions

| Area | Local | Needs Docker / hosted |
|---|---|---|
| Bucket private + 5MB/MIME | Matrix structural check | — |
| Signed URL + anonymous deny | — | `storage-isolated-smoke.mjs` |
| Effective-permissions channel is user-scoped | `use-company-regression.test.ts` | Reconnect / duplicate events |
| AI Edge Function auth/CORS/SQL reject | Source contract | Live function + provider failure |

### 4.6 Migrations, types, production smoke

- `pnpm db0:gate` — replay, idempotency, types, frontend contract, structural isolation, six-role enum
- `pnpm supabase:live-readiness` — read-only, requires `SUPABASE_DB_URL` + `psql`
- `pnpm qa:database-contracts` — QA project only
- Backup/restore rehearsal is documented in `evidence/wp07/backup-restore-rehearsal.md` and is an operator procedure, not this suite

## 5. Commands

From the repository root:

```bash
pnpm test:supabase            # local high-confidence suite
pnpm test:supabase:rls        # current-schema allow/deny matrix only
pnpm test:supabase:secrets    # browser privileged-key scan only
pnpm db0:gate                 # schema/type/isolation contract
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
pnpm e2e                      # Playwright; fixture or local stack
pnpm supabase:live-readiness  # optional read-only live check
pnpm qa:preflight             # hosted QA, injected credentials
pnpm qa:lifecycle             # hosted QA mutations, explicit approval
```

Release-blocker CI still runs `scripts/ci/run-supabase-database-gate.sh` when
Docker is available: migration replay, pgTAP, concurrency, Storage smoke, and
the single-office browser lifecycle.

## 6. CI stages

| Stage | Workflow | Mutates hosted data? |
|---|---|---|
| Privileged-key scan | `pnpm test:supabase:secrets` (add to `ci.yml` `build` when workflow permission exists) | no |
| WP-DB0 contract gates | `ci.yml` `build` | no |
| Current-schema RLS matrix | `pnpm test:supabase:rls` (add a parallel CI job when workflow permission exists) | no |
| App + financial Vitest | `ci.yml` `build` | no |
| Isolated Supabase + Storage + single-office e2e | `release-blocker-gate.yml` | no (ephemeral local stack) |
| Hosted QA read | `hosted-qa-verification.yml` | no |
| Hosted QA financial lifecycle | `hosted-qa-verification.yml` after approval | QA project only |
| Production | `supabase-live-readiness.yml` / release-blocker read-only e2e | **read-only** |

## 7. Manual checks that remain

These cannot be honestly automated in this sandbox:

1. Confirm the hosted Auth Hook is enabled on the deployed project.
2. Confirm Production migrations match the repository ledger.
3. Restore a Production backup into a disposable instance.
4. Walk the Arabic RTL office on a real phone after login.
5. Never run a mutating financial journey against Production to obtain evidence.

## 8. Remaining limitations

- This environment has no Docker, no `psql`, and no hosted QA/Production
  credentials. HTTP Auth, Storage signed-URL download, Realtime reconnect, and
  live drift are **not executable here**.
- Historical P0 Vitest probes still replay a pre-fix checkpoint. They are
  evidence of the original leak and fix, not a proof of the current 280+
  migration chain. The new matrix is the current-schema proof.
- Frontend `OPERATIONS` no longer exposes `properties.write` /
  `contracts.write` / `expenses.write` / `documents.write`. Database write
  policies still use `is_admin_or_manager()`. The SQL catalog
  (`role_has_app_permission`) still lists those OPERATIONS capabilities;
  that is catalog capacity, not current RLS authority. The matrix records
  the **database** truth and does not weaken RLS.
- Maker-checker is proven for contracts and some settlements, not uniformly
  for every VOID path (`GAP-002`).
- 47 financial columns remain `numeric(_,2)` (accepted GAP-009).
- `supabase/config.toml` being present locally does not prove the hosted Auth
  Hook is turned on.

## 9. Implementation order (this work)

1. Cross-user / cross-tenant access and privileged-key exposure.
2. Critical page data visibility and hidden-error regressions.
3. Critical mutations and data integrity.
4. Auth / profile / membership lifecycle.
5. Storage / Realtime / Functions contracts that can be proven without Docker.
6. Migration smoke via the existing WP-DB0 gate; live smoke left as an
   operator command.

Results of the run that produced this branch: `SUPABASE_TEST_RESULTS.md`.
