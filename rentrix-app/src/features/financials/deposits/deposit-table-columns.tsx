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

function getDepositTone(status: DepositStatus): 'success' | 'info' | 'warning' {
  if (status === 'refunded') return 'success';
  if (status === 'held') return 'info';
  return 'warning';
}

function getClaimTone(status: DepositClaimRecord['status']): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'APPLIED' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'REVERSED') return 'warning';
  return 'info';
}

export type DepositTableActions = {
  handlePrint: (deposit: DepositRecord) => void;
  handleDownloadPdf: (deposit: DepositRecord) => void;
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
        </div>
      ),
    },
  ];
}

export type RefundTableActions = {
  onOpenReverseRefund: (event: DepositRefundEventRecord) => void;
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
      render: (event) =>
        event.status === 'POSTED' ? (
          <Button size="sm" variant="outline" onClick={() => actions.onOpenReverseRefund(event)}>
            <Undo2 className="size-3.5" /> إلغاء الاسترداد
          </Button>
        ) : null,
    },
  ];
}
