# TICKET: Owner Settlements UI & Service Wiring (FGR-005)

- **Slug**: `owner-settlements-fgr-005`
- **Area**: `owners / financials`
- **Priority**: P0
- **Status**: Ready for implementation
- **Related FGR**: FGR-005 ("Owner settlement rules require implementation against decided policy")
- **Related ADRs**: `docs/decisions/0001-product-accounting-policies.md` § Office fees
- **Related Skills**: financial-reporting, supabase-data-contracts, frontend-integration, react-patterns, react-testing, design-system, frontend-a11y, error-handling
- **Wave**: 1

---

## Context

The DB layer for owner settlements is **already in place**:

- Baseline table from `20260705000002_baseline_capture_untracked_tables_batch_a.sql`.
- Foundation columns + constraints from
  `20260716000001_owner_settlement_lifecycle_foundation.sql`
  (period, gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
  approval/payment/cancellation state, idempotency via `request_id`).
- Four hardened atomic SECURITY DEFINER RPCs from
  `20260716000002_owner_settlement_atomic_lifecycle_rpcs.sql`:
  - `create_owner_settlement_draft_atomic(jsonb)`
  - `approve_owner_settlement_atomic(jsonb)`
  - `pay_owner_settlement_atomic(jsonb)`
  - `cancel_owner_settlement_atomic(jsonb)`
- Migration contract tests already exist and pass:
  - `features/financials/reports/owner-settlement-lifecycle-migration-contract.test.ts`
  - `features/financials/reports/owner-settlement-rpcs-migration-contract.test.ts`

What is **missing** is everything that connects these RPCs to the user:
TypeScript services, React Query hooks, a UI screen, navigation entry,
permissions gating, and reporting/statement integration so an office manager
can actually generate → approve → pay a settlement from the browser.

The business rules are already fixed in ADR 0001 — do NOT reopen them.

## Business Rules (verbatim from ADR 0001)

1. Office fees default to a **collected-cash basis**, not invoiced.
2. Fees support **percentage** and **fixed-fee** rules, extendable later.
3. Fees must **NOT apply to deposits, refunds, or utility pass-through** unless
   a contract rule explicitly enables it.
4. Fees are recognized at payment collection, become due to the office at
   collection time, and are deducted from the owner settlement **when the
   settlement is approved**.
5. Voids/refunds/reversals automatically reverse related office fees at the
   same rate/fixed allocation, with audit trail. (Out of scope for this ticket;
   tracked for the payment/void flows.)
6. Fees appear in owner statements, income reports, and settlement reports.
7. **VAT/tax is configurable**, disabled by default, shown separately from
   base office fee when enabled.
8. Settlements move through lifecycle: **DRAFT → APPROVED → PAID**; DRAFT/APPROVED
   can be CANCELLED with reason; PAID must be reversed via a dedicated reversal
   flow (out of scope for this ticket).
9. Owner payables accounting entry is written as a balanced journal batch on
   PAY (account `2000` Owner Payables, account `1111` Cash) — already done in
   the `pay_owner_settlement_atomic` RPC.

## Out of Scope (DO NOT build these here)

- Auto-generating settlement draft from raw collected payments (the calculation
  engine that computes `gross_collected`, `office_fee`, `owner_expenses`,
  `tax_amount` from payment/expense data). That will be a follow-up ticket
  (`owner-settlement-calculation-engine`). In this ticket, the UI accepts
  manually entered / pre-computed amounts (or calls a stub calculator) and
  posts them to the existing `create_owner_settlement_draft_atomic` RPC.
