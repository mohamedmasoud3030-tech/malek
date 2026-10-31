# Code hygiene — what was deleted, and what only *looks* dead

> **Recorded:** 2026-10-21 · **Repository state:** `malek@194c7e027d76` baseline + this round
> **Authority:** agent memory only — see [index](index.md).

The instruction behind this page was blunt: guards must not veto deleting unused code, and every
"this looks dead" candidate must be traced before it is either deleted or kept. This page records
the results so the next agent does not repeat the audit — and, more usefully, does not delete
something that a test or an implicit edge keeps alive.

## Deleted (no remaining caller, no guard worth keeping)

| What | Where | Why it was safe |
| --- | --- | --- |
| `generateInvoicesFromActiveContracts` (dead twin, 276 → 274 lines) | `malek-app/src/features/financials/billing/billing-readiness-service.ts` | Byte-identical copy of the live wrapper in `financials/invoices/invoiceService.ts:137` (used by `useInvoices.ts:58`). Nothing imported the billing copy. |
| `uploadVaultDocument`, `softDeleteVaultDocument`, `UploadVaultDocumentParams` (214 → 135 lines) | `malek-app/src/features/documents-vault/documents-vault-service.ts` | The vault UI is read-only: list + signed URLs. No caller of the write path existed. Its only import (`@/lib/tenant-storage-path`) went with it; that module is still used by `services/documents/contextualDocumentsService.ts`. |
| `getCurrencyMinorUnit(value: unknown)` | `malek-app/src/lib/formatters.ts` | Second definition of a function already owned by `lib/money.ts` (typed, used by `getCurrencyStep`/`roundMoney`). Production callers: none. |
| `featureFlag?`, `migration?` | `malek-app/src/features/settings/registry/section-catalog.ts` | Optional registry fields that were never set and never read anywhere in the repository. |
| Extra `formatMoney`/`formatDate` minors, `prettier`, `@vitest/coverage-v8`, `wouter` catalog entry | root + `malek-app/package.json`, `pnpm-workspace.yaml` | Never invoked by any script, workflow, or gate. `prettier` was not referenced in CI at all. |

## Restructured (not deleted — two copies collapsed into one owner)

- **Frozen S08 reviews.** `loadApprovedS08Reviews` existed twice: in
  `financials/services/s09-correction-service.ts` and in `owners/services/owner-funds-cutover-service.ts`,
  both issuing the same `s08_list_frozen_reviews` RPC with the same null period and the same
  `APPROVED` filter, differing only in projection and sort field. Now one loader
  (`loadApprovedS08ReviewRows`) owns the query; each panel keeps its own projection.
- **Settings registry.** The metadata table lived in `sectionRegistry.ts` next to the lazy component
  imports, so `settings-section-card.tsx` (used by every section) read the registry that lazy-loaded
  those sections. Split into `section-catalog.ts` (a leaf: metadata + derived helpers) and
  `sectionRegistry.ts` (catalogue + components). Sections and cards now import `registry/types` /
  `registry/section-catalog`, never the hub.
- **e2e acceptance identity.** `document-acceptance-session.ts` and `fake-supabase-backend.ts` imported
  each other. `IDS`, `ACCEPTANCE_EMAIL`, `ACCEPTANCE_FULL_NAME`, and `buildAcceptanceAccessToken` moved
  to `e2e/support/acceptance-seed.ts`; both modules re-export, so no spec changed.

## Verified counts (measured this round, not estimated)

- **Circular dependencies: 10 → 0.** `pnpm dlx madge@8 --circular --extensions ts,tsx --ts-config tsconfig.json src e2e` → `Processed 1303 files`, no cycles. Scope it to `src e2e`: running it over `malek-app` also walks `dist/public/assets`, which is chunk-split output and reports hundreds of false cycles.
- **Exported names never mentioned in any other file: 2.** Both handled (`uploadVaultDocument`/`softDeleteVaultDocument` removed); the other flagged name was an unexported type in a test file.
- **Unexported top-level declarations never used: 0** — expected, because `tsconfig.base.json` sets `noUnusedLocals: true`. Do not spend time looking for this class; the compiler already owns it.
- **`malek-app` dependencies: 44, all used.** The six that a naive import scan flags are `@types/*` (ambient), `happy-dom` (`// @vitest-environment` docblock), `postcss` (peer of the Tailwind pipeline), and `@testing-library/dom` (peer of `@testing-library/react`).
- **SQL: 119 functions defined, 102 RPCs called from the client, 0 unreferenced by both.** Merged migrations stay immutable — deduplicating them is forbidden by `check-migration-rollback-hygiene` Rule 3.
- **Isolated production files: 15**, and all 15 have a declared owner (see below).

