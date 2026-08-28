---
paths:
  - "supabase/**"
  - "scripts/db0/**"
  - "scripts/guardian/**"
  - "scripts/supabase-tests/**"
  - "rentrix-app/src/**/*financial*"
  - "rentrix-app/src/**/*account*"
  - "rentrix-app/src/**/*invoice*"
  - "rentrix-app/src/**/*receipt*"
  - "rentrix-app/src/**/*settlement*"
---

# Database and finance rules

- Read `DATABASE_RULES.md` and the relevant canonical data/accounting/security documents before changing schema, RLS, RPCs, financial services, or posting behavior.
- Preserve locked/canonical accounting rules. Existing implementation may reveal a gap; it does not redefine the rule.
- Keep financial writes on the established server/RPC trust boundary. Do not move protected posting logic into browser-only code.
- Posted financial history is not rewritten casually. Follow the repository's controlled reversal/adjustment model and governance restrictions.
- Before adding a migration or RPC, inspect repository migration history and current implementation evidence. For live-backend claims, reconcile deployed reality only when authorized access exists.
- Keep company/tenant isolation and RLS behavior explicit. A successful local query is not proof that hosted RLS is correct.
- Do not grant governed stage credit merely because code, migration, or tests exist.
- Do not claim a database object or stage is absent without checking repository reality and the traceability documents.
- Use the repository's DB/Supabase gates appropriate to the change, and report hosted/live proof separately from repository validation.
- Never create a migration solely to hide a test failure or schema mismatch without understanding the canonical contract and migration ordering.
