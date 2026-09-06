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
  Phase 8 took the second option (see below).
- No canonical file-size formatter existed (resolved in Phase 8: `formatFileSize` in
  `src/lib/formatters.ts`). The four divergent copies were:
  `components/documents/contextual-documents-section.tsx` (`«N.N ك.ب»`),
  `features/documents-vault/components/documents-vault-workspace.tsx` (`«N.N KB»`),
  `features/financials/reconciliation/bank-csv-import-workflow.tsx` (`«N.N KB»` inside
  an Arabic sentence) and an inline MB message in
  `features/documents-vault/documents-vault-service.ts`.
- The mobile quick-add sheet in `app/layout/layout-navigation-view.tsx` uses
  `role="menu"`/`role="menuitem"` on navigation links without arrow-key roving focus
  (`mobile-quick-add-list.test.tsx` asserts the current structure). Same defect class as
  the property wizard above, but it sits in the shared shell with a test that encodes
  the current pattern; it needs a deliberate shell decision rather than a drive-by fix.
- `features/properties/property-form-modal.tsx` had no DOM-level test for its header
  semantics. Phase 8 added one (`src/features/properties/property-form-modal.test.tsx`)
  on the harness the properties page interaction test already proves out.
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
card's primary/secondary buttons. It was deliberately not done in that sweep because another agent was
active in the financial-document boundary. Phase 8 verified the overlap
(`GET /pulls?state=open` returned exactly one open PR, whose 134-file list does not
contain `e2e/`) and repaired the contract — see the Phase 8 section below.

---

## Phase 8 — mobile acceptance, shared menu behavior, and dead-surface removal

Continued from `main` at `c5ad6791`. Every diagnosis below was reproduced on current
`main` first; no conclusion from Phase 7 was carried over as fact.

### The five mobile failures: one stale contract, one real product defect

Reproduced at `c5ad6791`: all five failed — four while waiting on an element that
never appears (90–120 s) and one on a download event that never fired. Two different
causes:

1. **Stale test contract** (`e2e/document-platform-acceptance.spec.ts`). The invoice
   register supplies *structured* mobile-card actions, so `entity-table.tsx` renders the
   row's secondary operations in `EntityCard`'s own overflow menu and never renders the
   `data-entity-table-mobile-actions` disclosure. The spec's helpers still waited for
   that disclosure and for `button /^طباعة/` / `button /^تنزيل/` on the card face —
   markup this register cannot produce. `expectInvoiceDocumentActionsWithheld()` was also
   *vacuously* green: it asserted `toHaveCount(0)` for buttons that never exist, so it
   could not have detected a withheld-actions regression at all.
   Repair: the mobile branch drives the canonical surface — the card's
   `[data-action-menu-trigger]` — and print/download resolve to `menuitem «طباعة»` and
   `menuitem «PDF»` inside the opened `role="menu"` on both viewports. The mobile branch
   now asserts the trigger is **row-scoped** (`toHaveAccessibleName(/فاتورة بلا مرجع/)`)
   and the withheld check opens the same menu to prove `تحصيل` is present while
   `طباعة`/`PDF` are absent, replacing an assertion that could never fail.
2. **Real product defect** (`components/ui/action-menu.tsx`, affecting every register).
   `positionMenu()` anchored the portalled menu at `trigger.bottom + 4` with
   `overflow-hidden`, no viewport clamp and no flip. On a 375- or 414-px viewport the
   last items of a card overflow menu rendered *below the fold of a fixed layer*, where
   neither a scroll gesture nor Playwright's actionability check can reach them —
   `element is outside of the viewport`, forever. A phone user could not tap PDF export
   on an invoice at all.
   Repair: `resolveActionMenuPlacement()` flips the menu above the trigger when it does
   not fit below, caps its height to the space that exists (scrollable instead of
   clipped), clamps the horizontal anchor, and the menu repositions on `scroll`/`resize`
   so it keeps following its row. Unit-tested in
   `src/components/ui/action-menu.placement.test.ts`.

One test-side repair was needed as well: `double-clicking print/PDF never duplicates the
operation` double-taps a menu item, and the second tap lands on the card underneath and
opens the quick view. The register is then legitimately `aria-hidden` behind a modal, so
the test returns to the register (Escape + assert the dialog is gone) before exercising
the download. The contract under test — exactly one popup and exactly one download —
is unchanged and still proven.

### One shared menu keyboard authority