- Void/refund reversal of fees (rule #5 above).
- Master-lease owner obligation schedule (FGR-011, separate ticket).
- Export / PDF settlement voucher (follows later in Document Engine integration).
- Notifications to owner on approval/payment (Wave 3).
- Reversing a PAID settlement.
- Multi-currency.

## Existing code to extend / imitate

- Migrations: `supabase/migrations/20260716000001_*.sql`, `20260716000002_*.sql`
- Service pattern: `features/financials/payments/paymentService.ts`,
  `features/owners/ownerAgreementService.ts`
- Hook pattern: `features/owners/useOwners.ts`, `features/owners/useOwnerAgreements.ts`
- Page pattern: `features/financials/expenses/` (list + dialogs + permissions),
  `routes/_protected.expenses.tsx`, `routes/_protected.invoices.tsx`
- Permissions: `features/auth/permissions.ts` — keys already exist:
  - `financial.owner_settlements.approve`
  - `financial.owner_settlements.pay`
  We will also add `financial.owner_settlements.view` and
  `financial.owner_settlements.create`/`.cancel` to have fine-grained control.
- Navigation: `app/navigation/app-nav-items.ts` (add under **الماليات** group).
- Reports integration: owner statement RPC (`rpt_owner_statement`) already
  reads from `owner_settlements` (per
  `20260706025534_fix_rpt_owner_statement_settlement_type_mismatch.sql`). No
  new report RPC is required in this ticket — just confirm settlements appear.

## DB Changes

No new migrations are required in this ticket.

If UI feedback reveals a missing column (e.g. `payment_method` is referenced
in the `owner_settlements_payment_state_check` constraint but not explicitly
added in the foundation migration — verify live first), write a FIX migration
with filename `20260716HHMMSS_fix_owner_settlements_<issue>.sql` that adds only
what is missing. Do NOT re-define the table.

**Pre-implementation live check** (executed by DB agent):

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'owner_settlements'
order by ordinal_position;
```

Capture the output in the ticket's verification report and confirm the RPCs
exist via `pg_get_functiondef` before writing any service/hook that relies on
their signatures.

## Backend / Service Changes

New service file: `features/owners/services/ownerSettlementService.ts`

Functions (all async, zod-validated, Supabase-error-handled):

- `listOwnerSettlements(filters): Promise<OwnerSettlementListItem[]>`
  - Filters: `ownerId?`, `propertyId?`, `status?`, `periodFrom?`, `periodTo?`
  - Reads from `owner_settlements` joined with `owners` (name) and `properties` (name).
  - Uses `maybeSingle`/array shape consistent with other services.
- `getOwnerSettlement(id): Promise<OwnerSettlementDetail>`
  - Single row + owner + property.
- `createOwnerSettlementDraft(input): Promise<OwnerSettlementRef>`
  - Calls `create_owner_settlement_draft_atomic` with zod-validated payload
    containing a generated v4 `request_id`.
  - Returns `{ id, no, status, net_payable }`.
- `approveOwnerSettlement({ settlementId, requestId? })` → RPC.
- `payOwnerSettlement({ settlementId, method, paymentReference, requestId? })` → RPC.
- `cancelOwnerSettlement({ settlementId, reason, requestId? })` → RPC.

Types:

- Add `OwnerSettlement`, `OwnerSettlementListItem`, `OwnerSettlementDetail`,
  `OwnerSettlementStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'` to
  `features/owners/types.ts` (derive shapes from the RPC payloads and the
  `Database['public']['Tables']['owner_settlements']` row type).

Hooks: `features/owners/useOwnerSettlements.ts`

- `useOwnerSettlements(filters)` — list query.
- `useOwnerSettlement(id)` — single detail query.
- `useCreateOwnerSettlementDraft()` — mutation, invalidates
  `['owner-settlements']` and `['owner', ownerId, 'financials']`.
- `useApproveOwnerSettlement()` — mutation, invalidates same keys + shows toast.
- `usePayOwnerSettlement()` — mutation, same invalidation.
- `useCancelOwnerSettlement()` — mutation, same invalidation.
- All mutations use `useMutation` with `onSuccess` → `queryClient.invalidateQueries`,
  `onError` → toast.

Permissions updates (`features/auth/permissions.ts`):

- Add to `appPermissions` tuple:
  - `'financial.owner_settlements.view'`
  - `'financial.owner_settlements.create'`
  - `'financial.owner_settlements.cancel'`
- Grant `.view` to ADMIN and MANAGER; USER does not get it.
- Grant `.create`/`.approve`/`.cancel` to ADMIN and MANAGER.
- Restrict `.pay` to ADMIN only (money out). Update `rolePermissions`.
- Update permission gate tests in `permissions.test.ts`.

## Frontend Changes

- **Route**: `/owner-settlements`
  - File: `routes/_protected.owner-settlements.tsx`
  - `staticData.title`: 'تسويات الملاك'
  - `beforeLoad` guard: asserts session +
    `assertSessionPermission({ context, permission: 'financial.owner_settlements.view' })`
- **Navigation entry**: add under **الماليات** group in `app-nav-items.ts`
  (after `/arrears`, before `/bank-reconciliation`):
  ```ts
  ['/owner-settlements', 'ownerSettlements', 'تسويات الملاك واعتماد الصرف', HandCoins, 'financial.owner_settlements.view'],
  ```
  Add `HandCoins` import from lucide-react.
- **Mobile nav**: not added directly (mobile nav is only 5 top items); accessible
  from the financials group in the drawer.
- **Page layout** (copy the shape of `features/financials/expenses/` or
  `routes/_protected.invoices.tsx`):
  1. **Header** with page title ("تسويات الملاك") + primary action button "تسوية جديدة"
     (visible only if `financial.owner_settlements.create` granted).
  2. **Filter bar**: Owner select (dropdown of owners), Property select,
     Status (DRAFT/APPROVED/PAID/CANCELLED chips), period range.
  3. **DataTable** (using existing shared `DataTable`):
     Columns: رقم التسوية (no), المالك, العقار, الفترة (من–إلى),
     إجمالي التحصيل, رسوم المكتب, مصاريف المالك, ضريبة, الصافي,
     الحالة (Badge بلون لكل حالة), إجراءات (dropdown).
  4. **Row actions** (per permissions):
     - DRAFT → "اعتماد" (if .approve), "إلغاء" (if .cancel)
     - APPROVED → "صرف" (if .pay), "إلغاء" (if .cancel)
     - PAID → no actions (view-only); display payment method/reference
     - CANCELLED → disabled, reason shown on hover/dialog
  5. **Create/Generate dialog** (Dialog component, title "تسوية مالك جديدة"):
     Fields:
     - Owner (select, required, from `useOwners`)
     - Property (select, optional, scoped by owner, from `usePropertiesByOwner`)
     - Period start (date, required)
     - Period end (date, required, ≥ start)
     - Gross collected (numeric, EGP/OMR/… via company currency, ≥ 0)
     - Office fee mode: percentage of gross or fixed amount (toggle)
     - Office fee (numeric, computed/live)
     - Owner expenses (numeric, ≥ 0, default 0)
     - Tax/VAT (numeric, ≥ 0, default 0 — shown only when company settings enable tax)
     - Notes (textarea, optional)
     - Live-computed "صافي مستحق للمالك" = gross − fee − expenses − tax
     - Buttons: "حفظ كمسودة" / "إلغاء"
     - All fields use zod validation + react-hook-form; numeric inputs use
       money helpers from `lib/moneyNormalization.ts`.
     - Dates use local-calendar construction (lesson #7, regression test).
  6. **Pay dialog**: method (select: cash/bank_transfer/check), reference
     (text), confirm button "تأكيد الصرف".
  7. **Cancel dialog**: reason (textarea, required), confirm "تأكيد الإلغاء".
- **Detail view**: out of scope for this ticket; clicking a row opens a
  side-sheet or dialog with summary (not a full separate route) to keep the
  diff small. Follow up with a dedicated detail page later if needed.
- **Owner detail integration**: add a "التسويات" tab to the owner detail page
  (`features/owners/owner-detail-page.tsx`) listing settlements for that owner.
- **Empty/loading/error states** for every query.
- **Toasts** in Arabic for success/failure of each mutation.
- **All user-visible strings** in Arabic, RTL-correct, logical spacing
  (`ms-*`/`me-*` not directional `ml-*`/`mr-*` where cross-direction matters).
- **Responsive**: columns collapse at 768px to a card list using the
  existing responsive pattern from other financial pages.

## Contract Tests to write BEFORE or alongside implementation

1. **Service-level contract tests** (`ownerSettlementService.test.ts`):
   - create maps inputs correctly & generates `request_id` (stub crypto/randomUUID).
   - list sends correct Supabase query with filters.
   - approve/pay/cancel call the correct RPC name with the correct payload
     shape.
   - zod rejects negative numbers, reversed periods, missing required fields.
2. **Hook tests** (`useOwnerSettlements.test.tsx`) with mocked supabase and
   QueryClient:
   - Query returns data; loading/error states render via renderHook.
   - Mutations call invalidateQueries on success.
3. **Component tests** (`owner-settlements-page.test.tsx`):
   - ADMIN sees create, approve, cancel, pay actions.
   - MANAGER sees create/approve/cancel but NOT pay.
   - USER cannot open the page (guard redirects).
   - Validation errors appear when submitting empty/invalid form.
   - Success toast appears after approve/pay/cancel.
4. **Permission tests** (`permissions.test.ts` extension):
   - New permission keys granted correctly per role.
5. **Playwright E2E** (`e2e/owner-settlements.spec.ts`, skipped if E2E
   credentials missing, following existing pattern):
   - Login as admin → navigate → create draft → approve → pay → appears in list.
6. **A11y**: axe check has zero critical/serious violations on the new page.

## Acceptance Checklist

- [ ] Pre-implementation live schema check recorded (columns on owner_settlements,
      RPC definitions confirmed via pg_get_functiondef).
- [ ] `ownerSettlementService.ts` created and covered by unit tests.
- [ ] `useOwnerSettlements.ts` hooks created with proper invalidation.
- [ ] Permission keys added and role matrix updated; permission tests pass.
- [ ] Route `/owner-settlements` added with guard and Arabic title.
- [ ] Nav item added under **الماليات** with `HandCoins` icon, gated by permission.
- [ ] Page: header, filter bar, DataTable, create dialog, pay dialog,
      cancel dialog, empty/loading/error states all implemented with Arabic
      labels.
- [ ] "التسويات" tab added to owner detail page.
- [ ] All amounts go through `moneyNormalization`; all dates use local calendar.
- [ ] Unit/component tests for service/hooks/UI all pass.
- [ ] `pnpm typecheck` → PASS
- [ ] `pnpm --filter ./rentrix-app test` → PASS (all tests, including new ones)
- [ ] `pnpm --filter ./rentrix-app run test:financials` → PASS
- [ ] `pnpm build` → PASS
- [ ] `pnpm e2e` → PASS (or skipped if staging secrets unavailable, with note)
- [ ] Manual Arabic RTL check at 320/768/1280 documented in verification report.
- [ ] Docs:
  - `docs/CURRENT_STATE.md` updated to note the UI/service wiring is done,
    with an honest caveat that the auto-calculation engine is pending.
  - `docs/FEATURE_GAP_REGISTER.md` → FGR-005 moves to **In progress** (not
    Closed until auto-calculation + void reversal are done; this ticket is
    the first slice).

## Open Questions

None blocking implementation of this slice. Reserved for follow-up tickets:

1. What is the default office fee percentage for new offices? (Product
   decision — not needed here since fees are entered manually per settlement
   in this slice.)
2. Which payment methods should be visible in the Pay dialog beyond the
   existing `cash | bank_transfer | check`? (Extending to online/bank transfer
   variants is a separate Wave 4 payment-gateway decision.)
3. Should the "owner_expenses" field pull automatically from approved
   owner-responsibility expenses, or be manually entered as in this slice?
   (Automation → follow-up `owner-settlement-calculation-engine` ticket.)
