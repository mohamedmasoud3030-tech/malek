# PHASE 2 — Trace of the first broken mutation (end to end)

**Branch:** `arena/01a0967c-malek` · **Base:** `main` @ `5a53be6b` · **Date:** 2026-09-12
**Method:** static trace over frontend sources + the live migration chain (`supabase/migrations`), cross-checked against the live-walkthrough evidence recorded in commit `5a53be6b`. No production credentials were used; no SQL was executed against hosted Postgres.

---

## 1. Target identification (Phase 1 reconstruction)

No Phase 1 artifact exists in this repository. The first failing operation was therefore re-identified from the strongest in-repo evidence, all of which points to the same operation:

| Evidence | Location | Statement |
|---|---|---|
| HEAD commit message | `5a53be6b` | "…instead of dead-ending **every financial write** with `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD`." / "Proven end-to-end against production Supabase: UI create 2026-10 → RPC 200 → …; **retry payment INV-2026-000003 450 @2026-10-01** → `record_invoice_payment_atomic` 200 → payments POSTED, invoice PAID, journal batch POSTED into the UI-created period (`open_period_contains_date`)" |
| In-code defect record | `rentrix-app/src/features/financials/tax-authority/accounting-periods-management.tsx:11-16` | "Before this surface existed, the financial write path failed closed with `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD` whenever the company needed a new period, and **the app told the user to 'open a period' while providing no way to do it**." |
| Readiness surface | `rentrix-app/src/features/financials/tax-authority/finance-readiness-section.tsx:197-214` | "لا توجد فترة محاسبية مفتوحة. **افتح فترة** قبل تسجيل القيود الجديدة." (instruction with no in-app affordance before the fix) |

**The first failing operation = recording an invoice payment** — the retry of payment **INV-2026-000003, 450 OMR, payment date 2026-10-01** — submitted from the invoice detail "Quick Payment" form, which dead-ended with `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD` and offered no way to fix the precondition. It is the first mutation in the operator journey that failed to execute (earlier mutations in the same walkthrough — e.g. contract approval — executed successfully; one of them, approval, was later found to be *misreported* as a failure, which is a different, second defect class; see §6).

**The decisive A/B proof** (why the failure point is the period guard and not anything upstream): the *identical payload* (same `request_id`, invoice, amount, method, date) **failed** before an open 2026-10 period existed and **succeeded** after one was created from the new Settings surface — with the journal batch recorded under `period_resolution_reason = 'open_period_contains_date'`. The only variable that changed was the existence of an OPEN accounting period covering 2026-10-01.

---

## 2. End-to-end trace (layer by layer)

Legend: `baseline` = `supabase/migrations/20260901000000_canonical_baseline.sql` (all quoted line numbers are into that file unless stated otherwise).

### 2.1 UI

- Route `/financials` → invoices hub → invoice detail panel `InvoiceDetailSection`
  (`rentrix-app/src/features/financials/components/invoice-detail-section.tsx:211-224`) hosts `QuickPaymentForm`.
- `QuickPaymentForm` (`.../components/quick-payment-form.tsx:56-146`): canonical `EntityForm.Root` with amount / method (`cash` | `bank_transfer` only — card/check intentionally hidden) / payment date / reference, and `EntityForm.Actions` whose pending guard is `submitDisabled || isSubmitting` (double-submit race closed by `6a66f692`).
- Submit button → `onPostPayment` on the workspace controller.

### 2.2 Form / component state

`useInvoiceWorkspaceController` (`.../invoices/useInvoiceWorkspaceController.ts:55-97`):

- `amount`, `paymentMethod` (default `cash`), `paymentDate` (default **today**, local date string), `paymentReference` — plain React state.
- `remaining` = `getInvoiceRemainingAmount(invoiceDetail)` from the live `useInvoice(selectedInvoiceId)` query (gross − paid − credited).
- `canCreatePayment = canAccess(authorization, financialOperationPermissions.createPayment) && hasAuthoritativeInvoiceDetail`.
- `isPaymentDisabled = !canCreatePayment || quickPaySubmitRef.current || postPayment.isPending || remaining <= 0 || Boolean(amountValidationMessage)`.

For the failing attempt the state was: invoice INV-2026-000003 selected, `amount = 450`, `method = cash|bank_transfer`, `paymentDate = 2026-10-01`, remaining ≥ 450, permission present → the button was enabled. **Nothing here is wrong.**

### 2.3 Validation