## Contracts and tests as a source of duplication (measured 2026-10-21)

This round's question was not "what is duplicated" but "what keeps it duplicated". Two measurements
answer it.

### 1. The test layer duplicates more than production

| Layer | Duplication | Lines | Clones |
| --- | ---: | ---: | ---: |
| Production TypeScript | 1.02% | 1,342 | 121 |
| Test layer (`*.test.ts`, `*.test.tsx`) | **2.81%** | **1,602** | **149** |

`scripts/check-duplication.mjs` now measures both, with independent ceilings (1.10% and 2.85%), in the
same gate step. Before this, tests were excluded entirely, so scaffolding duplication had no ceiling at
all — that was the blindness, not the number.

Not all of it should go. `people-direct-write-acl.pglite.test.ts` and
`unit-direct-write-acl.pglite.test.ts` share seven test titles and ~340 tokens, but their `insert` /
`update` payloads are entity-specific and *are* the proof. Parameterizing them would hide the evidence.
The duplication worth removing is scaffolding (the same read/mock/bootstrap block per suite), which is
why the ceiling is a ratchet rather than a target of zero.

### 2. Contract tests freeze the copies they assert

Of the string literals asserted by `expect(source).toContain(...)` in contract tests, **107 also appear
in two or more production files**. The largest:

| Literal | Production files carrying it | Reading |
| --- | ---: | --- |
| `error instanceof Error ? error.message` | 43 | A missing primitive, not 43 decisions |
| `const queryClient = useQueryClient()` | 36 | React Query boilerplate per hook |
| `activeFilters={activeFilters}` | 17 | One prop used in 17 places — *not* duplication |
| `contract.properties?.title` | 17 | No accessor for a repeated optional chain |
| `enabled: options?.enabled ?? true` | 8 | Repeated query-option boilerplate |

The mechanism matters: a source-text assertion fails the moment the copied block is extracted, so the
cheapest way to keep the suite green is to leave the copy. That is how a guard turns into a veto
against cleanup — the same failure the round-9 instruction named.

Worked example already paid down. `app/ux-completion-contract.test.ts` **already** asserts the right
rule — use `getActionableSupabaseErrorMessage`, never a raw `error instanceof Error ? error.message` —
but only for four named files (`deposit-action-forms.tsx`, `use-deposit-workspace-controller.ts`,
`person-form-modal.tsx`, `property-form-modal.tsx`). The other ~39 files that hand-roll the same
expression are simply outside the list, so the contract cannot see them. Extending it is a UX-text
change (the actionable helper rewrites provider errors into Arabic guidance), so it belongs in its own
round with its own review — not in a deletion sweep.

First payment taken: `collectErrorText` in `features/owners/services/owner-receivable-offset-service.ts`.
The offset and recovery error translators carried the same 11-line message/code/details prologue;
production duplication went 1.03% → **1.02%** (1,355 → 1,342 lines).

### 3. Cleanup executed after the first measurement

The shared source-reading idiom was migrated in **24 contract-test files** to one typed helper,
`malek-app/src/test/read-source.ts`. It centralizes UTF-8 and path resolution only; each test still
names its own production file and keeps its own assertions. Four suites that had private versions of
the same `readSource` helper now use the shared implementation. The 24-file batch passes **177/177
focused tests** and `app:typecheck-tests`.

A second, security-sensitive duplicate was removed from the isolated smoke scripts:
`single-office-isolated-smoke.mjs` and `storage-isolated-smoke.mjs` had separate copies of the
production-project refusal and environment-kind validation. Both now call
`malek-app/scripts/lib/isolated-environment.mjs`, before constructing any Supabase client. Their
allow-lists stay distinct (`local`/`qa` vs `local`/`staging`). A new `node:test` suite proves local and
QA acceptance, unsupported-kind rejection, exact production-project rejection, and production
subdomain rejection (**5/5**). The live smoke scripts were syntax-checked, not run: no hosted
credentials are available and the guard is explicitly not a claim of hosted verification.

Net behavior: unchanged in contract tests; smoke-script safety is now one implementation instead of
two, with preserved per-script environment policy.

### 3. What was considered and rejected here

