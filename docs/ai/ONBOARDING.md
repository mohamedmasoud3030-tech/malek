# Rentrix Agent Onboarding

This is a deep onboarding snapshot for coding agents when route, module, or release context is needed. Read `AGENTS.md` first, then read `docs/ai/CURRENT_EXECUTION_CONTEXT.md` before this file, roadmap notes, payment reports, migration reports, or any older audit.

When documentation and code disagree, `docs/ai/CURRENT_EXECUTION_CONTEXT.md` is the current execution source of truth. Inspect the active code and migrations, report the mismatch, and update stale documentation through a reviewed change. Do not guess from historical reports, recovery folders, or old pull requests.

For reporting or document-output work, also read `docs/ai/REPORTING_DEFINITIONS.md` and `docs/ai/PRINT_AND_EXPORT_READINESS.md` after `CURRENT_EXECUTION_CONTEXT.md`. These files describe current repository evidence and known limitations; they do not replace live Supabase/payment QA evidence.

## Docs map

For non-trivial work, start with the applicable agent entry file, `docs/ai/CURRENT_EXECUTION_CONTEXT.md`, and `docs/ai/AGENT_OPERATING_PROTOCOL.md`; then use this onboarding snapshot only when route, module, permission, or release context is relevant.

Active policy docs: `docs/ai/domain-rules.md`, `docs/ai/engineering-policy.md`, `docs/ai/security-policy.md`, `docs/ai/release-policy.md`, `docs/ai/testing-guide.md`, and `docs/decisions/README.md`.

Technical references: `docs/ai/PRINT_AND_EXPORT_READINESS.md`, `docs/ai/REPORTING_DEFINITIONS.md`, `docs/ai/SECURE_OPERATOR_RUNBOOK.md`, `docs/ROOT_LAYOUT.md`, `docs/ai/AGENT_CAPABILITIES.md`, and `docs/ai/GIT_TOOLING_POLICY.md`.

Old reports, audits, evidence packs, superseded indexes, and release-thread notes were removed from active repository docs to keep the docs map small. Use git history when historical material is needed, and verify old claims against active code, migrations, and current source-of-truth docs before acting on them.

## 1. Product boundary

Rentrix is an Arabic-first, single-office property operations system. English/LTR behavior must remain functional.

Keep the stabilization scope bounded:

- no SaaS multi-tenancy;
- no organizations, memberships, invitations, subscriptions, or organization-scoped runtime behavior;
- no accounting-grade ledger expansion;
- no blind restoration from legacy or backup code;
- no unrelated feature work during audits, repairs, or release-readiness tasks.

## 2. Canonical repository boundary

The shipped product boundary is:

```text
rentrix-app/   # active React application
lib/                # shared workspace libraries
supabase/           # canonical migrations and backend assets
```

Other important categories:

```text
artifacts/rentrix-promo/        # optional promotional support only
.ai/                            # Rentrix-specific agent workflows
.agent-skills/                  # Rentrix-owned reusable skills
.agents/                        # installed or shared agent tooling
.codex/vendor/                  # source-locked upstream references
```

`archive/recovery-reference/` and `understand-anything/` are not present in the current repository checkout. Treat them as removed historical references, not active directories.

Do not import agent-tooling files, generated analysis artifacts, or historical recovery modules into the production bundle.

**Removed in PR #805:** `.migration-backup/`, `artifacts/rentrix/legacy-src/`, `artifacts/mockup-sandbox/`. These no longer exist. Do not reference them as if they are available.

## 3. Current constrained-beta application snapshot

The active application is under `rentrix-app/`. The visible desktop navigation currently exposes the verified operational flow only.

### Visible desktop navigation

```text
Dashboard
Properties
Units
People
Tenants
Owners
Owners Hub
Lands
Leads
Contracts
Financials
Invoices
Receipts
Expenses
Arrears
Commissions
Reports
Maintenance
Communication
System
Audit Log
Data Integrity
Change Password
Settings
```

### Visible mobile bottom navigation

```text
Dashboard
Properties
Contracts
Financials
Arrears
```

The mobile drawer is the authoritative mobile route inventory and must expose every active desktop navigation module with Arabic RTL labels and current-route highlighting. Do not cram every route into the bottom navigation.

### Approved product-expansion routes

The following previously deferred routes are approved active product modules and must not ship as placeholder, unavailable, coming-soon, or hidden dead routes:

```text
/lands
/leads
/commissions
/communication
```

Current planned-module status after the product decision:

