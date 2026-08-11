# WP-06 — Print/PDF document-output inventory

> **Scope:** shared document platform only. Authorization/permission semantics
> are intentionally out of scope here and remain owned by the security track
> (WP-01). Where a document action is permission-sensitive, this inventory
> records only the *document* boundary.
>
> **Status discipline:** this file is repository evidence. It does not change
> any canonical Gap status and does not claim GAP-020 or WP-06 closed.

## 1. Canonical platform

```
feature call site
  └─ runGuardedDocumentAction({ isReady, operation, fallbackMessage })   ← handler-level fail-closed guard
       └─ documentService.printDocument / downloadDocumentPdf            ← only public boundary
            └─ DocumentController                                        ← lazy-loads the renderer
                 └─ documentEngine.buildDocument(type, {settings,payload})← only UnifiedDocumentModel source
                      └─ DocumentRenderer                                ← only rendering/output engine
                           ├─ print  → scoped A4 RTL popup + popup.print()
                           └─ pdf    → real application/pdf (jsPDF + html2canvas-pro)
```

Company identity always originates from the real `company_settings` row via the
single adapter `documentSettingsFromCompanyRecord` (exposed to UI as
`useDocumentSettings().isReady` / `.companySettings`). There is **no** brand,
address, phone or currency fallback anywhere on this path.

## 2. Reachable authenticated Print/PDF call sites

| # | Route (surface) | Document type | Call site | Readiness source | Handler guard | Currency/precision | Tests |
|---|---|---|---|---|---|---|---|
| 1 | `/contracts/$contractId`, contract preview dialog | `contract` | `features/contracts/actions/contractDetailActions.ts` | `useDocumentSettings()` at the two callers; re-derived in the action via `hasCompleteCompanyIdentity` | ✅ `runGuardedDocumentAction` | company-settings → `currencyFractionDigits` | `documentOutputInventory`, `documentOutputReadiness`, browser §2 |
| 2 | `/invoices` (Financials hub binding) | `invoice` | `features/financials/invoices/useInvoiceWorkspaceController.ts` → `invoices/invoice-actions.ts` | `documentSettings.isReady` folded into `canExportInvoiceDocuments` | ✅ `runGuardedDocumentAction` + missing-contract-context block | same | `documentOutputInventory`, invoice action tests |
| 3 | `/receipts?receiptId=…` | `receipt` | `features/financials/receipts/receipt-detail-page.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` + missing-receipt block | same | `receipt-detail-print-readiness`, browser §1 |
| 4 | `/expenses` / Financials expenses section | `expense_voucher` | `features/financials/components/expenses-section.tsx` → `expenses/expense-actions.ts` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory`, expense action tests |
| 5 | `/deposits` (deposit clearance voucher) | `generic_report` | `features/financials/deposits/deposits-workspace.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `document-readiness-gate`, `documentOutputInventory` |
| 6 | `/owner-settlements` | `owner_statement` | `features/owners/components/OwnerSettlementWorkspace.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory`, browser §3 |
| 7 | `/maintenance` (requests statement) | `generic_report` | `features/maintenance/components/maintenance-workspace.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `document-readiness-gate` |
| 8 | `/utilities` (utilities statement) | `generic_report` | `features/utilities/components/utilities-workspace.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `document-readiness-gate` |
| 9 | `/reports?section=accounting` | `trial_balance`, `income_statement`, `balance_sheet` | `features/reports/components/AccountingReportsSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` + missing-report-data block | same | browser §4 |
| 10 | `/reports?section=statements` | `tenant_statement`, `owner_statement` | `features/reports/components/StatementsSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` + missing-statement-data block | same | browser §3 |
| 11 | `/reports?section=collections` | `generic_report` | `CollectionsSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 12 | `/reports` deferred revenue | `generic_report` | `DeferredRevenueReportSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 13 | `/reports` expenses | `generic_report` | `ExpensesSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 14 | `/reports` maintenance | `generic_report` | `MaintenanceReportSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 15 | `/reports` occupancy | `generic_report` | `OccupancySection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 16 | `/reports` overdue | `generic_report` | `OverdueSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |
| 17 | `/reports` property analytics | `generic_report` | `PropertyAnalyticsSection.tsx` | `useDocumentSettings()` | ✅ `runGuardedDocumentAction` | same | `documentOutputInventory` |

