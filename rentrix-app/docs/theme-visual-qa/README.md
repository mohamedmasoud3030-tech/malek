# Theme Visual QA Evidence — Light/Dark Refinement (PR #1780)

Real rendered-app screenshots (headless Chromium, Arabic RTL, Cairo webfonts) used to
validate the Light/Dark token refinement at merge gate.

- **Head SHA:** `22faf147990c88ae951c3d6caf9a9341dbd5bd60`
- **Date:** 2026-09-03
- **Matrix:** 7 routes × {light, dark} × {desktop 1440×1000, mobile 390×844} + focus probes
- **Routes:** dashboard, properties, owners, tenants, contracts, financials, reports
- **Verdict:** typography ladder 500/600/700/800/900 **kept**; hierarchy, surfaces,
  borders, focus, muted text, status colors, light-glare and dark-depth all validated
  from these renders. No token correction required.

Screens captured with an ephemeral harness (not committed) seeded by
`e2e/support/fake-supabase-backend.ts` + `buildAcceptanceSession()`.
Registers without a full seed (owners/tenants dark, financials dark content) show the
design-system error/skeleton states, which were themselves validated.
