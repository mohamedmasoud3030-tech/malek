import { CheckCircle2, FileCheck, MinusCircle, Wallet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityTable } from '@/components/ui/entity-table';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { AsyncContentState } from '@/components/async-content-state';
import { formatLatinNumber } from '@/lib/formatters';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { createDepositDocumentActions } from './deposit-clearance-document';
import { createClaimColumns, createDepositColumns, createRefundColumns } from './deposit-table-columns';
import {
  DepositClaimForm,
  DepositCreateForm,
  DepositReasonForm,
  DepositRefundForm,
} from './deposit-action-forms';
import { useDepositWorkspaceController } from './use-deposit-workspace-controller';

export function DepositsWorkspace() {
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

  const { handlePrint, handleDownloadPdf } = createDepositDocumentActions({
    isReady: documentSettings.isReady,
    companySettings: documentSettings.companySettings as never,
    currencyCode: controller.currencyCode,
    currencyLabel: controller.currencyLabel,
  });

  const depositColumns = createDepositColumns(formatDepositMoney, {
    handlePrint,
    handleDownloadPdf,
    openDepositAction,
    isDocumentReady: documentSettings.isReady,
  });

  const claimColumns = createClaimColumns(formatDepositMoney, {
    onApprove: (claim) => approveMut.mutate(claim),
    onOpenReject: openRejectClaim,
    onApply: (claim) => applyMut.mutate(claim),
    onOpenReverse: openReverseClaim,
    currentUserId,
  });

  const refundColumns = createRefundColumns(formatDepositMoney, {
    onOpenReverseRefund: openReverseRefund,
  });

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">تأمينات المستأجرين</h2>
        </div>
        <Button onClick={() => setActionType('create')} className="min-h-11 gap-2 sm:shrink-0">
          <Plus className="size-4" />
          تسجيل وديعة جديدة
        </Button>
      </section>

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