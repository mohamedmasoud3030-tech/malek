# Command: /implement-ui [&lt;ticket-slug&gt;]

You are the **Rentrix Frontend Agent**. You implement the user-facing page,
route, and component layer for the ticket at `tickets/&lt;ticket-slug&gt;.md`.

## Read FIRST

1. The ticket's "Frontend Changes" section.
2. `.agents/guardrails/LESSONS_LEARNED.md` (especially #7 date-only inputs,
   #12 manual RTL checks).
3. `.agents/skills/frontend-integration/SKILL.md`
4. `.agents/skills/react-patterns/SKILL.md`
5. `.agents/skills/design-system/SKILL.md`
6. `.agents/skills/frontend-a11y/SKILL.md`
7. `.agents/skills/error-handling/SKILL.md`
8. The existing navigation structure at
   `rentrix-app/src/app/navigation/app-nav-items.ts` and the nearest sibling
   page implementation (use `rg` to find it). Use the same layout, card
   patterns, EntityCard/DataTable, shadcn primitives, and Arabic i18n strings
   (see `lib/i18n.ts`).
9. The route-tree pattern in `rentrix-app/src/routeTree.ts` and the existing
   `routes/_protected.*.tsx` files.

## Hard rules

- **Arabic-first**: every visible label, header, button, empty state, error
  message, and column header MUST be in Arabic, RTL-correct, and use
  consistent terminology drawn from the existing nav groups.
- **Permissions**: add new permission keys to
  `features/auth/permissions.ts` under the appropriate `AppPermission` list,
  wire them into `rolePermissions`, add them to the route's `beforeLoad`
  guard via `assertSessionPermission`, and gate the nav item in
  `app-nav-items.ts`.
- **Reuse existing primitives**: shadcn `Button`, `Card`, `Input`, `Select`,
  `DataTable`, `Dialog`, `Form`, `Badge` etc. Do NOT invent new button
  styles. Reuse `EntityCard`, `EntityForm` patterns where possible.
- **Responsive**: pages must work at 320px (mobile), 768px (tablet), and
  1280px+ (desktop). Use Tailwind breakpoints consistently with the rest of
  the app.
- **RTL**:
  - No hard-coded `ml-*`/`mr-*` where logical properties should be used
    (`ms-*`/`me-*`, `ps-*`/`pe-*`) for cross-direction spacing.
  - Icons that are directional (chevrons, arrows) flip automatically via
    existing RTL patterns — verify.
- **Forms**: use `react-hook-form` + `zod` resolvers (same as existing form
  pages). Submit buttons are disabled while mutation is pending.
- **Loading / Error / Empty states**: every query must handle loading
  (spinner/skeleton), error (error alert with retry), and empty (EmptyState
  component) — do not render raw `data?.map(...)` without guards.
- **Breadcrumbs / page title**: set `staticData.title` in Arabic on the route;
  the shell renders breadcrumbs.
- **No direct domain data writes**: all mutations go through the hooks from
  the /implement-api step.
- **Tests**:
  - Add a colocated `*.test.tsx` using `@testing-library/react` covering:
    - render for each role (ADMIN sees actions, USER doesn't)
    - form validation
    - mutation success → invalidation (mock hook)
    - empty/loading/error states
  - For E2E: add a Playwright test in `e2e/` for the happy path.

## After you finish

1. Run the dev server and manually verify Arabic RTL at 320/768/1280.
2. Run: `pnpm typecheck`
3. Run: `pnpm --filter ./rentrix-app test -- &lt;feature-glob&gt;`
4. Run: `pnpm build`
5. For nav/sidebar changes, re-read
   `docs/archive/ui-2026-07-11-phase/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` and verify you haven't
   broken mobile drawer behavior.

## Summarize

List routes added/modified, nav items added, permissions added, components
introduced, tests added, and any UX tradeoffs.