- **Parameterizing the two ACL suites.** Rejected: the SQL payloads are the evidence.
- **Migrating the 169 test files that read production source with `readFileSync(resolve(...))`.**
  Rejected for this round: it is a pure refactor, but it can only be verified by a full suite run
  (~25 min, previously aborted under a 1,500 s cap). A 169-file diff with partial verification is
  worse than no diff. If taken up, build the helper first, migrate in batches, and run the full suite.
- **Merging `PersonDossier.tsx` and `TenantPreviewDialog.tsx`.** Already rejected in
  [ADR 0022](../decisions/0022-duplication-ratchet.md) for a stated reason; not revisited.

## UI pages, views, and feature display audit (2026-10-21)

This pass inspected every TSX clone reported by `jscpd` at `--min-tokens 50 --min-lines 5`, not just the highest pair. It reviewed list views, settings sections, dossiers, portals, financial report panels, tax forms, CSV/XLSX actions, and route fixtures.

### Safe extractions performed

- **Report table exports:** `CollectionsSection` and `OverdueSection` now share `ReportTabularExportActions` for Excel/CSV buttons. Each caller retains its exact rows, filename, sheet name, permission flag, and empty-data disabled state.
- **Report CSV actions:** `ExpiringContractsSection` and `FollowUpSection` now share `ReportCsvExportButton`. The entity-specific CSV column mapping and filename remain at the caller.
- **Tax forms:** the rent-tax and fee-tax dialogs share `TaxDefinitionFields`. `includeEffectiveTo` preserves the rent-tax end-date control and its two-column layout; fee-tax keeps its existing layout without that control. Approval mutations, fee kinds, and validation stay separate.
- **Person/tenant dossier activity:** `DossierActivitySection` owns only the common read-only timeline display. Each caller retains its existing permission gate, data source, heading ID, date formatter, and entity-specific empty-state sentence.
- **EntityTable loading/loaded toolbar:** one `toolbarContent` node now feeds both branches. This removes an exact same-file JSX copy without changing where the toolbar appears or what it contains.
- **Unsaved-changes warning:** `UnsavedChangesDialog` now owns the repeated Arabic copy and warning presentation used by person forms, service-provider forms, and route blockers. Each caller still owns its own busy/close/discard state and callbacks.
- **Deposit amount input:** `DepositAmountField` owns the identical currency-aware numeric control used by deposit allocation and refund forms. Each form retains its distinct validation, evidence/payment method, mutation, and ledger behavior.

### Deliberately kept separate

| Similar surfaces | Decision | Reason |
| --- | --- | --- |
| Lands vs communication list views | Keep | They already share `EntityTable`, `FilterBar`, `AsyncContentState`, action-menu primitives, and active-filter types. Their row schemas, filters, mobile actions, and mutation behavior are different. A mega-list component would encode entity-specific branches without removing the real domain rules. |
| Owner vs tenant portals | Keep authorization/data boundaries separate | Bearer-token RPCs, snapshot DTOs, accessible data, summary meanings, and section inventories are intentionally different. Do not unify page services or trust boundaries to save repeated loading/invalid-link markup. |
| Person vs tenant dossiers | Share contracts/activity only; keep other sections | Financial visibility, identity semantics, tenancy context, document type, and privacy permissions differ. Remaining similarity is layout around different data and gates. |
| Settings sections | Keep section composition distinct | Common card, input, field, and draft handling are already shared. Remaining field groupings and warnings carry section-specific settings semantics. |
| Balance sheet vs income statement | Keep account groups distinct | Balance-sheet groups carry code/name and as-of semantics; income statement groups carry revenue/expense semantics and a different KPI summary. `ReportList` primitives are already shared. |
| Contract E2E fixture vs production page | Keep fixture | The fixture composes production filters, KPI, result, and preview components with deterministic showcase data; replacing it with the live query would destroy hermetic E2E behavior. |
| Person vs service-provider forms | Keep their field schemas and save flows separate; share discard-warning UI only | Their unsaved-change dialog was the common display contract and is now `UnsavedChangesDialog`; validation schemas, mutation policies, category controls, and submit states differ. |
| Rent-tax vs fee-tax setup | Share only common input fields | Rent-tax allows an end date; fee-tax has fee-kind and approval semantics. `TaxDefinitionFields` preserves the optional rent-only control and layout without merging mutation rules. |
| EntityTable's loading vs populated toolbar | Share the exact toolbar node | Both branches used identical toggle/toolbar JSX; a single `toolbarContent` value removes the internal copy while preserving branch placement. |
| Offset vs recovery movement panels | Keep their remaining state and movement rows separate | Their shared selector, assurance, feedback, amount/date, and facts display were already extracted; distinct mutation lifecycles, permission evidence, and ledger wording remain entity/action-specific. |
| Property vs service-provider preview dialogs | Keep | Same dialog shell and edit affordance are supplied by shared `EntityPreviewDialog`; preview facts and privacy fields differ. |
| Owner vs property dossier snippets | Keep | Ownership settlements/ledger exposure and property operations/units are different aggregates and permission surfaces; their row wrappers are not a common business component. |
| Person edit vs person create routes | Keep separate route adapters | They share list backdrop and modal mechanics, but edit has a required route parameter plus a fail-safe fallback when it is absent. A common shell would still need to branch on the route contract and saves little. |
| Balance sheet vs income statement panels | Keep their report-specific groups | They already reuse `ReportList`/`ReportListRow`; balance-sheet account-code subtotals and income statement revenue/expense KPIs are not interchangeable. |
| Deposit return vs allocation forms | Share the amount input only; keep workflows separate | `DepositAmountField` shares the identical currency-aware amount control. Refund vs allocation still have different validations, evidence/payment inputs, mutation paths, and posting consequences. |
| Owner agreement status empty states | Keep each message/action | Current, scheduled, and ended agreement states require different business wording and actions; their near-identical wrapper is not a repeated reusable feature. |