| Route | Backend support | Page ready | Service status |
| --- | --- | --- | --- |
| `/maintenance` | Schema in migrations | Yes — full service + tests | Re-exposed in v0.3 with permissioned navigation |
| `/audit-log` | `public.audit_log` queried with generated `database.ts` type | Yes — read-only view | Re-exposed in v0.3 with hardened RLS evidence |
| `/data-integrity` | Minimal read model | Yes — page exists | Re-exposed in v0.3 with permissioned navigation |
| `/system` | Minimal governance source support | Yes — page + components | Re-exposed in v0.3 with permissioned navigation |
| `/lands` | Existing table and RLS hardening migration | Yes — list/create/edit/archive | Approved active module |
| `/leads` | Existing table and RLS hardening migration | Yes — list/create/edit/archive | Approved active module |
| `/commissions` | Existing table and RLS hardening migration | Yes — list/create/edit/cancel | Approved active module; no ledger expansion |
| `/communication` | `communication_records` migration | Yes — internal log list/create/edit/archive | Approved active module; no external sends |

`/accounting` remains registered only as a redirect to `/financials`. Do not wire a general ledger while stabilization is active.

### Current routing and authorization shape

- TanStack Router is the active router.
- Protected routes require a Supabase session.
- Permissioned routes use `requirePermission(...)` from the active route tree.
- Recognized authorization roles are exactly `ADMIN`, `MANAGER`, and `USER`.
- The frontend reads the role from `session.user.app_metadata.user_role`.
- Missing or unknown role claims fail closed.
- Frontend visibility and route guards improve UX; they do not replace backend authorization, grants, or RLS.

## 4. Domain invariants

Read `domain-rules.md` before changing contracts, invoices, payments, receipts, arrears, expenses, migrations, or RLS.

Preserve at minimum:

- property owns units;
- contract references exactly one unit and one tenant;
- active contracts for one unit do not overlap;
- payment belongs to exactly one contract;
- standalone payments are not allowed;
- receipt is generated only from a posted payment;
- posted payments are immutable;
- corrections use reversal and replacement;
- outstanding balance is derived through one canonical calculation path;
- orphan chains are not allowed.

## 5. Closed tech debt and known blockers

- **Duplicate hook pairs closed:** `useProperties.ts` / `use-properties.ts` and `useUnits.ts` / `use-units.ts` were consolidated in v0.2. Current canonical hooks are `use-properties.ts` and `use-units.ts`.
- **`database.ts` audit type gap closed:** `public.audit_log` and other previously untracked tables are now represented in the generated database types, and the audit service uses `Database['public']['Tables']['audit_log']['Row']` directly.
- **Custom Access Token Hook done:** the owner confirmed the Custom Access Token Hook is registered. Document it as `DONE`; it is not a current repo-stabilization blocker.
- **Final delivery QA remains:** authenticated ADMIN browser QA, mobile/physical-device print QA, and production GO/NO-GO are `FINAL DELIVERY GATE` items for handover evidence. Do not claim full production readiness before final delivery QA closes.

## 6. Required reading order

After `AGENTS.md`, read in this order before non-trivial edits:

1. `docs/ai/CURRENT_EXECUTION_CONTEXT.md`
2. `README.md`
3. `docs/RENTRIX_MASTER_PLAN.md`
4. `docs/ai/AGENT_CAPABILITIES.md`
5. `docs/ai/GIT_TOOLING_POLICY.md`
6. `docs/ROOT_LAYOUT.md`
7. `docs/ai/domain-rules.md`
8. `docs/ai/engineering-policy.md`
9. `docs/ai/security-policy.md`
10. `docs/ai/testing-guide.md`
11. `docs/ai/release-policy.md`
12. `docs/decisions/README.md`
13. `.ai/workflows/README.md`

Then load only the task-specific references needed for the requested change.

## 7. Source-first execution rules

Before editing:

1. inspect the repository root;
2. inspect `rentrix-app/`;
3. identify the active roadmap release and first ready item;
4. confirm the active route, service, schema, migration, and test paths from code;
5. classify legacy, backup, archive, generated, and vendor files before using them;
6. choose the applicable workflow from `.ai/workflows/README.md`;
7. choose the smallest relevant skill set from `AGENT_CAPABILITIES.md`;
8. follow `GIT_TOOLING_POLICY.md` for branch, diff, PR, CI, and merge work;
9. keep the final diff narrow and reviewable.

Prefer `rg --files` and `rg` when available. Avoid destructive Git operations. Preserve dirty worktrees. Report exact blockers rather than guessing.

