---
name: frontend-rtl-design
description: Guide Arabic RTL-first, mobile-first, accessible user-facing work without separating UI from the underlying business workflow. Use whenever a task changes a route, component, form, navigation flow, table/card view, modal, print layout, camera/barcode flow, responsive behavior, or any user-visible state in any portfolio product (all are Arabic-first RTL).
---

# Frontend RTL Design (Arabic-first, mobile-first)

## Product contract (portfolio-wide)

- Arabic RTL is the primary interface — not a translated afterthought.
- Mobile is the primary operating surface; tablet and desktop stay efficient.
- Existing design tokens and shared components win over a new UI system.
- UI completion requires the connected business command, persistence result,
  audit result, and user feedback to succeed together.
- Target users may be non-technical and 50+: large targets, clear Arabic
  labels, minimal jargon (per the hospitality product owner profile).

## Implementation method

1. Start from the operator's complete task, not an isolated screen mockup.
2. Reuse shared layout/form/feedback/navigation primitives before local variants.
3. Primary actions obvious and one-hand reachable on common phones.
4. Provide loading, empty, validation, blocked/permission, failure, retry,
   and success states.
5. Preserve entered form data after recoverable failures; focus the first
   invalid field with a visible Arabic message.
6. Semantic HTML, visible labels, keyboard access, logical focus order,
   meaningful accessible names.
7. Verify RTL for icons, directional controls, numbers, currency, dates,
   tables, drawers, and print output.
8. Destructive actions separated, clearly named, confirmed, consistent with
   archive/rollback rules.
9. Camera/barcode features: denied-permission, unavailable-hardware, retry,
   and manual fallback paths.
10. Business validation is enforced in services/DB — not only hidden in UI.

## Responsive verification (minimum matrix)

narrow phone portrait · phone landscape if relevant · tablet · desktop · long
Arabic labels + large numeric values · virtual keyboard open · scrolling with
sticky headers/actions · print preview for contracts/invoices/receipts/reports.

## Evidence required (user-facing changes)

route + scenario tested · viewport/device class · screenshots or browser
evidence for key states · keyboard/focus verification · confirmation that real
service behavior (not mock-only) was exercised.

## Completion rule

A screen is complete only when the full operator workflow works on phone,
tablet, and desktop; errors are recoverable; RTL is correct; and the resulting
business state survives relaunch.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
