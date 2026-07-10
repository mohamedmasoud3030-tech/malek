# UI/UX release-readiness plan — Rentrix

Date: 2026-07-10
Target internal completion: 2026-07-20
Launch deadline: 2026-07-27
Active app: `rentrix-app`

## Operating principle

The goal is production readiness, not cosmetic polish. A UI/UX item is only considered ready when the current route exists in `rentrix-app`, uses real services, has loading/empty/error states, behaves acceptably in Arabic RTL, and has an explicit verification note.

Docs remain routing evidence only. Current code, live routes, and browser behavior win whenever docs disagree.

## Priority order

### P0 — Navigation and mobile shell

Goal: users can reach every operational screen without dead ends or confusing primary actions.

Current evidence:

- `AppShell` owns desktop sidebar, mobile drawer, header, bottom navigation, and safe-area-aware main padding.
- `navGroups` and `mobileNavItems` are centralized in `rentrix-app/src/components/layout/app-nav-items.ts`.
- The earlier UX audit flagged bottom-nav/drawer overlap, horizontal tab behavior, and mobile drawer/back behavior as requiring device validation.

Work items:

1. Verify every bottom-nav route and drawer route after PR #1090, including `/ai-assistant`.
2. Remove misleading icon semantics. Header icons must match behavior: search means search, quick actions mean create/actions.
3. Keep mobile bottom nav to true high-frequency destinations only; route families should live in drawer/sidebar unless there is a product reason.
4. Check safe-area, sticky header, bottom nav overlap, and drawer close/back behavior on 375px and 768px viewports.

### P0 — Mobile form and list ergonomics

Goal: dense operational screens remain usable on phones before launch.

Current first fix:

- `SearchInput` now uses `text-base sm:text-sm` so shared search fields avoid iOS input zoom while preserving compact desktop density.
- The clear button keeps a 44px touch target while the visual icon remains compact.

Next candidates:

1. Audit shared inputs/selects/search fields for mobile font-size and touch target consistency.
2. Ensure list pages with tables have mobile card alternatives or intentionally prioritized columns.
3. Ensure dialogs and sheets are scrollable under mobile keyboard pressure.
4. Prefer shared `SearchInput`, `EntityTable`, `EmptyState`, `LoadingState`, and `PageStateCard` over feature-local one-off patterns when the change is local and safe.

### P1 — Visual consistency and Arabic RTL polish

Goal: app feels like one product, not separate pages stitched together.

Work items:

1. Standardize page headers where low-risk.
2. Reduce feature-local filter/header variants only after confirming no behavior changes.
3. Review hardcoded status colors for contrast in light and dark mode.
4. Keep logical RTL classes (`ps`, `pe`, `ms`, `me`, `start`, `end`) as the default.

### P1 — Accessibility and release evidence

Goal: no obvious keyboard, focus, label, or semantic regressions before launch.

Work items:

1. Add/extend browser smoke coverage for authenticated navigation when seeded staging credentials are available.
2. Verify interactive UI has semantic buttons/links and clear labels.
3. Keep error states linked to form fields when a field-level error exists.
4. Do not claim accessibility is complete from code review alone; browser/keyboard pass is required.

## Release gate wording

Use these labels consistently:

- Code complete: implementation exists in `rentrix-app`.
- Verified: relevant automated checks or browser steps ran and passed.
- Release ready: verification, environment needs, risks, and rollout/rollback notes are documented.

## Current known limitation

This document is a planning and tracking document. It does not replace real browser QA. The existing `Browser Readiness / E2E Smoke` workflow is useful but not enough for authenticated mobile operational journeys until seeded staging credentials are configured.
