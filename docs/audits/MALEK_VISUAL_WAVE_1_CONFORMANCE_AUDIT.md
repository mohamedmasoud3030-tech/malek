# MALEK Visual Wave 1 — Conformance Audit

Date: 2026-08-06
Branch: `fix/ui-malek-pro-visual-wave-1`
Head verified at time of audit: `8c48dba94c813bd1d632b3505f23d211ac8cc5be`
PR: #1357 (open, draft, base `main`)

## Documents actually reviewed

- `docs/decisions/0012-malek-design-system-refresh-roadmap.md` (Accepted,
  2026-08-05) — confirmed present on `main` via `git show`.
- `rentrix-app/src/styles/tokens.css` — confirmed the live semantic token
  layer (sidebar, success, primary families) via direct read.
- `rentrix-app/src/styles/globals.css` — confirmed `@theme` wiring for the
  above tokens into Tailwind utility classes.

`docs/ui-ux/MALEK_VISUAL_CONTRACT_V2.md` and
`docs/ui-ux/MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md` were not located in
the repository at the verified head and were not used as a source for this
audit. Their absence did not block this work; the token contract was
instead derived directly from `tokens.css`, which is the authoritative,
already-shipped implementation.

## Exact PR scope (verified via `git diff main...local-wave1 --stat`)

56 files changed: shared UI primitives (`button.tsx`, `card.tsx`,
`entity-table.tsx`, `mobile-card.tsx`, `section-tabs.tsx`,
`action-menu.tsx`, `bottom-sheet.tsx`, `view-mode-toggle.tsx`,
`empty-state.tsx`, `error-state.tsx`, `loading-state.tsx`), layout
(`app-shell.tsx`, `layout-navigation-view.tsx`, `notifications-menu.tsx`,
`embeddable-workspace.tsx`, `list-page.tsx`, `page-layout.tsx`,
`workspace-sub-nav.tsx`), and feature surfaces already migrated in this PR
(contracts, maintenance, owners, people, portfolio-hub, properties,
relationships-hub, settings, tenants, units), plus new visual-wave-1 test
files, an e2e spec, and before/after screenshots for the properties list.

## Raw palette usages found

A full sweep (`grep -n 'emerald-[a-z0-9-]*\|slate-[a-z0-9-]*'`) across every
`.tsx` file touched by PR #1357 found raw palette usage in exactly **3**
files, all in shared layout components — not in the feature-page files,
which were already using semantic tokens correctly:

| File | Raw classes found |
|---|---|
| `rentrix-app/src/app/layout/app-shell.tsx` | `emerald-600/900/700/400/300`, `slate-800/950/100/50/200/500/400` (quick-add button, mobile drawer sheet, page canvas, skip link, desktop sidebar `<aside>`, header, theme toggle, main content) |
| `rentrix-app/src/app/layout/layout-navigation-view.tsx` | `emerald-300/400/500/700`, `slate-200/50/800/950/500/400` (desktop nav active state, mobile bottom nav active state and bar background) |
| `rentrix-app/src/app/layout/notifications-menu.tsx` | `slate-200/600/950/800/300/50`, `emerald-500` (bell trigger button, unread-badge ring) |

No raw palette usage was found in any of the 31 already-touched
feature/component files outside these three.

## Corrections applied

Each usage was mapped by semantic role, not by mechanical find/replace:

- **Primary actions** (quick-add button, skip-to-content link, mobile
  bottom-nav active indicator/dot/underline) → `bg-primary` /
  `text-primary-foreground` / `ring-primary`.
- **Sidebar surfaces** (desktop `<aside>`, mobile nav drawer sheet,
  desktop nav item hover/active state) → `bg-sidebar` /
  `text-sidebar-foreground` / `bg-sidebar-accent` /
  `text-sidebar-accent-foreground` / `border-sidebar-border`.
- **Application canvas** (page background, main content background) →
  `bg-background`.
- **Borders/dividers** (header border, mobile bottom-nav top border,
  notifications trigger border) → `border-border`.
- **Secondary/muted text and hover surfaces** (header icon buttons, theme
  toggle, notifications bell, mobile bottom-nav inactive state) →
  `text-muted-foreground` / `hover:bg-muted` / `hover:text-foreground`.
- **Ring matching background** (unread-count badge ring, previously
  `ring-slate-50 dark:ring-slate-950`) → `ring-background`.

One usage was deliberately left unchanged: the unread-notification badge
background (`bg-rose-600`) was out of the `emerald-*`/`slate-*` scope of
this audit and reads as an intentional destructive/attention color rather
than a stray raw palette leak. It was not touched, to avoid scope creep
into a color family this audit was not asked to review.

## Files intentionally left unchanged

All 31 feature/component files touched by PR #1357 outside the three
layout files above — they contained no raw `emerald-*`/`slate-*` usage on
inspection and did not require correction.

## Responsive validation

Not independently re-captured as part of this audit pass. The branch
already ships committed before/after screenshots for the properties list
at 375px and 1440px, light and dark, under
`.../after/properties-*.png` and `.../before/properties-*.png`. No new
visual regression tooling was introduced, per scope constraints. A full
375/414/768/1440 re-capture across all Wave 1 surfaces is recommended as
follow-up but was not performed here.

## Light/dark validation

Verified structurally: every corrected class list resolves through
`tokens.css`, which defines both a `:root` (light) and a dark-mode block
for every token used here (`--color-sidebar-bg`, `--color-success-*`,
`--primary`, etc.). No `dark:` variant classes remain needed on the
corrected lines because the semantic tokens already carry light/dark
values — this is an intentional simplification versus the prior
`dark:slate-950`-style pairing, and reduces the chance of light/dark drift.
Visual (screenshot) re-verification was not performed in this pass; see
Responsive validation above.

## Accessibility checks

`focus-visible` rings were preserved and re-mapped to semantic tokens
(`focus-visible:ring-primary`, `focus-visible:ring-sidebar-accent`) rather
than dropped. No `aria-*` attributes, roles, or keyboard handlers were
touched by this pass — only `className` color/surface values.

## Quality gates run

All run against the verified head with the corrections applied, from
`rentrix-app/`:

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass, no errors |
| `pnpm lint` (alias of typecheck in this repo) | ✅ Pass |
| `pnpm check:architecture` | ✅ Pass, no violations |
| `pnpm vitest run src/app/layout` (targeted — full suite known to time out per project history) | ✅ 5 files / 13 tests passed |
| `pnpm build` | ✅ Succeeded (pre-existing large-chunk warnings unrelated to this change) |

## Remaining issues

- Full responsive/visual re-capture (375/414/768/1440, light+dark) across
  all Wave 1 surfaces was not performed in this pass — only the properties
  list has committed before/after evidence.
- The `bg-rose-600` unread-badge color was left as-is; if it should also
  route through a semantic `destructive`/`danger` token, that is a
  follow-up decision, not covered by this audit's emerald/slate scope.
- CI checks (GitHub Actions) were not run as part of this local pass;
  status should be confirmed on the PR itself after push.
