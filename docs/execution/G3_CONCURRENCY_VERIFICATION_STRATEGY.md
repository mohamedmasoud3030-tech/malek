# G3 — Concurrency / Web Locks: verification strategy and local findings (NOW-8)

**Branch:** `reconstruction/checkpoint-20260909` · **Date:** 2026-09-11 · **Status:** strategy + one proven defect fixed locally; hosted-browser verification remains BLOCKED by G1 (no credential).

G3 question: can concurrent sessions/tabs race auth/session restoration, duplicate initialization, corrupt shared state, bypass company isolation, or produce inconsistent financial state?

Discipline applied: survey → local reproduction where possible → fix ONLY what is reproduced → record per-scenario verdicts with evidence. No speculative hardening.

## 1. Scenario matrix and verdicts

| # | Scenario | Authority that decides it | Local verdict (evidence) | Hosted check (when G1 unblocks) |
|---|---|---|---|---|
| C1 | Two tabs refresh auth tokens simultaneously | supabase-js `^2.105.1` — `persistSession` + `autoRefreshToken`; the auth-js client coordinates refresh/multi-tab sync internally (Web Locks where available, storage-event fallback). App code adds no lock and needs none. | NOT A DEFECT at app level — no app-owned token mutation exists (`src/lib/supabase.ts` is the single client module; no manual `setSession` races found) | Two-tab soak: sign in, force token refresh in both tabs, assert no `SIGNED_OUT` flap |
| C2 | Session restore races first render | `use-auth.tsx`: `isLoading=true` until `getCurrentSession()` settles; `onAuthStateChange` is the only other writer of `session`; permission load failure resolves to the EMPTY authoritative set (fail-closed, documented in code) | NOT A DEFECT — single mounted provider, sequential state writes; overlapping `refreshPermissions` calls are last-write-wins against the same server authority, and any permission change re-fires the realtime channel/focus listeners | None needed beyond C1 soak |
| C3 | Unexpected sign-out in one tab clears another tab's stored session | `SIGNED_OUT` handler: `clearStoredSession()` only when `hadSessionRef && !explicitLogoutRef` — supabase-js propagates sign-out across tabs itself | NOT A DEFECT — app reacts to the library event; it never initiates cross-tab writes | Two-tab: sign out in tab A, assert tab B navigates to `/login` with the Arabic toast |
| C4 | Double-click / two-tab double submit of a governed financial mutation | Client: per-panel `isPending` disabled gates + `EntityForm.Actions`; Server: lifecycle gates + request-id unique indexes (`s09_corrections_request_uidx`, `idempotency_uidx`; deposit `DEPOSIT_APPLICATION_IDEMPOTENCY_CONFLICT`; settlement/cutover maker-checker + status transitions) | **DEFECT FOUND AND FIXED (this NOW):** `EntityForm.Actions` computed `disabled={submitDisabled ?? isSubmitting}` — ANY caller-supplied `submitDisabled` (35 call sites; ~20 pass validation-only terms, e.g. communication hub, lands, utilities, admin-support reason length) silently overrode the pending guard, so the submit button stayed clickable mid-mutation and `onSubmit` could fire twice. Fixed at the shared source to `submitDisabled || isSubmitting` (pending ALWAYS disables), reproduced first by `entity-form.test.ts` ("G3 double-submit race"): pre-fix the submitting+`submitDisabled:false` render emitted no `disabled` attribute; post-fix it does, and idle/blocked contracts are locked in the same test. Panels with handler-level guards (`OwnerSettlementWorkspace` payout `if(payoutMutation.isPending)return`) were already protected — the fix protects the rest. | Slow-network double-click on each G5/G6 panel submit; assert exactly one server row/one toast |
| C5 | Duplicate initialization (bootstrap) | G2 territory — bootstrap stall is BLOCKED (hosted runtime); local `replay-bootstrap.ts` is test-only and single-threaded | DEFERRED — design note: when G1/G2 unblock, verify bootstrap idempotency by double-mounting the app root in one hosted page (React StrictMode already double-invokes effects in dev; no dev-only crash is known) | Double-mount + reload storm against hosted backend |
| C6 | Shared-state corruption via caches | React Query caches are per-tab (no cross-tab cache sharing); `financial-cache.ts` is a stateless invalidation list (idempotent `invalidateQueries`); the only cross-tab shared store is the auth storage key, owned by supabase-js (C1/C3) | NOT A DEFECT — no app-owned cross-tab mutable state found (zero `navigator.locks`, `BroadcastChannel`, or manual `localStorage` writes outside `features/auth/session-storage`, which supabase-js mediates) | Two-tab: post a payment in A, assert B's financial read models refetch (realtime/visibility) without corrupting A's in-flight form |
| C7 | Company isolation bypass via cached identity | Company id lives in the JWT (`require_company_id()` server-side); every governed RPC re-derives it per call; RLS restrictive `p0_tenant_isolation` policies back it. NOW-7 locked cross-company invisibility through `s08_list_frozen_reviews` with a real second company/user. | NOT A DEFECT — client cannot present a company the token does not carry; no client-side company cache writable by a tab | Cross-account two-tab soak (user of company A + user of company B) |
| C8 | Concurrent S08/S09 lifecycle transitions (two accountants, same review/correction) | Server: `for update` row locks + lifecycle gates (`S08_REVIEW_LIFECYCLE_ILLEGAL`), fingerprint re-check at approval (`S08_FINGERPRINT_CHANGED_UNDER_REVIEW`), single-reversal rule — all regression-locked in `s09-correction.pglite.test.ts` (NOW-4/5/7, suite 27/27) | NOT A DEFECT — second writer gets a fail-closed Arabic error; no double-write path exists in the deployed bodies | Two-session race on approve/reverse; assert exactly one winner and one `LIFECYCLE_ILLEGAL` |

