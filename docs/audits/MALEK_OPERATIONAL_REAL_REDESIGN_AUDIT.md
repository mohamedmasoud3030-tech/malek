# MALEK Operational Real Redesign — Execution Audit

Date: 2026-08-06
Branch: `fix/ui-malek-pro-visual-wave-2-real-redesign`
Base at creation: `f84dc96d6d5698af227f226e03ca2cfb00a06f7b`

## Goal

Deliver the visibly different operational redesign that Wave 1 did not achieve, including the create/edit form contract agreed with the product owner.

## Included

- Properties
- Units
- People
- Tenants
- Owners
- Contracts
- Maintenance
- Settings operational surfaces
- Shared entity form presentation used by those operational modules
- Mobile create/edit flows as bottom sheets by default
- Desktop create/edit flows as dialogs

## Explicit overlap exclusion

PR #1358 / branch `fix/ui-malek-pro-visual-wave-2-finance-reporting` owns Finance and Reporting treatment.

This branch must not modify:

- `rentrix-app/src/features/financials/**`
- `rentrix-app/src/features/reports/**`
- finance hub routes or report routes
- finance calculations, accounting, database, RLS, RPCs, grants, print/PDF
- `docs/decisions/0014-malek-visual-contract-v2-wave-2-finance-reporting.md`

## Implemented so far

- A materially stronger operational hierarchy in `malek-pro-visual-wave.css`: dark contextual page headers, stronger filter/control surfaces, elevated entity cards, high-fidelity desktop tables, clearer tabs, and responsive operational spacing.
- Entity form architecture now defaults to `bottom-sheet` on mobile and remains `dialog` on desktop.
- Full-page mobile forms remain available only as an explicit exception.
- Sticky form actions, safe-area handling, field focus, validation and business behavior remain unchanged.
- Unit test updated to lock the mobile bottom-sheet default.

## Safety

No finance/report feature file has been changed.
No business rule, query, mutation, route, schema, migration, permission, calculation, print, PDF or document behavior has been changed.

## Remaining execution

- Continue visible operational page treatment and create/edit forms.
- Add route-backed visual evidence at 375px and 1440px.
- Run typecheck, unit tests, architecture checks, build and browser smoke through CI.
