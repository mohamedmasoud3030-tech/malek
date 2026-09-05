# Product Quality Sweep — main after Reports & Statements

Scope: the working state of `main` immediately after PR #1804 (Reports & Statements
finalization) was squash-merged as `7546a729`. This sweep is evidence-driven: every
change below is either a reproduced failure with a root cause, or a duplication or
dead-code finding proven by a reference scan across the whole repository.

Method note: a browser failure was only treated as a product defect after the same
spec was run against the pre-merge commit. All three failures reproduced at
`64e3fdd3`, so none of them were caused by the Reports & Statements merge.

## Baseline and result

| Gate | Before | After |
| --- | --- | --- |
| Playwright desktop suite (`pnpm e2e --project=chromium-desktop`) | 156 passed, 3 failed, 16 skipped | 159 passed, 0 failed, 16 skipped |
| Playwright mobile suite (`--project=chromium-mobile`) | 5 failed in `document-platform-acceptance.spec.ts`, service-provider spec failed | service-provider spec passes; the 5 acceptance failures remain (see below) |
| Full Vitest suite (`--no-file-parallelism --pool=threads`) | 506 files, 3510 tests green | green |
| `tsc -p tsconfig.json --noEmit`, `tsc -p tsconfig.test.json`, architecture, register inventory, enterprise freeze, docs links, `vite build` | green | green |

### main's real browser gate was red, and still is partially

`.github/workflows/browser-readiness.yml` defers the device matrix on ordinary pull
requests, so PR #1804's green check list never exercised these specs. The matrix does run
on pushes to `main`, and it reported at `7546a729`:

| Shard | CI failures at `7546a729` | Same failures at `64e3fdd3` (before the merge) |
| --- | --- | --- |
| `chromium-desktop` | `contracts-entity-table.spec.ts:9`, `service-providers-workspace.spec.ts:39`, `wave4-design-system-390.spec.ts:104` | yes — identical three |
| `chromium-tablet` | `service-providers-workspace.spec.ts:39` | yes |
| `chromium-mobile` | `service-providers-workspace.spec.ts:39` plus five `document-platform-acceptance.spec.ts` cases | yes |

So none of these were introduced by the Reports & Statements merge: they reproduce on the
main commit immediately before it, and they reproduce locally in Chromium. This branch
repairs the desktop, tablet and service-provider mobile failures. The five
`document-platform-acceptance` mobile cases are pre-existing and explained below.

## Failures fixed

### 1. `e2e/contracts-entity-table.spec.ts` — keyboard row activation

The spec asserted the text «بيانات المستأجر» after pressing Enter on a contract row.
Two independent problems:

- `ContractResults` never renders inline row expansion. `EntityTable` enables it only
  when `renderRowExpansion` is passed, and the contracts table does not pass it. The
  real keyboard contract is row activation → Quick Preview, which the assertion could
  never observe.
- The e2e fixture was inert: `const [, setPreviewContractId] = useState(null)`
  discarded the value and no `ContractPreviewDialog` was rendered, so activation
  silently did nothing. The old assertion still could not notice, because the dialog's
  empty-state title is `معاينة العقد` — the string it happened to look for.

Fix: `contracts-list.e2e-fixture.tsx` now mirrors `ContractsListPage` (real
`previewContractId` state, `previewContract` resolved from the *filtered* rows,
`ContractPreviewDialog` rendered). The spec now reads the activated row's own contract
reference and tenant from the table, asserts the dialog is named by *that* contract,
shows *that* tenant, exposes the footer action, and closes on Escape.

### 2. `e2e/service-providers-workspace.spec.ts` — stale row-action vocabulary

The spec expected `menuitem «عرض»`. No such item exists: the canonical read-only row
menu for a provider is «فتح الملف الكامل» + «معاينة سريعة» (plus «تعديل»/«أرشفة» when
the user can write). The fixture also had an inert action (`onClick: () => undefined`)
and never rendered `ServiceProviderPreviewDialog`, so the preview affordance was
untested rather than broken.

Fix: the fixture mirrors the production read-only action set and opens the real quick
preview; the spec asserts the menu belongs to the provider left on screen by the
filter, that both canonical items exist at ≥44px, that activating the preview opens the
dialog named after that provider, and that Escape closes it. On the mobile project the
menu is driven by the keyboard instead of a pointer, because the fixture mounts itself
as `fixed inset-0 z-[200]` and the auth shell keeps the pointer hit-test — the keyboard
path additionally proves the menu's roving focus.

### 3. `e2e/wave4-design-system-390.spec.ts` — false positive on `sr-only` controls

The 44px heuristic measured every rendered `input`, including the deliberately clipped
1×1 file input inside the office-launch upload label. That markup is correct
(`type="file"` with `className="sr-only"` wrapped in a `min-h-11` label); the affordance
the customer aims at is the label. The heuristic now resolves a screen-reader-only
control to its wrapping `label`/`button`/link and measures that instead — which *adds*
a check: a 24px upload label now fails (verified).

## Quality items fixed

- The two portal twins each held a private `new Intl.DateTimeFormat('ar-OM-u-nu-latn')`
  (owner-portal also a private `NumberFormat` for percentages) — the prototype-patch
  shape `lib/formatters` exists to retire. Both now delegate to
  `formatLatinDate`/`formatLatinNumber` with the same explicit locale. Verified
  output-identical against the previous implementations over parseable, unparseable,
  empty and null inputs before the scratch comparison was deleted.
  The wider picture is reported rather than half-fixed here: roughly ten surfaces still
  format dates with their own `Intl` call (`components/layout/page-header.tsx`,
  `features/dashboard/**`, `features/governance-hub/**`,
  `features/communication/**`, `features/financials/reconciliation/**`,
  `features/reports/components/ServicesReportSection.tsx`,
  `features/help-support/**`, `components/documents/**`). Most are not drop-in
  duplicates — the Reports one deliberately anchors date-only strings with
  `T00:00:00` before formatting to avoid a UTC day shift, which the canonical helper
  does not do, so "deduplicating" it would be a behavior change. Nothing enforces a
  single date path today: `lib/formatters.test.ts:202` records the historical dedup but
  no architecture guard forbids raw `Intl`.
