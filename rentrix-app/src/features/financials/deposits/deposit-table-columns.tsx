import { Download, Printer, ShieldAlert, DollarSign, Undo2 } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ColumnDef } from '@/components/ui/entity-table';
import { formatDepositContractReference } from './deposit-contract-options';
import {
  depositClaimKindLabels,
  depositClaimStatusLabels,
  depositStatusLabels,
  type DepositClaimRecord,
  type DepositRecord,
  type DepositRefundEventRecord,
  type DepositStatus,
} from './deposit-service';
import type { SemanticTone } from '@/components/ui/status-badge';

function getDepositTone(status: DepositStatus): 'success' | 'info' | 'warning' {
  if (status === 'refunded') return 'success';
  if (status === 'held') return 'info';
  return 'warning';
}

function getClaimTone(status: DepositClaimRecord['status']): SemanticTone {
  if (status === 'APPLIED' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'REVERSED') return 'warning';
  return 'info';
}

export type DepositTableActions = {
  handlePrint: (deposit: DepositRecord) => void;
  handleDownloadPdf: (deposit: DepositRecord) => void;
  handlePrintReceivedVoucher: (deposit: DepositRecord) => void;
  handleDownloadReceivedVoucherPdf: (deposit: DepositRecord) => void;
  openDepositAction: (deposit: DepositRecord, type: 'claim' | 'refund') => void;
  isDocumentReady: boolean;
};