### Verification and metric interpretation

Focused UI component tests: **16/16**; report/tax focused suites: **26/26**; deposit workflow suites: **25/25**; owner/tenant portal boundary suites: **17/17**; production and test TypeScript checks passed; fresh `agent-local-gate` **18/18 at `9f84127f4c4a`**.

Current production-source measurement: **0.96% / 1,261 duplicated lines / 114 clones / 132,006 lines**. Immediately before this pass: **0.99% / 1,312 lines / 120 clones / 131,930 lines**. This pass reduced the measured rate by 0.03 points, 51 duplicated lines, 6 clones, and 693 duplicated tokens (15,345 to 14,652). The component extractions also retain the caller-owned permission, data, and state contracts; this is not a claim of zero duplication.

## Full production-code duplication audit and safe extractions (2026-10-21)

The current request asked for an exhaustive pass over the existing duplication report, distinguishing
accidental repetition from similarity whose contract must stay separate. I reran jscpd after the
changes, not against the earlier 1,312-line snapshot:

| Scope | Duplicated lines | Clones | Rate |
| --- | ---: | ---: | ---: |
| Guarded app production source (`malek-app/src`, tests excluded) | **1,059** | **90** | **0.80%** |
| Guarded app test layer | 1,602 | 149 | 2.81% |
| Broader production-code audit (`malek-app/src`, `malek-app/scripts`, root `scripts`, `supabase/functions`) | **1,394** | **124** | **0.94%** |

The broad inventory is stored outside Git at `/tmp/final-code-audit/pairs-index.txt` for this run.
Clone reports overlap (a repeated region can participate in more than one reported pair), so 124 is not
124 independent refactor tasks. The test layer stayed separate and unchanged; repeated SQL payloads,
assertions, and guard-test cases remain visible as evidence rather than being hidden behind generic
fixtures.

### Extracted where behavior and contracts were identical

- **JWT app-metadata decoding:** `lib/access-token-claims.ts` now serves role lookup and storage-company
  scoping. It decodes but explicitly does not validate signatures or replace server authorization;
  both callers retain their own fail-closed interpretation of the relevant claim.
- **Form primitives:** owner and communication schemas share the exact optional-phone normalization,
  trimmed-short string schema, and blank-to-null transform; payload schemas and update-only behavior
  remain distinct.
- **Calendar and number formatting:** maintenance and utility calendar-day math now share UTC day
  conversion; vacancy/report-period formatting shares UTC output, while contract scheduling and AI
  date ranges reuse the existing *local*-date formatter. UTC and local operations were not conflated.
  Latin date variants share a formatter while preserving each wrapper's locale, options, and blank /
  invalid-value contract; localized date and date-time wrappers share only their common conversion.
- **Record normalization and balance sheet:** three JSON object readers use `asJsonRecord`; balance
  sheet assets/liabilities/equity use one row mapper and retain OMR normalization and separate totals.
- **Financial and utility contracts:** tax profile and fee treatment records share a common type with
  fee kind remaining explicit; utility nullable finite-number preprocessing is shared while positive
  versus non-negative validation messages remain separate.
