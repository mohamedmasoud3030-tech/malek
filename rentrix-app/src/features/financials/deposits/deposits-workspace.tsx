import { CheckCircle2, FileCheck, MinusCircle, Wallet } from 'lucide-react';
import { useImperativeHandle, type Ref } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntityTable } from '@/components/ui/entity-table';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { AsyncContentState } from '@/components/async-content-state';
import { formatLatinNumber } from '@/lib/formatters';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { depositClaimKindLabels, type DepositClaimRecord, type DepositRecord, type DepositRefundEventRecord } from './deposit-service';
import { createDepositDocumentActions } from './deposit-clearance-document';
import { printDepositVoucher, downloadDepositVoucherPdf } from './deposit-voucher-document';
import { createClaimColumns, createDepositColumns, createRefundColumns } from './deposit-table-columns';
import {
  DepositClaimForm,
  DepositCreateForm,
  DepositReasonForm,
  DepositRefundForm,
} from './deposit-action-forms';
import { useDepositWorkspaceController } from './use-deposit-workspace-controller';

export type DepositsWorkspaceHandle = Readonly<{
  /** Opens the create-deposit form; wired to the workspace-level primary action. */
  openCreateForm: () => void;
}>;

type DepositsWorkspaceProps = Readonly<{
  ref?: Ref<DepositsWorkspaceHandle>;
}>;

