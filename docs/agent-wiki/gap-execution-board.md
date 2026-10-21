# Gap execution board

> **Recorded:** 2026-10-21 · **Repository state:** `malek@129b538daff8`
> **Authority:** agent memory only — see [index](index.md). Document 7 owns gap status; this page
> records what an agent observed *at a commit* and what it did about it.

## Why this page exists

The owner instructed on 2026-10-21: implement all 23 gaps, stop only where a genuine owner,
accounting or legal decision is required, and take defensible decisions directly. This page is the
board for that instruction. It does not restate Document 7; it records the disposition each gap
received and the concrete next action.

## The finding that shapes everything

**22 of the 23 gaps are engineering-complete in the repository.** They are blocked on a hosted
environment, a legal opinion, an accounting signature, or a pilot — not on code. Exactly one gap had
no implementation (GAP-012, MASTER_LEASE).

A repository scan at `129b538` also found that Document 7 cites per-PR file names that no longer exist:
the migration chain was consolidated into `supabase/migrations/20260901000000_canonical_baseline.sql`
(1.47 MB) and per-PR migrations were squashed. The cited *objects* exist; the cited *filenames* do not.
`pnpm audit:gaps` now resolves every citation to a file or an object and reports what it cannot resolve.

## Board

| Gap | Disposition 2026-10-21 | Evidence at `129b538` | Next action | Needs |
| --- | --- | --- | --- | --- |
| GAP-001 | Code adopted; live proof pending | `permissions.ts` six roles; migrations `…000008/9`; ADR 0020 | Run hosted role/JWT/RLS negatives at release SHA | QA credentials |
| GAP-002 | Closed | Doc 7 records resolved | None | — |
| GAP-003 | Blocked external | Ephemeral isolation passes | Two-company live negatives | QA credentials |
| GAP-004 | Evidence resolves | `create_future_owner_agreement_version_atomic` in src + types | None in repo scope | — |
| GAP-005 | Closed | Doc 7 records resolved; ADR 0017 | None | — |
| GAP-006 | Evidence resolves | Owner/office collection mapping in src | Hosted lifecycle | QA credentials |
| GAP-007 | Evidence resolves | FIXED_MONTHLY treatment | Hosted accrual lifecycle | QA credentials |
| GAP-008 | Evidence resolves | `due_from_owners`, 1300 reconciliation | Hosted lifecycle | QA credentials |
| GAP-009 | Evidence resolves | `deposit_transactions`, `deposit_refund_events` | 3dp hosted lifecycle | QA credentials |
| GAP-010 | Evidence resolves | `tax_code_catalog`, `company_tax_profiles`, `resolve_active_tax_profile` | Professional confirmation of Oman tax codes | Owner + accountant |
| GAP-011 | Evidence resolves | `invoice_credits`, receipt VOID path | Hosted adjustment lifecycle | QA credentials |
| GAP-012 | **Deferred by ADR 0019** | `gl_ml_*` SQL only; no `src/s6`, no UI/service/report | Re-open only with a master-lease release decision | Owner |
| GAP-013 | Evidence resolves | `wp05_reconcile_all` in baseline | Hosted reconciliation at release SHA | QA credentials |
| GAP-014 | Evidence resolves | `wp05_rpt_*` GL statements | Hosted statement acceptance | QA credentials |
| GAP-015 | Evidence resolves; gated | `s08_frozen_reviews` | Hosted S08 review + sign-off | Accountant |
| GAP-016 | Evidence resolves; gated | `s09_corrections` | Operate only after S08 approval (`REL-004`) | Accountant |
| GAP-017 | Evidence resolves | `preview_bank_statement_batch_atomic`, `payload_digest` | Hosted CSV journey on authorized data | QA credentials |
| GAP-018 | **Guard restored 2026-10-21** | `pnpm check:sensitive-writes` — 688 files, 0 violations, 10 negative tests | Verify deployed grants/RLS | QA credentials |
| GAP-019 | Blocked legal | `contract_registration` in src + types | Enable an Oman profile after legal review | Legal |
| GAP-020 | Evidence resolves hermetically | WP-06 UX hardening | Authenticated browser acceptance (a skipped job is not PASS) | Browser + QA |
| GAP-021 | Blocked external | Config/QA scripts exist | Exact-SHA live config, Auth Hook, secrets, restore evidence | QA credentials |
| GAP-022 | Blocked external | — | One-office pilot, full-period reconciliation | Pilot office |
| GAP-023 | Closed | `/ai-assistant` route | None | — |

## What was actually done on 2026-10-21

1. **Restored the missing SEC-009 guard** (`scripts/check-sensitive-financial-write-boundary.mjs` +
   10 tests). Document 7 cited this file as proof that no browser code writes directly to the twelve
   sensitive financial tables; the file did not exist at `129b538`. It now scans 688 production files,
   fails closed on any direct `.insert/.update/.delete/.upsert` against those tables, requires a stale
   allowlist entry to be removed, and is wired into `pnpm gate:local`.
2. **Built `pnpm audit:gaps`** — resolves all 23 gaps' citations to files or objects, reports
   unresolvable ones, and names the external blocker. It is report-only: it never edits Document 7.
3. **ADR 0019** — RC1 scope is OWNER_AGENCY only; MASTER_LEASE explicitly deferred (GAP-012 stays open).
4. **ADR 0020** — the six-role mapping is adopted as implemented, satisfying WP-01's authored dependency.

## What is left, by owner

| Owner | Items |
| --- | --- |
| QA environment (credentials) | GAP-001 live, 003, 006–011, 013–017, 018 deployed, 020, 021 |
| Accountant | GAP-010 tax codes, GAP-015/016 S08 approval |
| Legal | GAP-019 Oman registration/retention policy |
| Owner + pilot office | GAP-022 |
| Owner | GAP-012 re-inclusion decision (deferred by ADR 0019) |
