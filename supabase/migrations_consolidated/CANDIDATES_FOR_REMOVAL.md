# Candidates for Removal

These are review candidates only. Nothing listed here was removed from the SQL package.

1. `public.soft_delete_contract_atomic(uuid)`
   - Status: candidate only.
   - Reason: the `text` overload is the actively used path and carries the stricter financial-deletion workflow.
   - Action in this package: preserved.

Explicitly preserved and not candidates in this package:

- `public.post_receipt_atomic(jsonb)`
- `public.void_receipt_atomic(jsonb)`
- `public.void_receipt_atomic(text, bigint, jsonb, jsonb)`