export function DepositsWorkspace({ ref }: DepositsWorkspaceProps = {}) {
  const controller = useDepositWorkspaceController();
  const {
    depositsQuery,
    claimsQuery,
    refundEventsQuery,
    documentSettings,
    deposits,
    claims,
    refundEvents,
    formatDepositMoney,
    currentUserId,
    totalHeld,
    totalDeductions,
    totalRefunded,
    contentStatus,
    openDepositAction,
    openRejectClaim,
    openReverseClaim,
    openReverseRefund,
    setActionType,
    approveMut,
    applyMut,
  } = controller;

  useImperativeHandle(ref, () => ({
    openCreateForm: () => setActionType('create'),
  }), [setActionType]);

  const { handlePrint, handleDownloadPdf } = createDepositDocumentActions({
    isReady: documentSettings.isReady,
    companySettings: documentSettings.companySettings as never,
    currencyCode: controller.currencyCode,
    currencyLabel: controller.currencyLabel,
  });

  const depositById = new Map<string, DepositRecord>(deposits.map((deposit) => [deposit.id, deposit]));

  /**
   * Voucher truth rules (never derived client-side):
   *  - Received  ← the deposit record itself: deposit_amount + received_date + request_id.
   *  - Returned  ← one specific POSTED, non-reversed refund event: its amount,
   *                effective_date and request_id. Reversed events never print.
   *  - Deducted  ← one specific APPLIED claim: its allocation_amount,
   *                application_effective_date (or applied event date) and
   *                application_request_id, with the claim kind + note as reason.
   * Each action is anchored to its own row, so multiple refund events or
   * applied claims can never be silently collapsed into an auto-picked one.
   */
  const receivedVoucherParams = (deposit: DepositRecord) => ({
    deposit,
    settings: documentSettings.companySettings,
    transactionKind: 'received' as const,
    amount: deposit.deposit_amount,
    transactionDate: deposit.received_date,
    reference: deposit.request_id ?? null,
  });

  const returnedVoucherParams = (event: DepositRefundEventRecord) => {
    const deposit = depositById.get(event.deposit_id);
    if (!deposit) return null;
    if (event.status !== 'POSTED' || event.reversed_at) return null;
    return {
      deposit,
      settings: documentSettings.companySettings,
      transactionKind: 'returned' as const,
      amount: event.amount,
      transactionDate: event.effective_date,
      reference: event.request_id,
    };
  };

  const deductedVoucherParams = (claim: DepositClaimRecord) => {
    const deposit = depositById.get(claim.deposit_id);
    if (!deposit) return null;
    if (claim.status !== 'APPLIED') return null;
    const transactionDate = claim.application_effective_date ?? claim.applied_at?.slice(0, 10);
    if (!transactionDate) return null;
    return {
      deposit,
      settings: documentSettings.companySettings,
      transactionKind: 'deducted' as const,
      amount: claim.allocation_amount,
      transactionDate,
      reference: claim.application_request_id ?? claim.id,
      reason: [depositClaimKindLabels[claim.claim_kind], claim.claim_note].filter(Boolean).join(' — ') || null,
    };
  };

  const missingVoucherBacking = () => toast.error('لا يمكن إصدار السند: الحركة غير مرحّلة نهائيًا أو بياناتها القانونية غير مكتملة.');

  const depositColumns = createDepositColumns(formatDepositMoney, {
    handlePrint,
    handleDownloadPdf,
    handlePrintReceivedVoucher: (deposit) => void printDepositVoucher(receivedVoucherParams(deposit)),
    handleDownloadReceivedVoucherPdf: (deposit) => void downloadDepositVoucherPdf(receivedVoucherParams(deposit)),
    openDepositAction,
    isDocumentReady: documentSettings.isReady,
  });

  const claimColumns = createClaimColumns(formatDepositMoney, {
    onApprove: (claim) => approveMut.mutate(claim),
    onOpenReject: openRejectClaim,
    onApply: (claim) => applyMut.mutate(claim),
    onOpenReverse: openReverseClaim,
    currentUserId,
    handlePrintDeductedVoucher: (claim) => {
      const params = deductedVoucherParams(claim);
      if (!params) { missingVoucherBacking(); return; }
      void printDepositVoucher(params);
    },
    handleDownloadDeductedVoucherPdf: (claim) => {
      const params = deductedVoucherParams(claim);
      if (!params) { missingVoucherBacking(); return; }
      void downloadDepositVoucherPdf(params);
    },
    isDocumentReady: documentSettings.isReady,
  });

  const refundColumns = createRefundColumns(formatDepositMoney, {
    onOpenReverseRefund: openReverseRefund,
    handlePrintReturnedVoucher: (event) => {
      const params = returnedVoucherParams(event);
      if (!params) { missingVoucherBacking(); return; }
      void printDepositVoucher(params);
    },
    handleDownloadReturnedVoucherPdf: (event) => {
      const params = returnedVoucherParams(event);
      if (!params) { missingVoucherBacking(); return; }
      void downloadDepositVoucherPdf(params);
    },
    isDocumentReady: documentSettings.isReady,
  });

  return (
    <div className="space-y-4">
      {!documentSettings.isReady && !documentSettings.isLoading ? <DocumentReadinessNotice /> : null}

      <RegisterMetricStrip
        aria-label="ملخص التأمينات"
        items={[
          { id: 'held', label: 'محتجزة', value: formatDepositMoney(totalHeld), icon: Wallet, hideWhenEmpty: true },
          {
            id: 'deducted',
            label: 'خصومات',
            value: formatDepositMoney(totalDeductions),
            icon: MinusCircle,
            hideWhenEmpty: true,
          },
          { id: 'refunded', label: 'مسترد', value: formatDepositMoney(totalRefunded), icon: CheckCircle2, hideWhenEmpty: true },
          { id: 'count', label: 'الودائع', value: formatLatinNumber(deposits.length, 'ar'), icon: FileCheck, hideWhenEmpty: true },
        ]}
      />

      <AsyncContentState
        status={contentStatus}
        error={depositsQuery.error as Error}
        errorTitle="تعذر تحميل الودائع"
        errorAction={<Button onClick={() => depositsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد ودائع تأمين"
        emptyDescription="ابدأ بتسجيل وديعة تأمين مرتبطة بعقد نشط، وسيحافظ النظام على أثرها المالي تلقائيًا."
        emptyAction={<Button onClick={() => setActionType('create')}>تسجيل أول وديعة</Button>}
      >
        <EntityTable aria-label="جدول التأمينات" rows={deposits} columns={depositColumns} keyOf={(deposit) => deposit.id} />
      </AsyncContentState>

      {claims.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">طلبات تخصيص الودائع</h3>
            <Button size="sm" variant="ghost" onClick={() => claimsQuery.refetch()}>
              تحديث
            </Button>
          </div>
          <EntityTable aria-label="جدول طلبات التخصيص" rows={claims} columns={claimColumns} keyOf={(claim) => claim.id} />
        </section>
      ) : null}

      {refundEvents.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">حركات رد الودائع</h3>
            <Button size="sm" variant="ghost" onClick={() => refundEventsQuery.refetch()}>
              تحديث
            </Button>
          </div>
          <EntityTable aria-label="جدول حركات الرد" rows={refundEvents} columns={refundColumns} keyOf={(event) => event.id} />
        </section>
      ) : null}

      <DepositCreateForm controller={controller} />
      <DepositClaimForm controller={controller} />
      <DepositRefundForm controller={controller} />
      <DepositReasonForm controller={controller} />
    </div>
  );
}