export function createDepositColumns(
  formatDepositMoney: (value: number) => string,
  actions: DepositTableActions,
): ColumnDef<DepositRecord>[] {
  const depositActions = (deposit: DepositRecord) => [
    { id: 'print', label: 'طباعة', icon: Printer, onClick: () => actions.handlePrint(deposit), disabled: !actions.isDocumentReady },
    { id: 'pdf', label: 'تنزيل PDF', icon: Download, onClick: () => actions.handleDownloadPdf(deposit), disabled: !actions.isDocumentReady },
    // Received voucher is backed by the canonical deposit record itself:
    // original deposit_amount and received_date, never reconstructed balances.
    ...(deposit.deposit_amount > 0 && deposit.received_date
      ? [
          { id: 'received-voucher-print', label: 'طباعة سند استلام التأمين', icon: Printer, onClick: () => actions.handlePrintReceivedVoucher(deposit), disabled: !actions.isDocumentReady },
          { id: 'received-voucher-pdf', label: 'سند استلام التأمين PDF', icon: Download, onClick: () => actions.handleDownloadReceivedVoucherPdf(deposit), disabled: !actions.isDocumentReady },
        ]
      : []),
    ...(deposit.remaining_amount > 0
      ? [
          { id: 'claim', label: 'طلب تخصيص (بإثبات)', icon: ShieldAlert, onClick: () => actions.openDepositAction(deposit, 'claim') },
          { id: 'refund', label: 'رد التأمين', icon: DollarSign, onClick: () => actions.openDepositAction(deposit, 'refund') },
        ]
      : []),
  ];

  return [
    {
      key: 'contract',
      header: 'العقد والمستأجر',
      priority: 'identity',
      render: (deposit) => (
        <div className="min-w-0">
          <p className="font-bold">{formatDepositContractReference(deposit)}</p>
          {deposit.tenant_name ? <p className="mt-0.5 text-xs text-muted-foreground">{deposit.tenant_name}</p> : null}
        </div>
      ),
    },
    {
      key: 'received_date',
      header: 'تاريخ الاستلام',
      priority: 'detail',
      render: (deposit) => (
        <span dir="ltr" className="tabular-nums">
          {deposit.received_date}
        </span>
      ),
    },
    {
      key: 'original',
      header: 'الأصلي',
      priority: 'detail',
      render: (deposit) => (
        <span dir="ltr" className="font-bold tabular-nums">
          {formatDepositMoney(deposit.deposit_amount)}
        </span>
      ),
    },
    {
      key: 'deducted',
      header: 'المخصوم',
      priority: 'secondary',
      render: (deposit) => (
        <span dir="ltr" className="font-bold text-destructive tabular-nums">
          {formatDepositMoney(deposit.deducted_amount)}
        </span>
      ),
    },
    {
      key: 'refunded',
      header: 'المسترد',
      priority: 'secondary',
      render: (deposit) => (
        <span dir="ltr" className="font-bold text-success tabular-nums">
          {formatDepositMoney(deposit.refunded_amount)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'المتبقي',
      priority: 'primary',
      render: (deposit) => (
        <span dir="ltr" className="font-black text-primary tabular-nums">
          {formatDepositMoney(deposit.remaining_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'secondary',
      render: (deposit) => <StatusBadge tone={getDepositTone(deposit.status)}>{depositStatusLabels[deposit.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (deposit) => (
        <ActionMenu label={`إجراءات ${formatDepositContractReference(deposit)}`} items={depositActions(deposit)} />
      ),
    },
  ];
}

export type ClaimTableActions = {
  onApprove: (claim: DepositClaimRecord) => void;
  onOpenReject: (claim: DepositClaimRecord) => void;
  onApply: (claim: DepositClaimRecord) => void;
  onOpenReverse: (claim: DepositClaimRecord) => void;
  currentUserId: string;
  /**
   * Deducted voucher for THIS applied claim only. Exposed exclusively when
   * `claim.status === 'APPLIED'`: the voucher documents a specific posted
   * application event, so PENDING/APPROVED/REJECTED/REVERSED claims never
   * produce one, and no other claim is ever auto-selected in its place.
   */
  handlePrintDeductedVoucher: (claim: DepositClaimRecord) => void;
  handleDownloadDeductedVoucherPdf: (claim: DepositClaimRecord) => void;
  isDocumentReady: boolean;
};

export function createClaimColumns(
  formatDepositMoney: (value: number) => string,
  actions: ClaimTableActions,
): ColumnDef<DepositClaimRecord>[] {
  return [
    {
      key: 'claim',
      header: 'الطلب',
      render: (claim) => (
        <div className="min-w-0">
          <p className="font-bold">{depositClaimKindLabels[claim.claim_kind]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {claim.evidence_uri}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (claim) => (
        <span dir="ltr" className="font-bold tabular-nums">
          {formatDepositMoney(claim.allocation_amount)}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'الحساب',
      render: (claim) => <span className="tabular-nums">{claim.target_account_no ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (claim) => <StatusBadge tone={getClaimTone(claim.status)}>{depositClaimStatusLabels[claim.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (claim) => (
        <div className="flex flex-wrap items-center gap-1">
          {claim.status === 'PENDING' && claim.created_by !== actions.currentUserId ? (
            <Button size="sm" variant="default" onClick={() => actions.onApprove(claim)}>
              اعتماد
            </Button>
          ) : null}
          {claim.status === 'PENDING' && claim.created_by !== actions.currentUserId ? (
            <Button size="sm" variant="outline" onClick={() => actions.onOpenReject(claim)}>
              رفض
            </Button>
          ) : null}
          {claim.status === 'APPROVED' ? (
            <Button size="sm" variant="default" onClick={() => actions.onApply(claim)}>
              تطبيق
            </Button>
          ) : null}
          {claim.status === 'APPLIED' ? (
            <Button size="sm" variant="outline" onClick={() => actions.onOpenReverse(claim)}>
              <Undo2 className="size-3.5" /> إلغاء
            </Button>
          ) : null}
          {claim.status === 'APPLIED' ? (
            <ActionMenu
              label="سند الخصم"
              items={[
                { id: 'deducted-voucher-print', label: 'طباعة سند الخصم', icon: Printer, onClick: () => actions.handlePrintDeductedVoucher(claim), disabled: !actions.isDocumentReady },
                { id: 'deducted-voucher-pdf', label: 'سند الخصم PDF', icon: Download, onClick: () => actions.handleDownloadDeductedVoucherPdf(claim), disabled: !actions.isDocumentReady },
              ]}
            />
          ) : null}
        </div>
      ),
    },
  ];
}

export type RefundTableActions = {
  onOpenReverseRefund: (event: DepositRefundEventRecord) => void;
  /**
   * Returned voucher for THIS refund event only. Exposed exclusively for a
   * POSTED, non-reversed event: a reversed refund never yields a final
   * returned voucher, and multiple refund events never fall back to an
   * implicit first/latest pick — each row documents its own event.
   */
  handlePrintReturnedVoucher: (event: DepositRefundEventRecord) => void;
  handleDownloadReturnedVoucherPdf: (event: DepositRefundEventRecord) => void;
  isDocumentReady: boolean;
};

export function createRefundColumns(
  formatDepositMoney: (value: number) => string,
  actions: RefundTableActions,
): ColumnDef<DepositRefundEventRecord>[] {
  return [
    {
      key: 'refund',
      header: 'الاسترداد',
      render: (event) => <span dir="ltr" className="tabular-nums">{event.effective_date}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (event) => (
        <span dir="ltr" className="font-bold tabular-nums">
          {formatDepositMoney(event.amount)}
        </span>
      ),
    },
    {
      key: 'account',
      header: 'الحساب النقدي',
      render: (event) => <span className="tabular-nums">{event.cash_account_no}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (event) => (
        <StatusBadge tone={event.status === 'POSTED' ? 'success' : 'warning'}>
          {event.status === 'POSTED' ? 'مرحّل' : 'ملغى'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (event) => {
        const isFinalPosted = event.status === 'POSTED' && !event.reversed_at;
        if (!isFinalPosted) return null;
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => actions.onOpenReverseRefund(event)}>
              <Undo2 className="size-3.5" /> إلغاء الاسترداد
            </Button>
            <ActionMenu
              label="سند رد التأمين"
              items={[
                { id: 'returned-voucher-print', label: 'طباعة سند رد التأمين', icon: Printer, onClick: () => actions.handlePrintReturnedVoucher(event), disabled: !actions.isDocumentReady },
                { id: 'returned-voucher-pdf', label: 'سند رد التأمين PDF', icon: Download, onClick: () => actions.handleDownloadReturnedVoucherPdf(event), disabled: !actions.isDocumentReady },
              ]}
            />
          </div>
        );
      },
    },
  ];
}