- `getInvoicePaymentValidationMessage` (`.../invoices/invoice-payment-validation.ts:9-27`): requires selected valid invoice, non-empty finite amount > 0, `amount ≤ remaining`, valid `paymentDate`. All pass for 450 @ 2026-10-01.
- `onPostPayment` re-checks the same invariants atomically (`useInvoiceWorkspaceController.ts:205-213`).
- **Critically, client validation has no — and structurally cannot have — a check that an accounting period is open for `paymentDate`.** That is server-owned state. The form happily submits a date that the GL will reject.

### 2.4 Service / hook

- `onPostPayment` builds a **flat** payload and routes it through the idempotent retry store:
  `paymentCommands.run('invoice-payment', payload, (request_id) => postPayment.mutateAsync({ ...payload, request_id }))` (`useInvoiceWorkspaceController.ts:214-219`).
- `RetryableCommandStore` (`rentrix-app/src/lib/retryable-command.ts`): stable `request_id` per identical (operation, sorted payload) — a retry after a failed attempt reuses the same id, which is what makes the later "retry payment INV-2026-000003" safe (server idempotency guarantees one financial event).
- `usePostPayment` (`.../payments/usePayments.ts:16-26`): `useMutation` → `recordInvoicePaymentAtomic`; `onSuccess` → `invalidateFinancialReadModels` + success toast; `onError` → `toast.error(message)`.
- `recordInvoicePaymentAtomic` (`.../payments/paymentService.ts:35-39`): `supabase.rpc('record_invoice_payment_atomic', { payload })`; on `error` → `handleSupabaseError(error, 'تعذر تسجيل الدفعة')` (throws); on success → `parsePaymentResult` enforces the success envelope (`status:'recorded'`, matching `invoice_id`/`request_id`, present `payment_id`/`receipt_id`).

