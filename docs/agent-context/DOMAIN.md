# Agent Context Domain Notes

This file mirrors high-risk domain context from `docs/DOMAIN.md` and `docs/CURRENT_STATE.md` for agents working from the context layer. Verify current code, migrations, and live Supabase state before relying on any summarized status here.

## Receipts, payments, and voiding

- `PaymentReceipt` represents a payment against an invoice. Recording a payment is implemented through the `record_invoice_payment_atomic` RPC, and receipt voiding is exposed through `void_receipt_atomic`.
- The stale `voidReceipt` issue should not be described as an active/current production incident in this PR. PR #1064 merged a code fix for the payment-backed receipt void path.
- The precise current status is: a code fix was merged in PR #1064, but live Supabase verification and real end-to-end production-path verification have not yet been performed.
- Do not claim the fix is live or verified in production until the target Supabase project has been checked directly and the app path has been exercised end-to-end.
- Any future receipt/payment work must verify the live `void_receipt_atomic` / `record_invoice_payment_atomic` RPC definitions and the live migration ledger before relying on the fix.