- `features/properties/property-form-modal.tsx` announced its 3-step wizard as
  `role="tablist"` with `role="tab"` buttons while owning no `role="tabpanel"`, no
  `aria-controls` and no arrow-key navigation: assistive technology described a tab
  widget whose keyboard contract did not exist. The header is now a labelled `nav` and
  the current step carries `aria-current="step"`, with identical visuals and gating.
  `mobile-accessibility-ux.test.ts` was rewritten to lock in the corrected semantics
  and to forbid the incomplete tab markup from returning.
- `components/ui/entity-card.tsx` named every mobile card's overflow menu
  `المزيد حول إجراء` ("more about action"). The label was built with
  `actionLabelText(name)`, and that helper returns the placeholder string `إجراء` for
  any non-text React node — which is exactly what `EntityTable` passes as the card
  title (`<span data-entity-table-mobile-primary>…</span>`). A screen-reader user
  browsing ten invoice cards heard ten identical, contentless names. The card now
  derives the name from the rendered title through the same helper the table already
  uses for its own row label, so the menu is announced as the row it belongs to. In
  Chromium at 375px the invoice card's trigger reads
  `المزيد حول فاتورة بلا مرجع إصدار 01/07/2026`. `nodeToText` moved from a private
  function in `entity-table.tsx` to `lib/utils.ts` and is shared by both surfaces —
  one copy, no second implementation.
- `features/landing/components/Frames.tsx` deleted. Its three exports
  (`BrowserFrame`, `PhoneFrame`, `FrameCaption`) had zero references anywhere in the
  repository — not in the disconnected landing sections, not in tests, docs or config.

## Findings recorded, deliberately not changed

- Parked marketing landing. `routes/landing.tsx` redirects `/` to `/login` and
  documents that the marketing implementation is disconnected "until its performance is
  fixed" (`f2db92c5`). `Showcase.tsx`, `Security.tsx`, `FinalCta.tsx` and their private
  helpers (`Reveal.tsx`, `landing-section-heading.tsx`) are therefore unreachable from
  the app, but `Showcase`/`FinalCta` are still guarded by `brand-contract.test.ts` and
  `landing-performance-contract.test.ts`. Deleting them would reverse an explicit
  product decision, so they are reported here for an owner call: re-enable and fix the
  performance, or retire the section set and its two contract tests together.
- No canonical file-size formatter exists. Four divergent copies:
  `components/documents/contextual-documents-section.tsx` (`«N.N ك.ب»`),
  `features/documents-vault/components/documents-vault-workspace.tsx` (`«N.N KB»`),
  `features/financials/reconciliation/bank-csv-import-workflow.tsx` (`«N.N KB»` inside
  an Arabic sentence) and an inline MB message in
  `features/documents-vault/documents-vault-service.ts`. Unifying them means adding a
  shared helper and touching the Finance agent's reconciliation flow, which is outside
  this sweep's ownership boundary.
- The mobile quick-add sheet in `app/layout/layout-navigation-view.tsx` uses
  `role="menu"`/`role="menuitem"` on navigation links without arrow-key roving focus
  (`mobile-quick-add-list.test.tsx` asserts the current structure). Same defect class as
  the property wizard above, but it sits in the shared shell with a test that encodes
  the current pattern; it needs a deliberate shell decision rather than a drive-by fix.
- `features/properties/property-form-modal.tsx` has no DOM-level test for its header
  semantics — the contracts around it are source-text contracts. Adding a render test
  would need query/form providers that no existing properties test wires up.
- CI caveat that allowed these stale assertions to survive: on ordinary pull requests
  `browser-smoke` is a stub that echoes "Ordinary PRs keep the browser matrix deferred"
  (`.github/workflows/browser-readiness.yml`), and the real shard only runs outside PR
  events or on `release/rc-closeout-*`. A green PR check list is not browser evidence.

### The five remaining `document-platform-acceptance` mobile failures

Root cause: `components/ui/entity-table.tsx` offers two mutually exclusive mobile-card
action mechanisms — a disclosure driven by `actionsColumn` (`data-entity-table-mobile-actions`
plus `data-entity-table-mobile-actions-panel`), and structured actions rendered by
`EntityCard` (primary / secondary / overflow). The disclosure branch is guarded by
`!hasStructuredActions && actionsColumn`. The invoice register supplies structured
actions, so its mobile cards legitimately have no `data-entity-table-mobile-actions`
element — while `openInvoiceDocumentActions()` in the acceptance spec waits for exactly
that attribute inside `[data-entity-table-mobile-card]`, which is why five mobile cases
time out at 90–120s while the equivalent desktop and tablet cases pass (they address
`إجراءات الفاتورة` directly).

This is a stale test contract, not a broken flow: the actions are present and named in
the accessibility tree. The fix is to retarget that helper at the card's own overflow
menu — now reliably row-scoped after the `entity-card.tsx` change above — or at the
card's primary/secondary buttons. It is deliberately not done in this sweep because
`document-platform-acceptance.spec.ts` is the financial-document acceptance suite and
another agent is actively working in that boundary; landing a rewritten browser-evidence
path for invoice print/PDF on top of their in-flight changes would be exactly the kind
of silent interference this repository cannot afford.