- **Stable queries and export projections:** unit-ID deduplication/sorting is shared across conflict
  and draft queries; active owner options use one query while each caller keeps its own error policy;
  property and contract CSV/XLSX projections share only identity/terms columns, leaving CSV money
  formatting and numeric XLSX cells distinct.
- **Actions and tooling:** utility split print/PDF actions share the guarded action path but retain
  their distinct service operation and Arabic fallback; Supabase edge functions share the identical
  abort-timeout fetch primitive; two repository guards share only `--base` parsing.
- **Maintenance filters:** production and E2E fixture now consume the same ordered status/priority
  options, keeping the fixture aligned with the live vocabulary without sharing live data.

### Deliberately not collapsed

Dossier and portal page copies are bounded by different identity, permission, and financial visibility
contracts. Offset/recovery, fund cutover, S09 correction, deposits, and contract creation/update carry
different posting or evidence semantics; matching payload shape alone is not authority to merge them.
Financial reports and owner/tenant views may display similar empty/loading states but use distinct
read models and meanings. Similarly, only local dates share local formatting and only UTC calendar
math shares UTC helpers. Cross-edge/client AI types and context derivations remain on their respective
security boundaries; test contracts and fixtures stay representative of the implementation they
prove. The append-only migration ledger remains untouched under migration-hygiene **Rule 3**; this
pass changes no financial write path or authority and does not alter **SEC-009** boundaries.

### Fresh verification

The focused refactor suites passed **180/180 tests**, both application typechecks passed, and the full
credential-free `agent-local-gate` passed **18/18** at the pre-commit working tree. The duplication
gate confirmed 0.80% app production and 2.81% test-layer rates, both below locked ceilings. This is
local evidence only: no hosted Supabase, browser journey, or live deployment was verified.

## Things that look dead and must not be deleted

| Looks dead | Actually | Evidence |
| --- | --- | --- |
| `features/settings/settings-workspace.e2e-fixture.tsx` + `components/company-profile-sections.tsx` | Live | Imported by `src/routes/_auth.login.e2e-fixture.tsx`, a file-based TanStack route. Static import graphs cannot see file-based routes; always grep `routes/` before deleting a "fixture". |
| `p0/replay-stubs.ts`, `p1/replay-bootstrap.ts` | Live test infrastructure | `p1` is imported by dozens of PGlite suites; `p0` feeds `p1`. They live outside `src/test/` but are test-only by design. |
| `app/navigation/route-tree-paths.ts` | Live test helper | Imports in four navigation contract tests. It parses the route tree as text on purpose: that is the drift guard for routes. |
| `BUSINESS_KB_SOURCES` in `supabase/functions/_shared/ai-business-kb.ts` | Provenance data, never rendered | No renderer or test reads it. It documents where the advisory numbers came from; deleting it destroys the audit trail without changing behaviour. Owner call, not an agent call. |
| `@replit/*` plugins, `vite-plugin-pwa` | Build-time only | Loaded by `vite.config.ts`, never imported by source. |
| Both `public/malek-lockup.svg` and `public/malek-mark.svg` | Intentional | Identical bytes, but `brand-contract.test.ts:86-87` asserts both names. |
| Migrations cited by `docs/source-of-truth/*` that no longer exist | Historical provenance | `scripts/check-doc-links.mjs` **strips inline code** before validating, so backticked paths are deliberately outside the enforced contract. Rewriting them would falsify the record. ADRs and dated reports that still say `rentrix-app/` are the same case. |

## Reproducing the audit without adding files to the repository

Every analyser used here was a throwaway script under `/tmp`, and `.scratch/` is gitignored. Do not add
`knip.json` or a second dependency surface: installing `knip` at the workspace root resolved
`zod@4.6.7` alongside the app's `zod@3.25.76` and broke nine files' `zodResolver` typings. The three
commands that reproduce this page's verdicts with tools already in the repository:

```bash
pnpm dlx madge@8 --circular --extensions ts,tsx --ts-config tsconfig.json src e2e   # cycles
node scripts/check-duplication.mjs                                                  # guarded app + test layers
npx --no-install jscpd malek-app/src malek-app/scripts scripts supabase/functions \
  --min-tokens 50 --min-lines 5 --format javascript,typescript,tsx \
  --ignore '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/node_modules/**' \
  --reporters json --output /tmp/full-code-audit                             # broader production inventory
node scripts/agent-local-gate.mjs                                                   # 18/18
```