`role="menu"` obligates arrow-key navigation. `ActionMenu` implemented it inline; the two
ad-hoc shell menus announced a menu and implemented only Escape/outside-click, and the
mobile quick-add `aria-controls` pointed at the panel *title* instead of the panel.
`components/ui/menu-keyboard.ts` is now the single authority — `focusMenuItem()` plus
`useMenuKeyboardNavigation()` (ArrowUp/Down with wrapping, Home/End, Escape closing and
returning focus, Tab leaving the pattern) — used by `ActionMenu`, the account menu and
the quick-add sheet, which also focuses the first destination on open. The account menu
additionally had a `role="status"` card inside its `role="menu"` element, which a menu
may not contain; the panel now wraps it and only the actions carry the menu role.
Proofs: `mobile-quick-add-list.test.tsx` (arrow/Home/End/Escape focus handoff,
`aria-controls` → controlled panel), `account-permission-status-polish.test.tsx`
(status outside the menu), `mobile-shell-navigation-polish.test.tsx` (menu items,
geometry on the panel, Escape returns focus), `action-menu.interaction.test.tsx`
(unchanged contract through the shared module).

### Canonical file size

`formatFileSize()` lives in `src/lib/formatters.ts` with the module's existing
conventions (Latin digits via `normalizeLocale`, `null` when there is nothing to show).
Data surfaces get `12.4 KB`, prose gets `5 ميغابايت`, and validation messages derive the
limit from the constant they enforce instead of typing `5MB` next to it. Migrated: the
contextual documents section, the vault workspace list, the vault upload validator, the
bank-CSV import preview and its size guard, the shared attachment field, and the office
import guards. Guarded by a source contract so no migrated surface can divide by 1024
again, and the office-import test's `5 ميجابايت` spelling was corrected to the single
canonical one.

### Removed, not left behind

- The retired marketing surface: `Showcase.tsx`, `Security.tsx`, `FinalCta.tsx` and the
  helpers only they used (`Reveal.tsx`, `landing-section-heading.tsx`), the 20 MB of
  `public/landing` screenshots and demo video, nine dead sections of `i18n/messages.ts`
  (474 lines), and the marketing anchor navigation that `/privacy` and `/terms` still
  rendered into a redirect (`NavBar` section links, `Footer` product column). The live
  legal surface keeps `LegalPage`, `NavBar`, `Footer` and `constants.ts`.
- `toLatinLocaleString` / `toLatinLocaleDateString` / `toLatinLocaleTimeString`: the
  backwards-compatible wrappers around the retired `Date`/`Number` prototype shims had
  no consumer left; the prototype-hygiene guards stay and now also forbid re-export.

### Retained on purpose

Exports with no production caller but a contract test — `src/lib/money.ts` validation
helpers, `src/lib/brand.ts` asset paths, `src/lib/lena-endorsement.ts`,
`paginatedRead`'s page-size constants — are deliberate single-source-of-truth surfaces,
not residue; a repo-wide file-level orphan scan after these deletions returns nothing
(`import.meta.glob` is not used for runtime discovery anywhere in the app, so no file is
reachable only through a glob).


## Phase 9 — integrating this branch with the parallel Finance sweep

Two branches were developed on top of the same `main` (`c5ad6791`) by two agents: the
Phase 8 quality closure (menu reachability, one file-size formatter, retired marketing
surface, property-wizard DOM coverage) and `arena/01a0713a-malek` (PR #1806, four passes
of Finance/report duplicate elimination, whose head `7831f60` also merged `main` into
itself). They were **not** disjoint: both touched nine files, and Git reported only six
conflicts. The overlap map was built from `git diff --name-only` on each side against
current `main` before anything was merged, and every shared file was then read, not
auto-resolved.

Four responsibilities were solved twice, in parallel, with different code. Each kept one
canonical implementation:

