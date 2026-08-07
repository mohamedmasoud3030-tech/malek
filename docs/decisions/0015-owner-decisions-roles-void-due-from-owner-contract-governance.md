# ADR 0015 — Resolve UX-blocking owner decisions

Status: **ACCEPTED**  
Date: 2026-08-07

## Context

Several otherwise-complete UX flows remained classified as partial because owner decisions OD-02, OD-03, OD-04 and OD-08 were unresolved. This ADR records the product-owner decisions so implementation can proceed without inventing policy during coding.

## Decisions

### OD-04 — Role model and Maker-Checker

MALEK adopts six product roles:

- `ADMIN`
- `MANAGER`
- `ACCOUNTANT`
- `OPERATIONS`
- `USER`
- `VIEWER`

Sensitive financial approvals use Maker-Checker separation. The actor who creates or requests a sensitive action must not approve the same action. `ADMIN` remains the final authority. `ACCOUNTANT` may approve accounting/financial actions only where an explicit permission grants it. Existing three-role deployments must fail closed until their data/permissions are migrated; UI labels do not grant backend authority.

### OD-08 — Negative owner balance

A negative owner position must not be represented by making Owner Funds Payable negative. The system records a separate **Due from Owner** receivable. Recovery may happen by direct collection or by documented offset against future owner funds where offset is legally and contractually permitted. The settlement UI must show the receivable separately from payable funds.

### OD-02 — VOID governance

Financial records are immutable after posting. VOID is a controlled lifecycle action, never a delete. A VOID request requires:

- mandatory reason,
- requester identity and timestamp,
- approver identity and timestamp,
- reference to the original business record,
- reference to the reversal event/batch when accounting reversal is required,
- complete audit history.

The requester cannot approve their own VOID. A true emergency override is restricted to `ADMIN`, requires an additional override reason, and must remain auditable. No implementation may silently mutate or delete the original financial record.

### OD-03 — Contract legal workflow and signed-version integrity

The product workflow is fixed as:

`DRAFT → REVIEW → APPROVED → SIGNED → ACTIVE`

A signed document version is immutable and must be retained as the exact version signed. Later edits create a new version/amendment; they do not replace the signed artifact.

The workflow and signature UX may be implemented now, but final jurisdiction-specific legal wording/templates remain replaceable content and must be legally reviewed before production use. The application must not claim legal approval merely because the workflow is implemented.

### First-cycle Owner Settlement supervision

The first complete settlement/accounting cycle for each company requires `ADMIN` supervision and reconciliation before cycle close. After one successfully reconciled cycle is recorded, the first-run warning is no longer a permanent blocker. Subsequent supervision follows normal role/permission policy.

## Consequences

- Bank reconciliation approval UX can proceed against explicit role/permission rules.
- Owner Settlements can proceed with a separate Due-from-Owner path instead of negative payable balances.
- Maker-Checker and contract signature/version UX are no longer blocked by product-owner ambiguity.
- This ADR does **not** authorize historical backfill, new GL postings, jurisdiction-specific legal wording, or unreviewed accounting policy changes.
- Backend/RLS/RPC enforcement remains authoritative; UI visibility alone is never authorization.