## 2. Web Locks — explicit verdict

The app uses **no** `navigator.locks` calls (grep-verified, zero hits). That is lawful here: the only cross-tab coordination needs are (a) auth token refresh/session sync — owned by supabase-js, which uses Web Locks internally when available; (b) financial write ordering — owned by the database (row locks, lifecycle gates, unique request ids). Introducing app-level Web Locks would duplicate server authority and add a new failure mode (lock starvation) without a reproduced race to justify it. **Do not add Web Locks without a hosted reproduction** (per §L: no code change without reproduction).

## 3. Residual risks (recorded, not fixed — no reproduction)

- R1: **CLOSED by the NOW-9 full audit (appendix §5) — no gap remains.** The provisional estimate
  ("~15 call sites pass no `isSubmitting`") was wrong: site-by-site inspection of all 47
  `EntityForm.Actions` usages and all 14 raw `type="submit"` buttons found every mutation-submitting
  surface pending-gated (via `isSubmitting`, a pending term inside `submitDisabled`, or a handler-level
  `isPending` early-return), with exactly two non-gated surfaces, both in evidence class (c)
  (double-submit unreachable / no mutation): the onboarding waiver dialog and the admin-support
  search form. Zero code changes were required in NOW-9.
- R2: Two TABS (not two clicks) submitting the same create-form generate DIFFERENT client request ids, so server request-id dedupe does not merge them; protection there is lifecycle/uniqueness gates (settlement status, review fingerprint, deposit claim conflicts). For free-create entities (e.g. a second identical expense) duplicate rows remain possible by design — that is an accounting-visibility question, not a corruption race.
- R3: Hosted verification of every "hosted check" column above is BLOCKED by G1 (no credential/preview backend). This document is the executable plan for the moment G1 unblocks.

## 4. Evidence index

- Fix + reproduction: `rentrix-app/src/components/ui/entity-form.tsx` (Actions disabled logic), `rentrix-app/src/components/ui/entity-form.test.ts` (G3 double-submit race test, red→green).
- Server-side race locks: `rentrix-app/src/features/financials/services/s09-correction.pglite.test.ts` (27/27; fingerprint-drift approval block, duplicate-approval refusal, single-reversal, cross-company list isolation).
- Surveyed, unchanged: `src/lib/supabase.ts`, `src/hooks/use-auth.tsx`, `src/lib/financial-cache.ts`, `src/features/auth/session-storage.ts`, all five G5/G6 panels' `isPending` gates.

## 5. NOW-9 audit appendix — double-submit guard class, per-surface verdicts (complete)

Method: exhaustive grep of `EntityForm.Actions` (47 usages / 34 product files), raw
`<Button type="submit">` (14), and `mobile-form-stepper` footer; each site classified as
(a) button pending-gated, (b) handler-guarded, or (c) no reachable mutation double-fire.

