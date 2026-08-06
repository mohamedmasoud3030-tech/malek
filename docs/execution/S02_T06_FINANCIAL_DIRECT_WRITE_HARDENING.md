# S02-T06 — Payments and expenses RPC-only write hardening

## Scope

This change closes browser-direct `INSERT`, `UPDATE`, and `DELETE` access to
`public.payments` and `public.expenses` while preserving company-scoped reads.
Financial mutations remain available only through the approved
`SECURITY DEFINER` RPC overloads:

- `record_invoice_payment_atomic(jsonb)`
- `void_receipt_atomic(jsonb)`
- `create_expense_with_journal_atomic(jsonb)`
- `update_expense_with_journal_atomic(jsonb)`

## Security contract

- `PUBLIC` and `anon` have no EXECUTE permission on the four RPCs.
- `authenticated` and `service_role` retain EXECUTE permission.
- `authenticated` has SELECT-only table access.
- SELECT policies require both `is_app_user()` and
  `company_id = current_company_id()`.
- No write-capable RLS policy remains on either table.

## Verification

`supabase/tests/s02_financial_direct_write_hardening.sql` is fail-closed. It
checks exact overload identity, SECURITY DEFINER status, ACLs, policy commands,
company predicates, and the continued presence of auth/role/company guards in
the four RPC definitions. It also executes negative calls under the real
`authenticated` database role and requires SQLSTATE `42501`.

The test deliberately avoids fixture-heavy warning-only checks that can pass on
schema errors. It must be run after migrations with `ON_ERROR_STOP=1`.
