# UX Adoption Wave — PR Notes

## User-visible adoption

### Finance
- New finance cockpit hero with current-month collection summary.
- Stronger desktop section rail and mobile workspace navigation.
- Active workspace framed as a deliberate financial work surface.
- Existing embedded workspaces remain the mutation/data owners.
- Fixed the unified FinancePage gap where the `commissions` view existed in the shell model but rendered no workspace.

### Reports / Accounting
- New accounting/reports cockpit with clear separation from daily financial operations.
- Report directory redesigned from large catalogue cards into a compact searchable launchpad.
- Open report area has an explicit analysis/review surface.
- Filter scope and decision KPIs have stronger visual hierarchy while reading the same authoritative workspace model.

### Settings
- New settings cockpit that makes WP-D modularization visible to the user.
- Mobile select replaced by touch-friendly horizontal section navigation.
- Desktop section rail carries section descriptions and active state.
- Save/discard state stays persistently available with safe-area handling on mobile.
- Section cards now visibly communicate independent modular ownership.
- E2E fixture composition updated to match production.

## Guardrails preserved

- No accounting calculations changed.
- No Supabase schema/RLS/RPC changes.
- No route, deep-link, permission, or persistence contract changes.
- `next-accounting` feature flag remains unchanged; accounting data-source cutover is explicitly outside this UX wave.

## Verification order

Implementation and source review were completed before running gates. Final verification should run once in this order:

1. Typecheck
2. Test typecheck
3. Architecture check
4. Focused Finance / Reports / Settings tests
5. Full frontend test suite
6. Production build

Repair only confirmed regressions introduced by this branch; preserve baseline/environment failures separately.