Registered document types (`documentRegistry.ts`): `contract`, `invoice`,
`receipt`, `expense_voucher`, `payment` (documented legacy alias, no live
caller), `owner_statement`, `tenant_statement`, `trial_balance`,
`income_statement`, `balance_sheet`, `generic_report`.

The inventory is machine-enforced: `documentOutputInventory.test.ts` fails if a
Print/PDF call site appears in any module not listed above, or if a listed
module loses its handler-level guard.

## 3. Surfaces deliberately excluded (and why)

| Surface | Reason |
|---|---|
| `features/financials/receipts/receipt-print.ts`, `receipts-page.tsx`, `receipt-detail-card.tsx`, `invoice-detail-section.tsx` | These only **navigate** to the receipt print view (`/receipts?receiptId=…`, a new tab). They produce no document; the destination page (#3) owns readiness and output. |
| `components/ui/entity-action-presets.tsx`, `reports/components/common.tsx`, `invoice-list-section.tsx`, `receipts-section.tsx`, `statement-account-panels.tsx` | Presentation-only. They render a Print/PDF affordance and forward an already-guarded callback supplied by an inventoried owner; they never call the document service. |
| `services/pdfService.ts` | Compatibility adapter retained as an **active boundary** for its historical `{invoice, db}` request shape. It returns the render promise (failures surface), routes through `documentService`, and has no production caller left in `src/features/**` — only test callers. Left in place; removing it is a separate migration. |
| `services/documents/DocumentTemplates.tsx` | Thin compatibility adapters onto the canonical payloads. Imports only `DocumentRenderError` from the renderer, never the renderer itself (locked by test). |
| `/documents-vault` | A document **storage/attachment** vault (upload/list/download of stored files). It renders no generated document and uses no print/PDF engine. Its route-contract conflict is a separate IA issue tracked under `UX-008/GAP-020`; not a print-platform bypass. |
| `*.e2e-fixture.tsx`, `src/features/landing/**` | Dev/marketing-only surfaces, not reachable authenticated document actions. |

## 4. Bypasses found and removed

| Bypass | Where | Disposition |
|---|---|---|
| `printCurrentView()` — a bare `window.print()` that would print the **entire application shell** (nav, sidebar, toasts) with no company-readiness guard, no A4 policy and no document model | `services/action-service.ts` | **Removed.** It had no production caller (dead but exported and reachable). A guard test now asserts the export cannot return, and `documentOutputInventory.test.ts` forbids `window.print()` anywhere in `features/**` and `components/**`. |
| Duplicate private `runDocumentAction` that piped raw `error.message` to the user | `features/contracts/actions/contractDetailActions.ts` | **Removed**, replaced by the canonical guarded helper. |
| Seven report sections invoked the document service with **no handler-level readiness check** (only a `disabled` prop) | `reports/components/{Collections,DeferredRevenue,Expenses,MaintenanceReport,Occupancy,Overdue,PropertyAnalytics}Section.tsx` | **Fixed** — all now use `runGuardedDocumentAction`. |
| Raw `error.message` surfaced to users on document failures (leaking stack frames / query internals) | 11 call sites | **Fixed** — only platform-authored Arabic messages are shown; everything else falls back to the caller's Arabic message. |

## 5. Renderer defects fixed

| Defect | Impact | Fix |
|---|---|---|
| Single-flight key was `type + fileName` only | Two **different** documents that share a generated filename (the registry falls back to `<prefix>-<date>` when no business reference exists — e.g. every invoice due the same day) would coalesce, so the second click silently returned the **wrong document** | Key now includes a content digest of the exact model; identical models still coalesce, different models never do |
| A synchronous throw inside the single-flight body left a permanently poisoned key | Every later activation of that document would silently no-op | `operation()` wrapped; slot always released |
| Concurrent callers could raise an unhandled rejection | Console noise / crash reporting | Stored promise carries a no-op catch; returned promise still rejects |
| Latin print path's revoke watchdog was never cleared on success; `afterprint` listener not `once` | Object-URL and timer leak per print | `revoke()` clears the timer; listener registered `{ once: true }` and close guarded |
| PDF page shells stayed attached to the (still-referenced) page list after capture | Long statements retained every page's DOM | Each shell is detached after its capture |
| Zero visible pages produced a zero-page PDF | A user could receive an empty "statement" and read it as "nothing is owed" | Fails closed with a user-safe Arabic message |
| A throw between container creation and the inner `finally` could leave a tagged render root | Leaked offscreen DOM | Defensive `removeAllRenderContainers()` in `finally` |

## 6. Browser acceptance

Real Chromium (headless), real popups, real downloads, against the local dev
server with only the Supabase HTTP boundary stubbed. Machine-readable results:
`browser-acceptance.json`; artifacts in `artifacts/`.

| Document type | Print | PDF | Artifact |
|---|---|---|---|
| Receipt / payment | ✅ scoped A4 RTL popup | ✅ `%PDF-`, A4 portrait, `receipt-REC-2026-0001.pdf` | `receipt-print-a4.{pdf,png}`, `receipt-download.pdf` |
| Contract / legal | ✅ truthful status wording + signature block | — | `contract-print-a4.{pdf,png}` |
| Owner settlement statement | ✅ | ✅ real owner identity | `owner-statement-print-a4.{pdf,png}`, `owner-statement-download.pdf` |
| Multi-page accounting report (trial balance) | — | ✅ multi-page A4, every page carries content | `trial-balance-multipage.pdf` |
| Mixed Arabic/Latin | ✅ visible in every artifact (Arabic labels + Latin dates/amounts/references) | ✅ | all of the above |

Verified in the browser: Arabic shapes and is correctly directed (RTL);
OMR renders at exactly three decimals (`441.000`, `8,400.000`); negative values
render correctly (`-42.000`); totals, signatures and stamp box are present and
unclipped; the printed document contains **no** `nav`/`aside`/`#root` (the app
shell is never printed); `window.print()` fires exactly once; a rapid
double-click yields exactly one popup and one download; readiness failure
blocks output even when the handler is force-invoked on an enabled button; a
blocked popup produces the Arabic error; and no orphan popup, leaked
`[data-document-render-root]` or unexpected console error remains.

## 6b. Single-flight content identity (deterministic, operation-scoped)

`renderer/documentIdentity.ts` builds the de-duplication key. Contract:

- **Not filename- or date-based.** The registry falls back to
  `<prefix>-<date>` when a document has no business reference, so a
  filename key made two different documents coalesce and returned the wrong
  one. The key hashes the whole model.
- **Order-independent.** Object keys are sorted before hashing, so property
  insertion order (an implementation detail of whichever builder ran) never
  changes identity. Array order is preserved, because row/column order *is*
  content.
- **Operation-scoped.** `print` and `pdf` are distinct channels and never
  coalesce with each other, even when issued concurrently.
- **Total.** Circular references, `bigint`, `symbol`, functions, `Map`/`Set`,
  `NaN`/`±Infinity`, `-0`, invalid `Date`s and throwing getters are all
  encoded. A render can never fail because of its own key
  (`JSON.stringify` would throw on several of these).
- **Opaque.** The key is `channel:type:<24 hex>`. It carries no company,
  party, amount, reference or filename text, is only ever a `Map` key, and
  is never logged, written to the DOM, used in a filename or persisted to
  evidence — asserted by test.

Proven by `renderer/documentIdentity.test.ts` (19) and the runtime
coalescing tests in `documentOutputReadiness.test.ts`: same document + same
channel coalesces (print and PDF each proven separately); print vs PDF never
coalesce; different documents sharing type+filename never coalesce; a
rejected flight is not cached and the retry re-renders; sequential clicks
still produce separate documents.

## 6c. Guard-of-the-guard

A scan that has never failed is not a guard. `documentBoundaryRules.ts`
holds the boundary predicates as pure functions;
`documentBoundaryRules.test.ts` feeds **every** rule a synthetic bypass
fixture and asserts it fires, plus a compliant fixture and asserts it does
not. A completeness test fails if a rule is added without a fixture.
`documentOutputInventory.test.ts` applies those same rule objects to real
repository source, so rules and scan cannot drift apart.

Rules covered: `window.print()`, any `.print()` dialog, iframe printing,
hand-built print HTML/`@page`, popup `document.write`, direct
jsPDF/html2canvas import, deep imports past the service boundary, hand-built
document models, hard-coded company name, hard-coded currency, and raw
`error.message` passthrough. The scan also asserts `printCurrentView()`
stays removed with no production caller.

## 7. Test-harness fidelity fixes (e2e support only)

Two harness defects made the pre-existing acceptance suite unable to reach any
document at all (every protected route failed closed before rendering). Both
are test-support only; **no** authentication, authorization or company logic
was modified.

1. `document-acceptance-session.ts` issued an opaque string as `access_token`.
   Production derives the active company from the `app_metadata.company_id`
   claim **inside the access token** (the same value PostgreSQL sees), so the
   app correctly failed with «تعذر تحديد الشركة النشطة». The fixture now emits
   a correctly **shaped** token, letting the suite exercise the **real**
   resolution path instead of stubbing it.

   Safety properties (asserted by `documentAcceptanceHarness.test.ts`):
   - the signature segment is the literal `not-a-real-signature-e2e-fixture-only`,
     so the token **cannot authenticate anywhere** — any real
     GoTrue/PostgREST/Postgres endpoint rejects it. It is a structural
     fixture, not a credential, and embeds no secret;
   - `sub`, `aud`, `role`, `email` and the `company_id` claim match the
     seeded session user and the seeded **active** `company_members` row
     exactly; the builder **throws** if asked to mint a token for any other
     identity;
   - production Auth/company-resolution code is unchanged and unweakened —
     the browser never verifies signatures (that is a server duty), so the
     real decode → match-membership → unlock path runs end to end.

2. `fake-supabase-backend.ts` answered the set-returning RPC
   `list_permission_requests_for_review` with a lenient `{}` default, which
   crashed the app shell (`.filter is not a function`) on every route.

   Fixed **fail-closed**, not permissively:
   - that RPC is seeded as its own explicit endpoint returning its real
     array contract (`[]` = no pending requests; it grants nothing);
   - the unknown-RPC default now returns **404 `PGRST202`** and logs
     `UNSEEDED RPC`, instead of a permissive `{}` success;
   - unknown table reads log `UNSEEDED TABLE`;
   - every table the visited surfaces actually read is now declared
     explicitly (mostly as empty arrays), and `rpt_dashboard_overview` is
     seeded with zeroed figures so no financial value is invented;
   - the backend stays read-only (mutating verbs → 405) and storage stays 404.

   Behavioural proof (not just a source scan) lives in
   `documentAcceptanceBackend.test.ts`, which drives the harness through a
   fake Playwright route and asserts the real HTTP responses:
   an unseeded table returns **404 `PGRST205`** (never `200 []`, never an
   array, never an empty body), the error cannot be read as a truthful empty
   state by a supabase-js style consumer, the table name never reaches the
   response body (diagnostics only), an explicitly seeded EMPTY table still
   returns `200 []`, unseeded RPCs return **404 `PGRST202`**, writes are
   refused on every table, and storage stays 404.

3. Console-error tolerance is narrow: only the known unreachable
   `realtime/v1/websocket` endpoint of the fake environment is allowlisted.
   Application errors, failed HTTP requests and unexpected production network
   calls are still asserted on, and a guard test forbids a blanket entry.

## 7b. Baseline CI failures observed on this candidate (NOT caused by WP-06)

Both are recorded truthfully; neither is called an infrastructure problem and
neither is closed by this PR.

### `release-blocker-database` → `single-office-isolated.spec.ts` mobile journey

- **Failing expectation:** in
  `opens the core single-office workspaces responsively with real seeded data`,
  the loop asserts for `/contracts`:
  `expect(page.getByText('مستأجر اختبار المكتب الواحد', { exact: false }).filter({ visible: true }).first()).toBeVisible()`
  → element not found on the **mobile** project.
- **Actual rendered state:** below 768px the shared register
  (`components/ui/entity-table.tsx`) renders **only** the identity column, one
  designated datum column and an «إجراءات» disclosure. `ContractTable` sets
  identity = `contract_number` and `mobileVisibleSecondaryKey = "rent_amount"`,
  so the tenant name is **absent from the mobile DOM** by design. The desktop
  project passes because the dense table still renders every column.
- **Classification:** a **stale assertion against a deliberate mobile IA
  change** — not a missing seed, not a route/data mismatch, not
  infrastructure. The seeded tenant row exists and renders on desktop.
- **Baseline or introduced?** **Baseline.** Both the mobile register
  presentation *and* this spec were introduced by the same commit,
  `main@1543928` ("unify mobile registers and global malek header"); the spec
  is 111 added lines in that commit (`git log --diff-filter=A` confirms it was
  created there). It has therefore **never passed**, and it fails identically
  on every branch based on `1543928` while runs predating it are green. WP-06
  changes none of the surfaces involved.
- **Reproduction kept in-repo:**
  `src/components/ui/entity-table.mobile-datum-visibility.test.tsx` proves at
  component level that the tenant name is absent from the mobile register DOM
  and present in the desktop table, and shows that designating the `tenant`
  column as the mobile datum would make it visible.
- **Owner / smallest truthful repair:** the Contracts + shared-registers
  surface (owner of `1543928`), not WP-06. Either designate the tenant column
  as the mobile datum (`mobileVisibleSecondaryKey="tenant"`) or re-anchor the
  spec's mobile expectation to what the canonical mobile register actually
  shows. That is a UX-001/UX-008 register decision and must not be silently
  made from inside a document-platform PR.

### `Browser Readiness / browser-smoke` → CANCELLED

- **Cancellation reason:** job timeout, not a test failure. The job ran
  `05:48:38Z → 06:29:02Z` = **40m24s** against `timeout-minutes: 40` in
  `.github/workflows/browser-readiness.yml`; the step
  "Run complete browser readiness suite" (`pnpm e2e`) was cut off mid-run.
- **Baseline or introduced?** **Baseline.** The last **14** Browser Readiness
  runs — across `arena/019feddd`, `arena/019fee3d`,
  `agent/canonical-pack-reality-closeout`, `arena/019feeac`, `arena/019feee2`
  and this branch — are **all** `cancelled`. The suite has not completed on
  any branch in this window.
- **Contributing factors:** 20 spec files × 3 Chromium projects with
  `fullyParallel: false` and `workers: 1` in CI, plus `retries: 1`.
- **Correct fix (owned by the CI/browser-readiness surface):** shard the
  matrix (e.g. one job per Playwright project) and/or raise the job timeout —
  **without** dropping projects, skipping specs or reclassifying `cancelled`
  as a pass. WP-06 adds 7 tests to this suite; removing them would not make it
  finish, and the fix must not be a coverage reduction.

## 8. Handoff — items inside forbidden areas (not touched)

| Item | Area | Why it is a handoff |
|---|---|---|
| The pre-existing `e2e/document-platform-acceptance.spec.ts` asserts `heading{name:'الفواتير', level:1}` on `/invoices`. That IA no longer exists: `/invoices` binds into the Financials hub (UX-003) where the `h1` is «المالية». 5 assertions are stale and the suite cannot pass as written. | Shared acceptance spec owned outside this track's dedicated specs | Left **unmodified**. WP-06's own coverage lives in `e2e/wp06-document-output.spec.ts`. Recommend a follow-up to re-anchor that spec (or retire it in favour of the WP-06 spec). |
| Invoice document currency displayed as `EGP` in the seeded workspace list while `company_settings.currency` is `OMR` | Money formatting / company-settings resolution outside the document platform | The **document** path is correct (it reads `company_settings.currency`); the divergence is in the workspace list formatter. Not a document-platform defect; needs an owner in the finance/formatting track. |
| Whether each Print/PDF action carries the right *permission* | Role/permission catalog, effective permissions | Deliberately untested here per the conflict-avoidance rules; owned by WP-01. |

## 9. Explicit remaining blockers

- **`seeded-staging-smoke` / `release-blocker-authenticated-staging`: BLOCKED_EXTERNAL, not passed.** Both are `workflow_dispatch`-gated and require
  `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` / `E2E_TEST_EMAIL` /
  `E2E_TEST_PASSWORD`. They reported `skipping` on this PR. A skipped job is
  **not** acceptance evidence and is recorded here as an external blocker.
- **Hosted acceptance is still open.** All browser evidence above was produced
  against a **local** dev server with the Supabase HTTP boundary stubbed. No
  deployed QA/preview environment, live Auth/Postgres/Storage, or real
  credentials were reachable from this sandbox, so hosted critical-journey
  acceptance under `GAP-020` remains **not** satisfied.
- Playwright could not download its pinned Chromium (CDN unreachable); a
  Chromium 149 binary obtained via npm was used with
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. CI should use the pinned browser.
- The realtime WebSocket is unreachable in the sandbox; those console errors
  are explicitly allowlisted in the WP-06 spec as an environment limitation.
- Mobile/tablet document viewports were not re-run in this pass (desktop
  project only).
