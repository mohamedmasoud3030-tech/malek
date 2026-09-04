import { FileText, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts, type PreviewFactRow } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { contractStatusLabels, contractStatusTone, leaseModeLabels, paymentCycleLabels } from '../contractSchema';
import { normalizeContractStatus } from '@/lib/contractStatus';
import { unitStatusLabels, type UnitStatus } from '@/features/units/unit-schema';
import { getContractNumber } from '../contractListExport';
import { formatContractDate, formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import type { ContractAttention, ContractAttentionSeverity } from '../contract-attention';
import { contractNextActionShortLabels, getContractNextAction } from '../lifecycle/contractLifecycleRules';

const attentionToneBySeverity: Record<ContractAttentionSeverity, 'danger' | 'warning' | 'info'> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
};

function isShortStayContract(contract: Pick<ContractListItem, 'lease_mode'>) {
  return contract.lease_mode === 'short_stay';
}

function leaseModeLabel(leaseMode: string): string {
  return leaseModeLabels[leaseMode as keyof typeof leaseModeLabels] ?? leaseMode;
}

/**
 * Contract Quick Preview — glance-first with the operational signal that
 * decides whether the row needs a human (attention + next action), replacing
 * the former inline row expansion. The complete workspace stays on
 * «فتح العقد بالكامل».
 */
export function ContractPreviewDialog({
  contract,
  attention,
  companySettings,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: Readonly<{
  contract: ContractListItem | null;
  attention?: ContractAttention;
  companySettings: CompanySettingsContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}>) {
  const navigate = useNavigate();
  if (!contract) {
    return (
      <EntityPreviewDialog open={open} onOpenChange={onOpenChange} title="معاينة العقد">
        <PreviewFacts rows={[]} />
      </EntityPreviewDialog>
    );
  }

  const nextAction = attention?.nextAction ?? getContractNextAction(contract);
  const reasons = attention?.reasons ?? [];
  const paymentLoaded = attention ? attention.invoiceContextLoaded : false;
  const unitStatusLabel = contract.units?.status
    ? unitStatusLabels[contract.units.status]
    : '—';

  const paymentContext = paymentLoaded
    ? attention && attention.overdueInvoiceCount > 0
      ? `${attention.overdueInvoiceCount} فاتورة متأخرة بإجمالي ${formatContractMoney(companySettings, attention.overdueAmount)}`
      : attention && attention.receivableInvoiceCount > 0
        ? `${attention.receivableInvoiceCount} فاتورة غير مسددة بإجمالي ${formatContractMoney(companySettings, attention.outstandingAmount)}`
        : 'لا توجد فواتير غير مسددة'
    : null;

  const facts: PreviewFactRow[] = [
    { label: 'المستأجر', value: contract.people?.full_name ?? '—' },
    { label: 'الهاتف', value: contract.people?.phone ? <span dir="ltr">{contract.people.phone}</span> : 'غير موثق' },
    {
      label: 'العقار / الوحدة',
      value: `${contract.properties?.title ?? 'عقار غير محدد'}${contract.units?.unit_number ? ` · وحدة ${contract.units.unit_number}` : ''}`,
    },
    { label: 'حالة الوحدة', value: unitStatusLabel },
    {
      label: 'فترة العقد',
      value: `${formatContractDate(companySettings, contract.start_date)} ← ${formatContractDate(companySettings, contract.end_date)}`,
    },
    {
      label: isShortStayContract(contract) ? 'إجمالي الإقامة' : 'قيمة الإيجار',
      value: <span dir="ltr">{formatContractMoney(companySettings, contract.rent_amount)}</span>,
    },
    ...(isShortStayContract(contract) && contract.daily_reference_rate != null
      ? [{
          label: 'سعر اليوم المرجعي',
          value: <span dir="ltr">{formatContractMoney(companySettings, contract.daily_reference_rate)}</span>,
        } satisfies PreviewFactRow]
      : []),
    {
      label: 'دورة السداد',
      value: isShortStayContract(contract) ? 'فاتورة واحدة عند الوصول' : (paymentCycleLabels[contract.payment_cycle] ?? contract.payment_cycle),
    },
    { label: 'نوع الإيجار', value: leaseModeLabel(contract.lease_mode) },
    { label: 'المدفوعات', value: paymentContext ?? 'جارٍ التحقق من حالة المدفوعات…', wide: true },
  ];

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={getContractNumber(contract)}
      description={leaseModeLabel(contract.lease_mode)}
      status={
        <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
          {contractStatusLabels[normalizeContractStatus(contract.status)]}
        </StatusBadge>
      }
      actions={reasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((reason) => (
            <StatusBadge key={reason.flag} tone={attentionToneBySeverity[reason.severity]}>
              {reason.detail ? `${reason.label} — ${reason.detail}` : reason.label}
            </StatusBadge>
          ))}
        </div>
      ) : undefined}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}
          >
            <FileText className="me-2 size-4" aria-hidden="true" />
            فتح العقد بالكامل
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onEdit(contract.id)}>
              <Pencil className="me-2 size-4" aria-hidden="true" />
              تعديل
            </Button>
          ) : null}
          {onDelete ? (
            <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={() => onDelete(contract.id)}>
              <Trash2 className="me-2 size-4" aria-hidden="true" />
              أرشفة
            </Button>
          ) : null}
        </div>
      }
    >
      <PreviewFacts rows={facts} />
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">الإجراء التالي</p>
        <p className="mt-0.5 text-sm font-bold text-primary">
          {nextAction ? contractNextActionShortLabels[nextAction] : 'لا يوجد إجراء مطلوب'}
        </p>
      </div>
    </EntityPreviewDialog>
  );
}