| Responsibility | Outcome |
| --- | --- |
| File-size formatting | `lib/formatters.ts` `formatFileSize` (this sweep) wins: it covers B–TB, promotes when rounding reaches the next base, returns `null` when there is nothing to display, and can render Arabic unit words. The Finance variant (KB/MB only, `'—'` for missing) was auto-merged **alongside** it in the same file — a duplicate definition Git did not report — and is removed. Its two deliberate strengths are absorbed: a second decimal above the megabyte (`2.25 MB`, not `2.3 MB`) and the pinned `'en'` locale no-op. |
| Menu reachability | `resolveActionMenuPlacement` (flip above, cap to the room that exists, horizontal clamp, reposition on scroll/resize) wins over the in-component `bottom`-anchor variant, because it is unit-tested and also handles the case where neither side fits. The Finance fallback `max-h-[calc(100dvh-1rem)]` replaces the `80vh` guess: mobile browser toolbars are dynamic. |
| Double-tap fall-through | The Finance fix is kept: selecting an item unmounts the menu synchronously, so the second click of a double-tap landed on the invoice card underneath. It moved out of `action-menu.tsx` into `components/ui/menu-click-shield.ts`, because the property belongs to any menu that dismisses itself on activation — the mobile quick-add sheet had the same shape. Their unit test is the contract; the browser step that used to *work around* the fall-through now asserts the shield holds. |
| Acceptance spec helpers | Union. Their `aria-controls`-bound menu resolution, `aria-expanded` idempotency and "exactly one open menu" proof, with this sweep's row containment for the desktop trigger, menu-scoped item locators with no `.first()`, and a non-vacuous withheld check. The card-face `toHaveCount(0)` lines stay removed: the register never renders those buttons, so they could never fail. |

Preserved from the Finance branch, untouched: the statement line-type ledger,
`reports/documents/report-cells.ts`, `lib/maintenanceStatus.ts` owning status/priority
labels, the `communication-schema` / `land-schema` label de-duplication, and its
dead-export and unreferenced-fixture removals (re-verified here: `QuickAction`,
`QuickActionBar` and `MobileActionGrid` have no consumer, and no live import points at
any deleted fixture). Nothing from either branch was dropped, and no test was weakened to
reach green — the single retargeted assertion (their `style.bottom === '44px'` placement
pin) was rewritten to the equivalent geometry of the winning implementation, with the
failure mode it guards against named in the comment.

### Two findings deliberately left open

- `features/financials/invoice-list-section.tsx` labels the desktop row menu
  `إجراءات ${invoice.reference ?? 'الفاتورة'}`, so the label is only row-specific when a
  reference exists. The acceptance contract is specific anyway (the trigger is bound to
  the `<tr>` containing the invoice), and the copy belongs to the Finance sweep, so it was
  not rewritten during integration.
- `app/layout/notifications-menu.tsx` carries a fourth arrow/Escape/focus-restore
  implementation. It was **not** folded into `menu-keyboard.ts`: its panel is
  `role="dialog"` with a `role="status"` block and an error `role="alert"` among its
  children, and the shared hook's semantics (wrapping `[role=menuitem]`, Tab closes) would
  change both the ARIA contract and the keyboard behavior of a live surface. That is a
  follow-up accessibility task, not an integration step.

### Validation environment note

`login-flow`, `login-simplification` and part of `readiness-smoke` drive the **real**
login form, which `lib/runtime-diagnostics.ts` disables whenever Supabase public config is
missing *or placeholder* (`example.supabase.co`, `invalid.supabase.local`,
`test-anon-key`, `invalid-anon-key`). `playwright.config.ts`'s built-in dev-server fallback
uses exactly those placeholders, so those specs fail on any branch — including `main`,
verified by running them at `c5ad6791`. The document acceptance suite simultaneously tolerates
only the placeholder hosts in its realtime console filter. CI resolves both constraints with
`VITE_SUPABASE_URL=https://e2e.invalid.supabase.local` and
`VITE_SUPABASE_ANON_KEY=e2e-browser-public-key` (a host that is configured for the app yet
substring-matched by the filter), and that is the env the local browser battery must use.

### Integrated-branch gate results

Run on `integrate/phase8-and-finance-canonical` with the CI browser env above, serialized
(two vCPUs / 2 GB), after every reconciliation step:

| Gate | Result |
| --- | --- |
| `chromium-mobile`, full project | 92 passed, 0 failed, 83 skipped |
| `chromium-desktop`, full project | 159 passed, 0 failed, 16 skipped |
| `chromium-tablet`, full project | 80 passed, 0 failed, 95 skipped |
| document acceptance, mobile + desktop | 20 passed, 0 failed, 6 skipped |
| Vitest (app suite) | 508 files, 3527 tests, 0 failed |
| `tsc -p tsconfig.json --noEmit` | clean |
| `check:architecture` / `check:enterprise-freeze` | clean / PASS |
| `scripts/check-doc-links.mjs` | PASS (10 files) |
| `pnpm build` (PWA precache 28 entries, 430 KiB) | clean |

The separate test-project typecheck (`tsconfig.test.json`) still cannot run in this
sandbox — it aborts under the memory cap, a limit recorded before this phase; the test
files are executed by Vitest and type-checked as part of the app project where they are
imported, so no gate was skipped silently, only this one redundant check.
