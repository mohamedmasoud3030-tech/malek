# INTERFACE_MIGRATION_PLAN

## Priority order

1. Critical money error≠empty (done: bank recon).  
2. Register mobile hierarchy (amount/contracts priorities) — **this milestone**.  
3. Remove dead imports / unused mobile card modules when tests allow.  
4. Sweep remaining lists for error≠empty.  
5. Form field standardization on touch.  
6. No big-bang visual rewrite.

## Milestone M1 — Architecture docs + owner/bank register hierarchy

**Status:** IMPLEMENTED this session  
**Outcome:** Docs published; owners table priorities; bank mobile amount; dead EntityCard import removed.  
**Verify:** vitest contracts + typecheck; ux-completion still wants EntityTable on bank/owners paths.

## Milestone M2 — Residual ContractMobileCard deprecation

**Status:** VERIFIED COMPLETE (repository)  
**Work:** Deleted `ContractMobileCard.tsx`; contracts/maintenance/expenses registers now declare explicit EntityTable column priorities; detail-preview contract asserts file absence.  
**Risk:** low — no production imports remained.

## Milestone M3 — Error≠empty sweep + register hierarchy lock

**Status:** VERIFIED COMPLETE (repository)  
**Work:** dashboard queue sections distinguish error vs empty; properties/units/tenants/invoices/receipts/deposits/providers column priorities locked; cross-register hierarchy contract test added.

## Milestone M4 — Consumer import rename DataTable→EntityTable (optional)

**Status:** NOT STARTED  
**Note:** alias is fine; rename is pure churn — only when touching files.

## Non-goals

Replacing Tailwind/Radix; new dashboard product; phone 5-tab bar; merging Reports into Money.

## Status labels

Use only: VERIFIED COMPLETE | IMPLEMENTED BUT NOT VERIFIED | BLOCKED BY OWNER OR EXTERNAL ACTION | NOT STARTED