**Payload sent** (matches the engine's expected fields exactly — no schema mismatch):
`{ invoice_id, amount: 450, method, date: '2026-10-01', reference, request_id }`.

### 2.5 API / RPC

- RPC: `record_invoice_payment_atomic(payload jsonb)` — `baseline:15447`. `SECURITY DEFINER`, `search_path` pinned.
- Call chain inside the database (all in one transaction):
  1. public RPC → `record_invoice_payment_atomic_engine(payload)` (`baseline:15470`; engine at `baseline:15514`)
  2. engine → `post_receipt_atomic(internal_payload)` (`baseline:15929`; function at `baseline:13892`) with receipt `{date_time: '2026-10-01', …}` + server-built `journal_entries`
  3. `post_receipt_atomic` → `INSERT receipts` (`:14138`) → `INSERT payments` shadow row (`:14177`) → `INSERT receipt_allocations` → `PERFORM gl_ensure_initial_open_period(company, '2026-10-01')` (`:14292`) → `PERFORM post_journal_event(… effective_date '2026-10-01' …)` (`:14294`)
  4. `post_journal_event` (`:13801`) → `gl_create_journal_batch` (`:8022`, DRAFT batch + balanced lines) → `gl_post_journal_batch` (`:10132`)
  5. `gl_post_journal_batch` → `select … from gl_resolve_accounting_period(v_batch.company_id, v_batch.effective_date)` (`:10215`)

### 2.6 Authentication / authorization — all PASSED

- PostgREST: `GRANT ALL ON FUNCTION … TO authenticated` (`baseline:34053-34055`) — the browser is allowed to call the RPC.
- Inside the RPC/engine (both levels, `baseline:15459-15466` / `:15576-15581`):
  - `auth.uid()` non-null (else 42501 "Authentication is required…")
  - `is_admin_or_manager()` — `users.role ∈ {ADMIN, MANAGER}`, active, not deleted (`baseline:12276`)
  - `require_company_id()` → `current_company_id()` = `auth.jwt() -> 'app_metadata' ->> 'company_id'` (`baseline:16835`, `:4559-4564`)
- The live walkthrough reached the period error, which sits **after** all three checks — proof that JWT, role, and company claim were all valid.

### 2.7 RLS policies — not the blocker

- `payments`: only a SELECT policy for app users (`baseline:32717`); all writes happen inside SECURITY DEFINER functions (owner `postgres`), so RLS on `payments`/`receipts`/`journal_*` is bypassed by design in this path.
- `accounting_periods`: `ENABLE RLS` (`:31778`), SELECT via `is_app_user()` (`:31819`), **browser writes denied** (`no_browser_write_accounting_periods … USING (false) WITH CHECK (false)`, `:32404`) + restrictive tenant isolation `p0_tenant_isolation` (`:32503`). Period writes are only possible through `create_accounting_period` / `update_accounting_period_status` (`:3017`, `:21387`), granted to `authenticated` (`:33159`, `:34550`) with internal ADMIN/MANAGER + company + overlap + immutability guards.
- The guard that fired is a **business rule inside a function, not a security policy** — no permission was denied; the company simply had no eligible period.

### 2.8 Database mutation — THE FAILURE POINT

`gl_resolve_accounting_period(company_id, '2026-10-01')` (`baseline:10315-10365`) resolves, in order:

1. an **OPEN** period with `start_date ≤ date ≤ end_date` → `open_period_contains_date`
2. else the earliest **OPEN** period with `end_date ≥ date` → `redirected_earliest_open_period`
3. else:

```sql
raise exception 'NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD: no open accounting period can accept effective date % for company %. Create or reopen an OPEN period first.', p_effective_date, p_company_id
  using errcode = 'P0001';   -- baseline:10361
```

For the demo company in October 2026: periods existed (through 2026-09) but **none was OPEN covering 2026-10-01, and none was OPEN with `end_date ≥ 2026-10-01`** → step 3 fired.

The automatic bootstrap that *might* have rescued this does not apply: `gl_ensure_initial_open_period` (`baseline:8228-8277`) **only creates a period when the company has zero periods** ("Never invent or reshape periods once accounting-period governance has begun") — a no-op for an established company crossing into a new month.

Because the exception escaped uncaught through the SECURITY DEFINER chain, the **entire RPC transaction rolled back**: receipts, payments shadow row, receipt_allocations, the DRAFT journal batch, journal lines — and the idempotency row, whose insert runs only after a successful post (`baseline:14338`). No partial state, no duplicate on retry: correct fail-closed behavior.

### 2.9 Returned result

- PostgREST: HTTP 400, `code: "P0001"`, `message: "NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD: no open accounting period can accept effective date 2026-10-01 for company <uuid>. Create or reopen an OPEN period first."`, `details: "CONTEXT: PL/pgSQL function gl_post_journal_batch(uuid) line … at RAISE"`.
- `handleSupabaseError` → `getActionableSupabaseErrorMessage` (`rentrix-app/src/lib/supabase-error.ts:44-46`) matches `no_eligible_open_accounting_period` and returns the operator-facing Arabic: "تعذر تسجيل الدفعة: **لا توجد فترة محاسبية مفتوحة تقبل هذا التاريخ. أنشئ فترة لاحقة أو أعد فتح فترة قابلة لإعادة الفتح** ثم حاول مجددًا." — an *instruction* to create/reopen a period.
- `usePostPayment.onError` → `toast.error(…)`. The mutation object rejects; `RetryableCommandStore` clears the pending promise but **keeps the same `request_id`**, so an in-form retry is safe and expected.

### 2.10 Cache / query invalidation / state refresh — consistent

- Failure path: **no invalidation runs** (invalidation is `onSuccess`-only, `usePayments.ts:19-21`). This is correct: the server rolled back, so nothing changed; `invoices`/`receipts`/dashboard projections stay accurate and stale-by-design.
- Success path: `invalidateFinancialReadModels` (`rentrix-app/src/lib/financial-cache.ts:10-20`) invalidates the enumerated read-model roots (`invoices, receipts, financialReports, accountingReports, contract-payments, …`) — the retry-after-fix then rendered the PAID invoice, the posted payment row, and the receipt without a manual reload (per the live proof in `5a53be6b`).
- No optimistic updates exist on this path (react-query mutation, UI waits for the server), so there is no optimistic-reconcile bug to examine.

### 2.11 Rendered UI

- Error toast (Arabic, actionable text) over the invoice workspace; `QuickPaymentForm` returns to enabled state with the amount still entered; retrying the identical payment **fails identically, forever** — because nothing in the application could create or reopen a period.
- Settings → Finance Readiness showed the readiness card "لا توجد فترة محاسبية مفتوحة. افتح فترة قبل تسجيل القيود الجديدة." — the same instruction, again with **no affordance behind it** (`finance-readiness-section.tsx:197-214` pre-fix). The operator was trapped between two identical instructions and zero means.

---

## 3. Exactly where the operation fails

| # | Layer | Verdict |
|---|---|---|
| 1 | UI | ✅ enabled, canonical form, pending-gated |
| 2 | Form/component state | ✅ valid (450 ≤ remaining, date 2026-10-01, method allowed) |
| 3 | Validation | ✅ passes; cannot and must not know period state |
| 4 | Service/hook | ✅ flat payload, stable `request_id`, correct RPC |
| 5 | API/RPC | ✅ correct function, correct parameter (`payload`) |
| 6 | AuthN/AuthZ | ✅ JWT + ADMIN/MANAGER + company claim all passed (the error sits after them) |
| 7 | RLS | ✅ not implicated (definer path; policies intact) |
| 8 | **Database mutation** | ❌ **FAILS HERE** — `gl_post_journal_batch` → `gl_resolve_accounting_period(company, 2026-10-01)` raises SQLSTATE `P0001` `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD` (`baseline:10215 → 10361`); whole transaction rolls back |
| 9 | Returned result | HTTP 400 / `P0001` envelope; no idempotency row persisted (correct) |
| 10 | Cache/invalidation | ✅ consistent (no invalidation needed on rollback; invalidation set is correct on success) |
| 11 | Rendered UI | error toast with an instruction the app cannot execute; retry loop is fatal |

---

## 4. Root-cause classification

**Direct mechanism (where it fails): a fail-closed database constraint** — the accounting-period resolution guard (`P0001 NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD`) is a *deliberate, correct* business rule: the GL refuses to post into a period that is not open. It is not a defect and must not be loosened.

**The actual product root cause (why the operation was "broken"): a missing UI surface for a server-enforced precondition** — a capability gap with two compounding parts:

1. **No reachable surface.** `create_accounting_period` / `update_accounting_period_status` existed in the migration chain, were granted to `authenticated`, had an ADMIN/MANAGER/company/overlap/immutability-gated implementation, and even had a client service boundary (`accountingPeriodsService.ts`) — but **no route, form, or command called them** (the audit class `SERVICE_WITHOUT_SURFACE` / `BACKEND_ONLY_CAPABILITY`). The precondition the guard enforces was unsatisfiable from inside the product.
2. **Bootstrap cannot cover period progression.** `gl_ensure_initial_open_period` auto-creates a period only when the company has *zero* periods; an established company rolling into a new month (2026-09 → 2026-10-01) is never auto-provisioned. The onboarding shortcut was mistaken for a general policy.

**Secondary defect class: error handling that prescribes an impossible action.** The client already mapped `no_eligible_open_accounting_period` to "create a later period or reopen a reopenable period" (`supabase-error.ts:44-46`) and the readiness card said "افتح فترة…" — but the app provided no button for either action. An error message that instructs an action with no affordance converts a recoverable state error into a dead end.

**Explicitly excluded (verified, not just assumed):** RLS issue · permission mismatch · wrong RPC · incorrect payload · schema mismatch · frontend state bug · validation issue · transaction issue (atomicity worked *as intended*) · stale cache / incorrect invalidation (none ran; none needed) · optimistic-update bug (no optimistic path exists).

---

## 5. Fix that closed this operation (for Phase 3 context)

Commit `5a53be6b` (TASK 1) closed the gap at the authoritative layer without touching the guard:

- `AccountingPeriodsManagement` (`features/financials/tax-authority/accounting-periods-management.tsx`) — mounted in Settings → Finance Readiness (`finance-readiness-section.tsx:214`), permission-gated by `company.settings.manage`; lists periods with server statuses; create dialog (client pre-validation: empty/inverted/overlapping ranges, in Arabic; **server remains the authority** for overlap/immutability); reopen dialog for `SOFT_CLOSED` with mandatory audited reason; editors in `EntityForm.Overlay` portals (a nested inline `<form>` inside the shared settings form is invalid HTML and would natively GET-submit).
- `useAccountingPeriods` hook (`features/accounting/useAccountingPeriods.ts`) — react-query over the *existing* service boundary; invalidates `accountingPeriods` on success. No new RPC, no new business rule.

Live proof recorded in the commit: UI-created 2026-10 period → `create_accounting_period` 200 → row + audit_log CREATE persisted; then the **identical** payment retry → 200 → `payments` POSTED, invoice PAID, journal batch POSTED with `period_resolution_reason = 'open_period_contains_date'` and balanced entries.

**Residual note (out of scope for this trace):** readiness/card wording elsewhere still phrased as instructions only; any *other* financial write family (expenses, bank import, settlements, S09 corrections) was gated by the same period guard and is now unblocked by the same surface. `s09_reverse_correction` remains deployed+granted with **no UI** (HANDOFF §G5) — a separate, still-open surface gap, not part of this mutation.

---

## 6. The second defect found in the same walkthrough (for disambiguation)

Contract **approval** (`approve_contract_atomic`) is a *different* failure class and was **not** the first broken mutation: the mutation succeeded server-side, but the client parser did not recognize the approval envelope (`{success, id, status:'APPROVED', checker_user_id, is_sole_admin_exception}`) and surfaced a **false failure toast** after a successful approval (fixed in the same commit, TASK 2). Classification: **error handling bug / incorrect response mapping** — no database mutation failed; the response-shape contract between the RPC and its client parser drifted. Tracing it end to end is a separate Phase-2 item if Phase 1's list included it.
