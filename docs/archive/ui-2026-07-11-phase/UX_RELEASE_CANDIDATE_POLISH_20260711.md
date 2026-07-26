# Release Candidate Polish — 2026-07-11

## Scope

Final UX polish only on the existing Rentrix branch. No Supabase migrations, RPCs, RLS policies, or financial calculation/business rules were changed.

## Delivered

- Unified legacy operational surfaces with the existing design system:
  - Properties, Units, Tenants, Expenses, Maintenance, Owners, and Reports now use the shared `FilterBar`, `DataTable`, `MobileCard`, `ActionMenu`, and shared loading/empty/error semantics where the surface supports that pattern.
  - Report collection, rent-roll, and overdue mobile rows now use `MobileCard` rather than bespoke mobile markup.
  - Expense list loading/error/retry states now terminate at the shared `DataTable` boundary.
- Mobile polish:
  - Prevented action/header/nav compression from creating horizontal overflow.
  - Tightened page-header secondary action wrapping and bottom-navigation truncation at narrow widths.
  - Added exact 320/375/430px browser smoke coverage for the unauthenticated surface and horizontal overflow.
  - Preserved safe-area-aware app and bottom-nav spacing.
- Actions:
  - Added `src/services/action-service.ts` as the browser boundary for print, native share/copy fallback, WhatsApp hand-off, and text/CSV downloads.
  - Contract and receipt print/share/WhatsApp flows now use the boundary.
  - Expense and report list actions remain local browser actions; no provider SDK is embedded in page components.
- PDF/document boundary:
  - Added `src/services/documents/DocumentService.ts` with explicit template capabilities and a provider-neutral render seam.
  - Current local templates remain local; unsupported accounting document types are reported as template/provider gaps rather than silently pretending to be ready.
- Communication and automation:
  - Added explicit outbound-provider capability metadata for WhatsApp/email/SMS.
  - Added a provider-neutral automation gateway; the current screen remains local-preview only and does not claim external execution.
- Permission UX:
  - Existing route and report permission boundaries remain intact.
  - Action surfaces continue to be omitted when no permitted callback exists; exports are still gated by `financial.reports.export`.

## Verification

| Check | Result |
| --- | --- |
| Root TypeScript build (`tsc -b` + app typecheck) | Pass |
| App test typecheck | Pass |
| Vitest | Pass — 98 files / 445 tests |
| Production build | Pass — Vite/PWA output generated |
| Playwright smoke | Pass — 15 tests; 3 seeded-auth tests skipped without credentials |
| Exact mobile widths | Pass — 320px, 375px, 430px overflow guard |
| Supabase/RPC/RLS/financial logic changes | None in this pass |

## Remaining issues / release caveats

- Authenticated staging browser evidence for all seven legacy pages and role-specific mutation flows still requires seeded credentials.
- External WhatsApp Business, SMTP, SMS, and automation-worker integrations are intentionally not connected; current behavior is local preview/provider-boundary behavior.
- Accounting statement PDF templates (`trial_balance`, `income_statement`, `balance_sheet`) remain explicit template/provider gaps in the local document service.
- Live backend permission/RLS/grant verification is outside this UI-only pass and was not re-run.

## Production Readiness Score

**90 / 100 — Ship candidate with evidence follow-up.**

The code and automated gates are green, but the score remains below sign-off because authenticated role/device evidence and external-provider configuration are not available in this workspace.
