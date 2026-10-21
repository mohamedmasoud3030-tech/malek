# Code hygiene — what was deleted, and what only *looks* dead

> **Recorded:** 2026-10-21 · **Repository state:** `malek@bde05df8e9a2` + this round
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
node scripts/check-duplication.mjs                                                  # duplication ratchet
node scripts/agent-local-gate.mjs                                                   # 18/18
```