| Surface | Verdict | Gate |
|---|---|---|
| admin-support triage + proposal Actions | (a) | `isSubmitting` + pending term in `submitDisabled` |
| admin-support search submit (raw) | (c) | read-only query; no mutation to duplicate |
| change-password Actions | (a) | `isSubmitting` |
| commissions-view Actions | (a) | `isSubmitting={isSaving}` |
| communication-hub Actions | (a) | `isSubmitting={isSaving}` |
| ContractFormFields Actions (×2, + stepper consumer) | (a) | `isSubmitting={submitting}`; stepper footer uses `submitDisabled \|\| isSubmitting` |
| ContractEvidenceSection registration/decision/review Actions | (a) | `isSubmitting={mutations.*.isPending}` |
| ContractEvidenceSection inspection submit + draft (raw) | (a) | `disabled={saveInspection.isPending \|\| completeInspection.isPending}` / draft gated |
| Contract renewal / short-stay / termination dialogs | (a) | `isSubmitting` + pending term |
| contract-approval-workflow Actions | (a) | `isSubmitting={isPending}` |
| expenses-section Actions | (a) | `isSubmitting={isSavingExpense}` |
| quick-payment-form Actions | (a) | `isSubmitting={isPending}` |
| deposit-action-forms create/claim/refund/reject Actions (×4) | (a) | `isSubmitting={*Mut.isPending}` (reject ORs all three mutations) |
| receipts-page void Actions | (a) | `isSubmitting={isLoading}` |
| bank-csv-import Actions | (a) | `isSubmitting={isParsing \|\| isImporting}` |
| bank-reconciliation line/match Actions (×2) | (a) | `isSubmitting={ctrl.*.isPending}` |
| tax-profile create tax/fee Actions (×2) | (a) | `isSubmitting={*Mut.isPending}` |
| UserRolesWorkspace decision Actions | (a) | `isSubmitting` + pending term |
| lands-view Actions | (a) | `isSubmitting={isSaving}` |
| leads-view Actions | (a) | `isSubmitting={isSaving}` |
| maintenance resolve overlay + request form | (a) | `isSubmitting` |
| **OnboardingChecklist waiver Actions** | **(c)** | no pending gate, but `submitWaiver` sets `waiverFor=null` in the same discrete click → overlay unmounts before any second click (React flushes discrete events synchronously); failure surfaces via `waiveMutation.onError` toast; server RPC enforces ADMIN/reason/waivability (`onboarding-rpc-authority.test.ts`) |
| OwnerAgreementsManager agreement + amendment Actions (stepper consumer) | (a) | `isSubmitting={saving}` / `{versionMutation.isPending}` |
| OwnerFundsCutoverPanel create Actions | (a) | pending term inside `submitDisabled` |
| OwnerSettlementWorkspace payout + draft Actions | (a)+(b) | `isSubmitting` on both; payout handler also early-returns on `isPending` |
| owner-form-dialog / owner-relationships / person-form-modal | (a) | `isSubmitting` |
| property-form-modal create + update Actions | (a) | `isSubmitting` |
| service-provider-form-dialog Actions; categories dialog raw submit | (a) | `isSubmitting={saveMutation.isPending}` / `disabled={isSaving}` |
| S09CorrectionPanel create + reverse raw submits; row action buttons | (a) | `disabled={createMutation.isPending}` / `reverseMutation.isPending` (+reason) / validate/apply/reverse row buttons gated |
| OwnerReceivableOffsetPanel / RecoveryPanel raw submits | (a) | `disabled={applyMutation.isPending}` / `{recoverMutation.isPending}` |
| unit-form-modal / utilities meter+bill Actions | (a) | `isSubmitting` |
| login-page / password-recovery raw submits (×3) | (a) | `disabled={isSubmitting …}` + `aria-busy` |
| ai-assistant send (raw) | (a) | `disabled={pending …}` |
| settings-save-bar submit (raw) | (a) | `disabled={isSaving}` |

Result: **0 ungated mutation surfaces remain** → NOW-9 required **zero code changes**; the NOW-8
component fix (`submitDisabled || isSubmitting`) plus existing call-site wiring complete the class.
