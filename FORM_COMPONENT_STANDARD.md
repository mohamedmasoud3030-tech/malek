# FORM_COMPONENT_STANDARD

## Shared building blocks

Use `EntityForm` + `FormField`/`TextField`/`Select`/`FileAttachmentField`/`ConfirmDialog`.

## Rules

1. Labels in Arabic; numbers/dates `dir=ltr` where appropriate.  
2. Validate with zod at form and again at service boundary for money/identity.  
3. Required fields marked; optional not blocking.  
4. Preserve field values after recoverable server errors.  
5. Disable submit while pending; generate `requestId` for idempotent financial RPCs.  
6. Destructive actions: ConfirmDialog with consequence copy.  
7. Mobile: primary submit full width; stepper for >6 fields.  
8. Never ask users to type UUIDs — select from registers.  
9. Money inputs use `MONEY_STEP` (0.001 OMR).  
10. Show ValidationSummary / field errors; do not toast-only critical validation.

## States

| State | Behavior |
|---|---|
| Loading options | Disable dependent fields; skeleton/select placeholder |
| Submitting | aria-busy, disable submit |
| Success | toast or navigate; reset only when appropriate |
| Error | inline + keep draft |
| Unsaved | guard navigation when implemented on long forms |
| Offline | shell banner; block optimistic money posts |

## Migration

When touching a form, move one-off inputs to FormField and ensure min-h-11 controls.
