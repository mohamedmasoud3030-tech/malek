# Targeted runtime frontend/backend contract suite

The `test:frontend-backend-runtime-contract` package script intentionally runs a bounded set of existing high-value tests on every PR. It complements static schema/RPC discovery with executable contract evidence while keeping the normal PR gate practical.

Covered areas:

- invoice/payment safety contract
- payment service RPC response handling
- collections/payments/period-close behavior in PGlite
- OMR precision and reconciliation invariants
- owner settlement service contract
- core operational journey
- product workflow scenarios

The full application and financial suites remain in heavy validation on `main`; this targeted set is the earlier PR-level compatibility barrier.
