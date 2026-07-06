# Context Map

Use this map to find the authoritative context files before changing Rentrix.

## Primary docs

- `README.md` — repository setup and common commands.
- `AGENTS.md` — working-process guidance for agents and contributors.
- `docs/CURRENT_STATE.md` — current verified state, known gaps, and live-verification caveats.
- `docs/DOMAIN.md` — domain entities and relationships.
- `docs/ARCHITECTURE.md` — routing, data flow, Supabase, and frontend architecture.
- `docs/TESTING.md` — relevant local and CI checks.

## Agent context layer

- `docs/agent-context/DOMAIN.md` — condensed domain notes for context-layer consumers.

## Recently fixed in code — live verification pending

- `voidReceipt` / payment-backed receipt voiding is not an active/current production incident in this PR.
- PR #1064 merged the code fix for the voidReceipt path.
- Live Supabase verification and real end-to-end production-path verification have not yet been performed, so do not claim the fix is live or verified in production.
- Receipt/payment work must verify the live `void_receipt_atomic` / `record_invoice_payment_atomic` RPC definitions and the live migration ledger before relying on the fix.
