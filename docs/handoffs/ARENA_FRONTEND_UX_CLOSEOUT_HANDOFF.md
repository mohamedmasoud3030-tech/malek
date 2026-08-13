# Parallel Agent Handoff — Frontend Experience Stabilization & UI/UX Closeout

## Isolation contract

This lane runs in parallel with the WP-DB0 Database Stabilization & Contract
Freeze session.

- Repository: `mohamedmasoud3030-tech/malik`
- Base: `main@d1016c87cc58eb6652659e9ac7387e76e1fec7d3` (PR #1446 — phone/iPad/desktop chrome contract freeze)
- Branch: `arena/019ffa40-malik`
- Scope: authenticated-app frontend only (design tokens, shared primitives, page chrome, brand consistency, accessibility attributes, design-drift guardrails).
- Merge order: rebase/merge latest `main` before finalizing the PR; preserve any WP-DB0 database work on conflict. Never resolve a conflict by overwriting newer database-related work.

### Forbidden paths and symbols

Do not modify (owned by the parallel WP-DB0 session):

- `supabase/**` (migrations, tests, schema, seeds, RPCs, RLS)
- `rentrix-app/src/lib/database.ts` and database type generation tooling
- `rentrix-app/src/services/**` RPC signatures / query shapes
- DB replay / drift / bootstrap tooling
- `docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md`
- accounting schema, financial posting rules, financial precision rules
- authorization data model, backend data contracts

This PR modifies only `rentrix-app/src/**` presentation files and tests. No
database/data-contract file was touched.

## What this closeout found (audit scope)

Audited 47 authenticated route files (`rentrix-app/src/routes/_protected*`),
264 feature `.tsx` files, the shared layout components (`components/layout/**`),
the shared UI primitives (`components/ui/**`), the app shell
(`app/layout/app-shell.tsx`), navigation contract
(`app/navigation/app-nav-items.ts`), and the canonical token system
(`styles/tokens.css` + bridge). Cross-referenced against Canonical Pack
Document 6 (UX/IA/Design Contract), ADRs 0011–0014, and
`docs/ui-ux/MALEK_VISUAL_CONTRACT_V2.md`.

Overall state: the authenticated app is already strongly unified
(PR #1446 froze the chrome contract). The remaining inconsistencies were a
short tail of token drift, not structural divergence. Every hub (Financials,
Reports, Operations, Settings), every register (Properties, Contracts,
Owners, Tenants, People, Units, Service Providers), and every dossier
(Property, Unit, Owner, Person, Contract, Tenant) shares the same
PageLayout → PageHeader/EntityDetailHeader → section surface chain.

## Fixes implemented (presentation only — no behavior change)

### Brand / token consistency

1. `features/contracts/ContractsListPage.tsx` — the primary «إنشاء عقد» action
   used `bg-[hsl(var(--sidebar))]` (dark navy) instead of the canonical
   primary action color. Now uses the default `Button` variant, resolving to
   the module primary token (verified in-browser: same computed background as
   the properties primary action).
2. `components/ui/filter-tabs.tsx` — the `contracts`/`maintenance` active-pill
   tints used hard-coded orange/blue HSL values (a latent parallel brand
   ramp). Now resolve to the shared product-accent tokens
   (`--tone-amber`, `--tone-sky`), theme-aware light+dark, with no visual
   regression (verified computed colors).
3. `features/contracts/components/ContractAgreementMissingAlert.tsx` — raw
   Tailwind palette classes (`emerald-*`, `amber-*`) replaced with semantic
   tokens (`success`/`warning` ramps). ADR 0013 requires semantic tokens, not
   raw palette utilities, on operational surfaces.
4. `app/layout/notifications-menu.tsx` — notification count badge used
   `bg-rose-600`; now `bg-danger` (semantic danger token).

### Elevation / radius scale

5. `components/ui/dropdown.tsx` — menu surface `shadow-lg` → `shadow-elevated`.
6. `components/ui/drawer.tsx` — drawer surface `shadow-xl` → `shadow-elevated`.
7. `app/layout/app-shell.tsx` — mobile drawer `shadow-2xl` → `shadow-elevated`
   (one elevated-overlay elevation across the app).
8. `features/financials/components/overdue-invoices-table.tsx` and
   `arrears-aging-buckets.tsx` — `rounded-3xl` (24px, off the canonical
   radius scale) → `rounded-2xl` (14px canonical elevated surface).

### Accessibility

9. `app/layout/app-shell.tsx` — the phone/tablet hamburger now exposes
   `aria-haspopup="dialog"` + `aria-expanded` (screen readers can tell a menu
   dialog opens and whether it is open); the desktop collapse toggle now
   exposes `aria-expanded` reflecting the sidebar state.

### Design-drift guardrail (durable system)

10. New `src/app/frontend-design-drift.test.ts` — a repository-wide contract
    test that fails when non-landing authenticated code reintroduces:
    - raw Tailwind palette utilities (`bg-slate-…`, `text-emerald-800`, …)
    - hard-coded hex colors
    - off-scale radii (`rounded-3xl/4xl`/arbitrary)
    - one-off heavy shadows (`shadow-lg/xl/2xl`)
    Approved exclusions are documented in the file: `features/landing/**`
    (public marketing, outside the authenticated closeout),
    `services/documents/renderer/**` (A4 print engine keeps a fixed palette
    for printed document fidelity, per ADR 0014), the DEV-only design-system
    showcase, and test/fixture files. Runs in the standard vitest gate — no
    new CI wiring needed.

11. Extended `app/layout/app-shell-header.test.tsx` with the ARIA menu-control
    contract (hamburger `aria-haspopup`/`aria-expanded`, collapse toggle
    expansion state).

## Verification (all local, hermetic)

- `pnpm typecheck` — passed (no output = clean).
- `pnpm --filter ./rentrix-app test` — **407 files / 2539 tests passed**.
- `pnpm check:docs` — passed (138 maintained Markdown files).
- `pnpm --filter ./rentrix-app run check:architecture` — passed.
- `node scripts/check-no-new-enterprise-usage.mjs` — PASS.
- Production build (`vite build` with CI Supabase env) — succeeded
  (13.9s; only the pre-existing chunk-size warning).
- Browser readiness (hermetic, real Chromium via sandbox-side lab):
  - 13 authenticated surfaces × {mobile 375×812, tablet 768×1024,
    desktop 1440×900} = **39/39** checks: page ready, RTL, `h1` present,
    no horizontal overflow, no unexpected console errors.
  - **12/12** computed-style contract checks: primary-action brand parity,
    page-header chrome (14px radius / 1px border / card surface) across four
    hubs, tablet dense-register vs phone mobile-register, 320px RTL + Cairo +
    zero overflow, filter-tint token resolution.
  - **2/2** interaction checks: entity-form dialog fits a 375px viewport with
    a close affordance and zero overflow; dark theme applies persisted theme
    with dark surfaces and no overflow/errors.

Hosted QA acceptance (real Supabase credentials) was **not** run in this
sandbox — no credentials are available here and the sandbox blocks the
Playwright browser CDN (a sandbox-side Chromium was assembled from
npm-distributed binaries for the hermetic runs above). CI on the PR runs the
repository's own Browser Readiness matrix (chromium-desktop/tablet/mobile
shards) and the full test/typecheck/build gates.

## Deferred to WP-DB0 — Database ↔ Backend ↔ Frontend contract issues

None discovered in this session. All hermetic surfaces rendered without
schema/RPC/RLS defects; no missing column/relation/RPC/enum surfaced, and no
frontend workaround was added. If WP-DB0's contract changes later surface
frontend mismatches, those belong in a follow-up lane, not here.

## Explicit confirmation

- No `supabase/**` file modified.
- No database types, `database.ts`, RPC signatures, query shapes, or
  data-contract tooling modified.
- No business logic, permissions, lifecycle, or financial behavior changed.
- All diffs are presentation classes/attributes + tests only.
