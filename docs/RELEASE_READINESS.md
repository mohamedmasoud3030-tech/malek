# Release Readiness

> Assessment date: 2026-07-12  
> Repository baseline reviewed: `534c87516453d2da729e2da7264cfe07f55b1197`

## Recommendation

**NO-GO for final production release sign-off.**

The repository now contains the major financial correctness, authorization, migration reconciliation, and QA cleanup work discovered during the readiness cycle. The remaining blockers are primarily exact-release-candidate evidence: CI, backend parity, authenticated roles, browser workflows, responsive RTL, and document/export verification.

This is not a claim that the application is broken. It means the release has not yet been proven against one immutable candidate with the full evidence package required by governance.

## Code and migration readiness

Completed or represented on `main`:

- Guarded atomic contract lifecycle.
- Tenant financial identity aligned to `public.people`.
- Financial RPC authorization hardening.
- Safer foreign-key delete behavior.
- Atomic expense journal updates.
- Invoice double-entry generation and contract-balance triggers.
- VOID/CANCELLED report filtering.
- Payment-backed receipt/reporting rule.
- Posted journal immutability and reversal-based QA neutralization.
- Migration ledger reconciliation stubs for out-of-band repair timestamps.
- Frontend duplication and formatting hardening.
- Mandatory engineering governance policy.

## Mandatory release gates

| Gate | Required evidence | Current status |
| --- | --- | --- |
| Source control | Immutable release-candidate SHA and clean diff | Pending |
| Dependencies | Frozen install succeeds | Pending for exact RC |
| Static checks | Typecheck and lint succeed | Pending for exact RC |
| Build | Production build succeeds | Pending for exact RC |
| Tests | Main and financial suites succeed | Pending for exact RC |
| Migration parity | Repo, ledger, and intended pending set reconcile | Pending fresh read-only proof |
| Backend contracts | RPC, RLS, trigger, FK, index, and grants verified | Pending fresh read-only proof |
| Role boundaries | ADMIN/MANAGER allowed; USER denied where required | Pending authenticated proof |
| Financial lifecycle | Contract → invoice → payment → receipt → void → reports reconciles | Pending complete trace |
| QA cleanup | QA identifiers absent or balanced/neutralized | Pending final read-only proof |
| Browser UX | Critical routes and error states verified | Pending |
| RTL/responsive | Arabic RTL across mobile/tablet/desktop | Pending |
| Documents/exports | Print, PDF, CSV verified | Pending |
| Formatting | Company currency, decimals, timezone, and dates verified | Pending |

## Critical financial acceptance scenario

Use isolated, traceable test identifiers and record expected values before execution.

1. Create and activate a contract for a tenant stored in `public.people`.
2. Generate an invoice.
3. Confirm balanced invoice journal entries:
   - debit tenant receivables,
   - credit rental revenue,
   - credit VAT payable when tax applies.
4. Record a payment and confirm invoice/contract/tenant balance updates.
5. Confirm the receipt is sourced from the payment path.
6. Void the receipt through the application path.
7. Confirm reversal behavior and exclusion from collection/cash-flow totals.
8. Reconcile cash flow, VAT, financial summary, owner/tenant statements, and audit entries.
9. Repeat denied mutation attempts with a USER-role account.

## Evidence package

Attach the following to the release record:

- CI run URL and command results.
- Exact release-candidate SHA.
- Migration evidence output.
- Read-only database query results for the affected contracts.
- Test data identifiers and expected/actual totals.
- Authenticated browser traces or screenshots.
- RTL responsive screenshots at representative breakpoints.
- Generated PDF/print/CSV samples.
- Known limitations and explicit approvals.

## Conditions for GO

Change the recommendation to **GO** only when:

- every mandatory gate above is satisfied for the same SHA,
- no unexplained migration drift remains,
- financial totals reconcile after void/reversal operations,
- unauthorized roles are denied at the backend boundary,
- QA artifacts are absent or proven neutral,
- and the release evidence is archived.

## Non-blocking post-release scope

The following are product enhancements unless new evidence shows a correctness failure:

- advanced bank-file parsing and reconciliation rules,
- multi-currency,
- full security-deposit and deferred-revenue workflows,
- lower-risk form consistency,
- cosmetic polish.
