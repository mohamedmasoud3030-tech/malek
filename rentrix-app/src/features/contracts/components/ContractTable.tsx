import { Link } from '@tanstack/react-router';
import { Edit, Eye, Trash2, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EntityCell } from '@/components/ui/entity-cell';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
import { getContractNumber } from '../contractListExport';
import { formatContractDate, formatContractMoney } from '../contractDisplayFormatters';
import { contractStatusLabels, contractStatusTone, paymentCycleLabels } from '../contractSchema';
import type { ContractListItem } from '../services/contractService';
import { getDaysUntilEnd, isExpiringSoon } from '../hooks/useContractFilters';
import { ContractMobileCard } from './ContractMobileCard';

function DetailBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1 text-sm leading-6">{children}</div>
    </div>
  );
}

export function ContractTable({
  companySettings,
  contracts,
  expandedId,
  error,
  isLoading,
  emptyDescription,
  emptyTitle,
  onCreate,
  onDelete,
  onEdit,
  onRetry,
  pagination,
  setExpandedId,
}: {
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  expandedId: string | null;
  error?: unknown;
  isLoading: boolean;
  emptyDescription: string;
  emptyTitle: string;
  onCreate?: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
}) {
  const columns: ColumnDef<ContractListItem>[] = [
    {
      key: 'contract_number',
      header: 'العقد رقم',
      render: (contract) => {
        const expiringSoon = isExpiringSoon(contract);
        const daysUntilEnd = getDaysUntilEnd(contract);
        return (
          <>
            <p className="font-bold">{getContractNumber(contract)}</p>
            {expiringSoon && (
              <p className="mt-1 text-xs font-semibold text-warning">ينتهي خلال {daysUntilEnd} يوم</p>
            )}
          </>
        );
      },
    },
    {
      key: 'tenant',
      header: 'المستأجر',
      render: (contract) => <EntityCell icon={User} title={contract.people?.full_name ?? '—'} />,
    },
    {
      key: 'unit',
      header: 'الوحدة',
      render: (contract) => contract.units?.unit_number ?? contract.properties?.title ?? '—',
    },
    {
      key: 'start_date',
      header: 'تاريخ البداية',
      render: (contract) => formatContractDate(companySettings, contract.start_date),
    },
    {
      key: 'end_date',
      header: 'تاريخ النهاية',
      render: (contract) => formatContractDate(companySettings, contract.end_date),
    },
    {
      key: 'rent_amount',
      header: 'قيمة الإيجار',
      render: (contract) => formatContractMoney(companySettings, contract.rent_amount),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (contract) => (
        <StatusBadge tone={contractStatusTone[contract.status]}>{contractStatusLabels[contract.status]}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'w-52',
      render: (contract) => (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="min-h-10 px-3" asChild>
            <Link to="/contracts/$contractId" params={{ contractId: contract.id }} aria-label={`عرض تفاصيل العقد ${getContractNumber(contract)}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
          <Button variant="secondary" className="min-h-10 px-3" onClick={() => onEdit(contract.id)}>
            <Edit className="size-4" />
          </Button>
          <Button
            variant="danger"
            className="min-h-10 px-3"
            aria-label={`حذف العقد ${getContractNumber(contract)}`}
            onClick={() => onDelete(contract.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
      <EntityTable
        aria-label="جدول العقود"
        rows={contracts}
        columns={columns}
        keyOf={(c) => c.id}
        isLoading={isLoading}
        error={error}
        errorTitle="تعذر تحميل العقود"
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={onCreate ? <Button onClick={onCreate}>إنشاء عقد</Button> : undefined}
        pagination={pagination}
        onRowClick={(contract) => setExpandedId((current) => (current === contract.id ? null : contract.id))}
        renderMobileCard={(contract) => (
          <ContractMobileCard
            companySettings={companySettings}
            contract={contract}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        )}
        renderRowExpansion={(contract) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DetailBox label="بيانات المستأجر">
              <p className="font-bold">{contract.people?.full_name ?? '—'}</p>
              <p className="text-muted-foreground">هاتف: {contract.people?.phone ?? '—'}</p>
              <p className="text-muted-foreground">بريد: {contract.people?.email ?? '—'}</p>
              <p className="text-muted-foreground">هوية: {contract.people?.national_id ?? '—'}</p>
            </DetailBox>
            <DetailBox label="بيانات الوحدة والعقار">
              <p className="font-bold">{contract.units?.unit_number ?? '—'} / {contract.properties?.title ?? '—'}</p>
              <p className="text-muted-foreground">الدور: {contract.units?.floor ?? '—'}</p>
              <p className="text-muted-foreground">العنوان: {contract.properties?.address ?? '—'}</p>
            </DetailBox>
            <DetailBox label="قيمة الإيجار">
              <p className="text-lg font-bold tabular-nums" dir="ltr">{formatContractMoney(companySettings, contract.rent_amount)}</p>
              <p className="text-muted-foreground">دورة السداد: {paymentCycleLabels[contract.payment_cycle]}</p>
            </DetailBox>
            <DetailBox label="فترة العقد">
              <p>{formatContractDate(companySettings, contract.start_date)} ← {formatContractDate(companySettings, contract.end_date)}</p>
              <p className="text-muted-foreground">رقم العقد: {getContractNumber(contract)}</p>
              {isExpiringSoon(contract) && (
                <p className="font-semibold text-warning">تنبيه: العقد ينتهي خلال {getDaysUntilEnd(contract)} يوم.</p>
              )}
            </DetailBox>
            <DetailBox label="الحالة">
              <StatusBadge tone={contractStatusTone[contract.status]}>{contractStatusLabels[contract.status]}</StatusBadge>
              <p className={cn('mt-2 text-muted-foreground', contract.units?.status === 'occupied' && 'text-primary')}>
                حالة الوحدة: {contract.units?.status ?? '—'}
              </p>
            </DetailBox>
          </div>
        )}
        expandedRowId={expandedId}
      />
  );
}
