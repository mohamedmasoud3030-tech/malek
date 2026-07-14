# Phase 0 UX foundation evidence

Issue: #1155  
Branch: `codex/ux-foundation-mobile-forms-theme-contract`  
PR: #1156

## Scope boundary

This evidence covers the shared mobile/page/form foundation only. Reports, Settings, Dashboard, and Login redesign work is not included. No schema, migration, RLS, RPC, auth, permission, or financial calculation code is changed.

## Baseline findings from current `main`

| Area | Before Phase 0 | Risk |
| --- | --- | --- |
| `EntityForm` validation | Form submission did not own a generic first-invalid focus/scroll contract | Validation could leave the user away from the failing control on long mobile forms |
| `BottomSheet` height | Used `100dvh` calculations only | The software keyboard could reduce the visual viewport without reducing the sheet |
| `BottomSheet` focus | First focusable element could be the header close button | The first data-entry control was not guaranteed to receive initial focus |
| Sheet scroll ownership | Body overflow was locked, but the document element was not; the sheet was rendered in place | Background/nested scroll behavior depended on the parent stacking and overflow context |
| Dialog form scrolling | `DialogContent` and form content shared the same scrolling surface | Sticky headers/footers and nested form scrolling were difficult to reason about consistently |
| Action footer clearance | Sticky actions used safe-area padding but there was no shared scroll clearance contract | The last field could be visually covered while the footer was sticky |
| Compact controls | `Button size="sm"` was 40×40 on mobile | Below the 44×44 coarse-pointer target used by the rest of the UI |
| Page gutters | Main content relied on breakpoint-specific utility values only | Shared viewport containment and narrow-width gutter ownership were not explicit |

## Implemented contract

1. `EntityForm` now resolves `auto`, `bottom-sheet`, `dialog`, and `full-page` surfaces explicitly.
2. Long person create/edit workflows select `full-page` on mobile; existing shorter entity forms continue through the automatic bottom-sheet/dialog contract.
3. Failed validation finds the first `[aria-invalid="true"]`, `[data-invalid="true"]`, or native invalid control, centers it, and focuses it.
4. Action footers expose `data-entity-form-actions`; shared CSS reserves scroll clearance including safe-area inset.
5. `BottomSheet` is portalled to `document.body`, locks both `body` and `html`, focuses the first content control, traps focus, restores prior focus, and uses `--visual-viewport-height`.
6. `DialogBody` provides one explicit form scrolling region while the header remains outside that region.
7. The root route tracks `window.visualViewport` resize/scroll events and updates `--visual-viewport-height`.
8. Shared foundation CSS owns page gutters, min-width containment, form scroll padding, coarse-pointer touch targets, and reduced-motion behavior.

## Browser matrix

`rentrix-app/e2e/ux-foundation.spec.ts` executes the shared form contract at these exact sizes:

| Viewport | Light RTL | Dark RTL | Assertions |
| --- | --- | --- | --- |
| 360×800 | covered | covered | no horizontal overflow, first-invalid focus, last field above actions |
| 390×844 | covered | covered | same plus explicit reduced visual viewport BottomSheet test |
| 430×932 | covered | covered | no horizontal overflow, full-page mobile form behavior |
| 768×1024 | covered | covered | dialog/tablet containment and focus behavior |
| 1440×1000 | covered | covered | desktop dialog containment and focus behavior |

Screenshots are written per matrix case as:

`ux-foundation-<viewport>-<theme>.png`

The fixture is available only when `VITE_E2E=true` through the existing `/login` route query `e2e-form-contract=1`. It performs no authentication, data fetch, mutation, RPC, or financial operation.

## Automated checks

Required commands:

```bash
pnpm typecheck
pnpm lint
pnpm --filter ./rentrix-app run typecheck:test
pnpm --filter ./rentrix-app run check:architecture
pnpm --filter ./rentrix-app test
pnpm build
pnpm e2e
```

Final CI run IDs and results are recorded in PR #1156 after the head commit stabilizes.

## Exit-condition mapping

| Exit condition | Evidence |
| --- | --- |
| No unintended overflow at 360px | Playwright checks both document and body scroll widths |
| Keyboard does not cover fields/actions | Visual viewport CSS variable drives sheet/full-page height; reduced-height browser assertion included |
| Last field and final action remain reachable | Shared scroll padding + geometry assertion against sticky actions |
| Focus/error behavior covered | Unit test for `focusFirstInvalidField` + Playwright failed-submit focus assertion |
| Light/dark and RTL on phone/tablet/desktop | Ten matrix cases across five sizes and two themes |
| No Reports work before merge | No Reports files are changed in this PR |