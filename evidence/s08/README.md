# S08 — Read-only Historical Analysis Evidence

Generated: 2026-08-07T03:24:00.011Z
Source main SHA: 6bc8eb4ff6449383f8a367d422337611b451a3d4
Analysis version: s08-1.0.0

This evidence package is FIXTURE-BASED READ-ONLY (production path contains no Demo literals). No financial data was mutated during analysis.

## Contents
- summary.json
- findings.json
- findings.csv
- settlement-source-duplicates.csv
- liability-balances-by-period.csv
- liability-balances-by-period.json
- expense-misclassification.csv
- deposit-exceptions.csv
- orphan-postings.csv
- retroactive-version-differences.csv
- master-lease-readiness.csv
- subledger-gl-reconciliation.csv
- subledger-gl-reconciliation.json
- README.md
- SHA256SUMS
- manifest.json

## Methodology
- Company-by-company execution
- Accounting period scoped
- Deterministic output (stable sort, 2-decimal EGP precision)
- Statuses distinguished: POSTED, PAID, VOID, CANCELLED, REVERSED, DRAFT
- Cancelled/reversed balances ignored except where historical effect analyzed

## Security
- All queries company scoped
- Views are SECURITY INVOKER
- No service_role in browser code
- search_path pinned in privileged functions

## Approval
See approval-template.md — approvals are not fabricated. Independent reviewer must sign.

NO_FINANCIAL_DATA_MUTATION