## 8. Continuation behavior

A continuation request is based on intent, not one exact keyword. When the user asks to continue, resume, proceed, finish the next step, or uses similar wording:

1. inspect current `main`, open roadmap PRs, and the latest evidence;
2. select the earliest release that is not closed;
3. select the first `READY` roadmap item;
4. load only the relevant skills;
5. execute one narrow PR slice;
6. verify it with fresh evidence;
7. update roadmap evidence and identify the next item.

Ask the user only when a real product decision, environment approval, access boundary, or unresolved verification failure blocks safe progress.

## 9. Current CI verification gate

For runtime pull requests, GitHub Actions currently runs:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

Use targeted tests during implementation, then run the relevant full gate before handoff. For schema or RLS changes, also run the repository-approved Supabase validation flow when the required local or preview environment is available.

## 10. Current release and connector caution

Before any live Supabase or Vercel action, read the active execution context, roadmap, secure operator runbook, git policy, and connector workflow. Old rollout reconciliation reports were removed from active docs and remain available through git history.

The latest recorded Supabase boundary is:

```text
intended live project: RENTRIX EGY (live) / nnggcnpcuomwfuupupwg
prohibited project:    rentrix (V2) / ktmizdznbdwvalmmfvfc
```

**Current delivery evidence boundary (2026-06-16):**
- The active app and docs are repo-stabilized through local checks and reviewed PRs only.
- Custom Access Token Hook: `DONE` by owner confirmation.
- Authenticated ADMIN browser QA: `FINAL DELIVERY GATE`.
- Production GO/NO-GO: pending final handover QA.
- Full production readiness must not be claimed before final delivery QA closes.

## 11. Incomplete / Planned / Deferred Work

Classify every non-complete item with exactly one of these statuses:

| Item | Status | Current note |
| --- | --- | --- |
| Authenticated ADMIN browser QA | `FINAL DELIVERY GATE` | Final handover must verify login, protected routes, payment-to-receipt flow, reports refresh, RTL/LTR, and operator-critical workflows. |
| Production GO/NO-GO | `FINAL DELIVERY GATE` | Remains pending final handover QA. |
| Mobile/physical-device print QA | `FINAL DELIVERY GATE` | Repository supports print styles/browser print, but device print evidence is still required. |
| Commercial hardening v0.5 | `PLANNED` | Starts after final delivery QA closes or records a NO-GO fix path. |
| v1.0 commercial release | `PLANNED` | Depends on final delivery QA and v0.5 hardening. |
| Dedicated generated receipt PDF file | `PLANNED` | Current receipt output is browser print from the payment-backed receipt detail page. |
| Reports CSV date filenames/BOM | `DONE` | Implemented in current code; do not list as missing. |
| Invoice print/export button | `DONE` | Active invoice workspace exposes PDF export when invoice document context is loaded. |
| Receipt browser print | `DONE` | Receipt detail page supports browser print; this is not a generated PDF file. |
| External communication sending | `OUT OF SCOPE` | `/communication` is an internal log only unless a provider boundary is approved later. |
| General accounting ledger | `OUT OF SCOPE` | `/accounting` redirects to `/financials`; no ledger expansion during stabilization. |
| Tax finality/accounting-grade tax treatment | `OUT OF SCOPE` | Requires approved accounting requirements before product claims. |
| Owner settlement/payout workflow | `NEEDS OWNER DECISION` | Do not infer payout workflows from current owner or commission modules. |
| SaaS multi-tenancy | `OUT OF SCOPE` | Rentrix remains single-office. |
| Owner statements/settlement documents | `DEFERRED` | Future scope only after owner settlement decision. |
| Reports PDF export | `DEFERRED` | Current reports export CSV. |

## 12. Cleanup boundary

Read `docs/ROOT_LAYOUT.md` before removing or moving files. Remove only explicitly approved cleanup targets in a narrow cleanup PR. Keep docs pruning, recovery-source review, optional artifact decisions, and runtime changes separate.

## 13. Documentation maintenance rule

Update this file when an approved change alters:

- visible constrained-beta navigation;
- registered deferred routes;
- active runtime boundaries;
- authorization roles or role source;
- the CI verification gate;
- release-critical connector targeting or rollout cautions;
- roadmap sequencing or continuation behavior;
- known tech debt items.

Keep `README.md` and `AGENTS.md` as short entry points that link here instead of duplicating the full onboarding sequence. Superseded docs indexes were removed from active docs and remain available through git history.
