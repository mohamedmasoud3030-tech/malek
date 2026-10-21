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
