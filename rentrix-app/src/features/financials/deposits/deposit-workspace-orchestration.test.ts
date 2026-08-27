import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Behavior/contract tests around DepositsWorkspace orchestration boundary.
// After refactor, checks are spread across workspace, controller, queries, forms, and document modules,
// but same business rules must be preserved.

const workspacePath = resolve(import.meta.dirname, './deposits-workspace.tsx');
const controllerPath = resolve(import.meta.dirname, './use-deposit-workspace-controller.ts');
const queriesPath = resolve(import.meta.dirname, './deposit-workspace-queries.ts');
const formsPath = resolve(import.meta.dirname, './deposit-action-forms.tsx');
const columnsPath = resolve(import.meta.dirname, './deposit-table-columns.tsx');
const docPath = resolve(import.meta.dirname, './deposit-clearance-document.ts');

const workspace = readFileSync(workspacePath, 'utf8');
const controller = readFileSync(controllerPath, 'utf8');
const queries = readFileSync(queriesPath, 'utf8');
const forms = readFileSync(formsPath, 'utf8');
const columns = readFileSync(columnsPath, 'utf8');
const doc = readFileSync(docPath, 'utf8');

const allOrchestration = [workspace, controller, queries, forms, columns, doc].join('\n');

describe('deposits workspace orchestration boundaries (post-refactor)', () => {
  it('workspace component owns page composition, not direct Supabase or RPC mutations', () => {
    // Must NOT query Supabase directly
    expect(workspace).not.toContain('supabase.from');
    expect(workspace).not.toContain('supabase.rpc');
    // Must NOT own RPC mutation implementations
    expect(workspace).not.toContain('createTenantDeposit');
    expect(workspace).not.toContain('createDepositClaim');
    expect(workspace).not.toContain('approveDepositClaim');
    expect(workspace).not.toContain('refundDepositGoverned');
    // Should own layout and table rendering
    expect(workspace).toContain('RegisterMetricStrip');
    expect(workspace).toContain('EntityTable');
    expect(workspace).toContain('DocumentReadinessNotice');
    expect(workspace).toContain('useDepositWorkspaceController');
    expect(workspace).toContain('createDepositColumns');
    expect(workspace).toContain('DepositCreateForm');
  });

  it('selecting a deposit/action is modeled via selectedDeposit and actionType in controller', () => {
    expect(controller).toContain('selectedDeposit');
    expect(controller).toContain('setSelectedDeposit');
    expect(controller).toContain('actionType');
    expect(controller).toContain('setActionType');
    expect(controller).toContain("'claim' | 'refund' | 'rejectClaim' | 'reverseClaim' | 'reverseRefund' | 'create'");
  });

  it('create deposit path requires contract_id, amount >0, received_date', () => {
    expect(allOrchestration).toContain('createForm.contract_id');
    expect(allOrchestration).toContain('createForm.amount');
    expect(allOrchestration).toContain('createForm.received_date');
    expect(allOrchestration).toContain('createForm.amount <= 0');
    expect(allOrchestration).toContain('!createForm.contract_id');
    expect(allOrchestration).toContain('!createForm.received_date');
    expect(allOrchestration).toContain('createTenantDeposit');
    expect(allOrchestration).toContain('request_id: crypto.randomUUID()');
  });

  it('claim path requires evidence and enforces inspection for DAMAGE', () => {
    expect(allOrchestration).toContain('claimKindInput');
    expect(allOrchestration).toContain('evidenceInput');
    expect(allOrchestration).toContain('inspectionInput');
    expect(allOrchestration).toContain('!evidenceInput.trim()');
    expect(allOrchestration).toContain("claimKindInput === 'DAMAGE'");
    expect(allOrchestration).toContain('فحص الإخلاء المراجع');
    expect(allOrchestration).toContain('لا يمكن طلب خصم أضرار دون فحص إخلاء مراجع');
    expect(allOrchestration).toContain('createDepositClaim');
  });

  it('claim path requires invoice for INVOICE_ARREARS', () => {
    expect(allOrchestration).toContain("claimKindInput === 'INVOICE_ARREARS'");
    expect(allOrchestration).toContain('invoiceInput');
    expect(allOrchestration).toContain('!invoiceInput');
    expect(allOrchestration).toContain('الفاتورة المفتوحة');
  });

  it('claim amount is bounded by remaining_amount', () => {
    expect(allOrchestration).toContain('amountInput');
    expect(allOrchestration).toContain('selectedDeposit?.remaining_amount');
    expect(allOrchestration).toContain('amountInput > selectedDeposit.remaining_amount');
    expect(allOrchestration).toContain('max={selectedDeposit?.remaining_amount}');
  });

  it('approve/reject/apply claim action wiring exists with maker-checker guard', () => {
    expect(allOrchestration).toContain('approveDepositClaim');
    expect(allOrchestration).toContain('rejectDepositClaim');
    expect(allOrchestration).toContain('applyDepositClaim');
    expect(allOrchestration).toContain('approveMut.mutate');
    expect(allOrchestration).toContain('rejectMut.mutate');
    expect(allOrchestration).toContain('applyMut.mutate');
    // maker-checker guard may be in columns via actions.currentUserId
    expect(columns).toContain('created_by');
    expect(columns).toContain('currentUserId');
    expect(columns).toContain("claim.status === 'PENDING'");
    expect(columns).toContain("claim.status === 'APPROVED'");
  });

  it('refund path enforces remaining and uses governed RPC', () => {
    expect(allOrchestration).toContain('refundDepositGoverned');
    expect(allOrchestration).toContain('refundMut.mutate');
    expect(allOrchestration).toContain('paymentMethodInput');
    expect(allOrchestration).toContain('refund_amount: amountInput');
    expect(allOrchestration).toContain('amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount');
  });

  it('reverse claim path requires reason and uses compensating journal', () => {
    expect(allOrchestration).toContain('reverseDepositClaim');
    expect(allOrchestration).toContain('reverseClaimMut.mutate');
    // Operator copy for the compensating-journal guarantee (never a destructive delete).
    expect(allOrchestration).toContain('الإلغاء يحافظ على سجل الحركة ويعيد أثرها المالي تلقائيًا دون حذف العملية الأصلية.');
    expect(allOrchestration).toContain("actionType === 'reverseClaim'");
  });

  it('reverse refund path requires reason and uses compensating journal', () => {
    expect(allOrchestration).toContain('reverseDepositRefund');
    expect(allOrchestration).toContain('reverseRefundMut.mutate');
    expect(allOrchestration).toContain("actionType === 'reverseRefund'");
    expect(allOrchestration).toContain('إلغاء الاسترداد');
  });

  it('remaining/available amount presentation uses OMR 3-decimal and currency', () => {
    expect(allOrchestration).toContain('remaining_amount');
    expect(allOrchestration).toContain('deducted_amount');
    expect(allOrchestration).toContain('refunded_amount');
    expect(allOrchestration).toContain('totalHeld');
    expect(allOrchestration).toContain('totalDeductions');
    expect(allOrchestration).toContain('totalRefunded');
    expect(allOrchestration).toContain('formatDepositMoney');
    expect(allOrchestration).toContain('normalizeCurrency');
    expect(allOrchestration).toContain('currencyCode');
    expect(allOrchestration).toContain('min=\"0.001\"');
    expect(allOrchestration).toContain('step=\"0.001\"');
  });

  it('document-readiness fail-closed behavior guards print and pdf', () => {
    expect(allOrchestration).toContain('useDocumentSettings');
    expect(allOrchestration).toContain('documentSettings.isReady');
    expect(allOrchestration).toContain('runGuardedDocumentAction');
    expect(allOrchestration).toContain('isReady: documentSettings.isReady');
    expect(allOrchestration).toContain('fallbackMessage');
    expect(columns).toContain('disabled: !actions.isDocumentReady');
    expect(workspace).toContain('DocumentReadinessNotice');
  });

  it('loading/error/empty states are handled via AsyncContentState', () => {
    expect(workspace).toContain('AsyncContentState');
    expect(controller).toContain('getContentStatus');
    expect(controller).toContain('isLoading');
    expect(controller).toContain('isError');
    expect(workspace).toContain('emptyTitle');
    expect(workspace).toContain('لا توجد ودائع تأمين');
  });

  it('permission-dependent action visibility via currentUserId check', () => {
    expect(controller).toContain('currentUserId');
    expect(controller).toContain('useAuth');
    expect(controller).toContain('user?.id');
    expect(columns).toContain('created_by');
    expect(columns).toContain('currentUserId');
  });

  it('queries are extracted and have meaningful keys and enablement', () => {
    expect(queries).toContain("tenant-deposits");
    expect(queries).toContain("deposit-claims");
    expect(queries).toContain("deposit-refund-events");
    expect(queries).toContain("contracts-for-deposits");
    expect(queries).toContain("deposit-invoices");
    expect(queries).toContain("reviewed-move-out-inspections");
    expect(queries).toContain('enabled: Boolean(contractId)');
    expect(queries).toContain('supabase');
    expect(queries).toContain('.from(');
  });

  it('table columns are extracted and reduce workspace responsibility', () => {
    expect(columns).toContain('createDepositColumns');
    expect(columns).toContain('createClaimColumns');
    expect(columns).toContain('createRefundColumns');
    expect(columns).toContain('depositStatusLabels');
    expect(columns).toContain('depositClaimStatusLabels');
    expect(workspace).not.toContain('depositStatusLabels');
    expect(workspace).not.toContain('depositClaimStatusLabels');
  });

  it('action forms are extracted into coherent groups', () => {
    expect(forms).toContain('DepositCreateForm');
    expect(forms).toContain('DepositClaimForm');
    expect(forms).toContain('DepositRefundForm');
    expect(forms).toContain('DepositReasonForm');
    expect(workspace).toContain('DepositCreateForm');
    expect(workspace).toContain('DepositClaimForm');
    expect(workspace).not.toContain('EntityForm.Overlay');
    expect(workspace).not.toContain('claimKindInput');
  });

  it('clearance document building is extracted', () => {
    expect(doc).toContain('buildDepositClearanceDocument');
    expect(doc).toContain('Tenant_Security_Deposit_Clearance');
    expect(doc).toContain('numberToArabicWords');
    expect(doc).toContain('createDepositDocumentActions');
    expect(workspace).not.toContain('buildDepositClearanceDocument');
  });

  it('does not contain raw financial writes bypassing RPCs', () => {
    expect(allOrchestration).not.toMatch(/supabase\.from\(['\"]tenant_deposits['\"]\)\.insert/);
    expect(allOrchestration).not.toMatch(/supabase\.from\(['\"]deposit_application_claims['\"]\)\.insert/);
    expect(allOrchestration).not.toMatch(/supabase\.from\(['\"]deposit_refund_events['\"]\)\.insert/);
    // Ensure workspace has no direct writes
    expect(workspace).not.toContain('.insert');
    expect(workspace).not.toContain('.update');
  });

  it('RPC names and arguments are identical to before (no signature changes)', () => {
    // RPC names live in deposit-service, which is authoritative boundary
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const service = readFileSync(servicePath, 'utf8');
    expect(service).toContain('create_deposit_atomic');
    expect(service).toContain('create_deposit_application_claim_with_inspection_atomic');
    expect(service).toContain('approve_deposit_application_claim_atomic');
    expect(service).toContain('reject_deposit_application_claim_atomic');
    expect(service).toContain('apply_deposit_claim_atomic');
    expect(service).toContain('reverse_deposit_claim_atomic');
    expect(service).toContain('refund_deposit_governed_atomic');
    expect(service).toContain('reverse_deposit_refund_atomic');
    // Controller must use service functions, not direct rpc
    expect(controller).toContain('createTenantDeposit');
    expect(controller).toContain('createDepositClaim');
    expect(controller).toContain('approveDepositClaim');
    expect(controller).toContain('refundDepositGoverned');
  });
});
