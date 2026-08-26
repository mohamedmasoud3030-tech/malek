import { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { describeReportFilterSelections, getSelectedFilterEntities } from '../reports-filters.shared';
import type { ReportsFilterState } from '../reports-workspace-filters';

function uniqueById<T extends { id: string }>(values: Array<T | null | undefined>): T[] {
  return [...new Map(values.filter((value): value is T => Boolean(value)).map((value) => [value.id, value])).values()];
}

const reportInvoiceStatuses = ['unpaid', 'partial', 'paid', 'overdue', 'void', 'cancelled', 'draft'] as const;

export function FiltersPanel({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  onChange,
  onResetCurrentMonth,
}: Readonly<{
  filters: ReportsFilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  onChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>) {
  const labels = describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );

  const propertyRows = useMemo(() => uniqueById(contractRows.map((contract) => contract.properties)), [contractRows]);
  const contractsInProperty = useMemo(
    () => contractRows.filter((contract) => !filters.propertyId || contract.properties?.id === filters.propertyId),
    [contractRows, filters.propertyId],
  );
  const unitRows = useMemo(() => uniqueById(contractsInProperty.map((contract) => contract.units)), [contractsInProperty]);
  const contractsInUnit = useMemo(
    () => contractsInProperty.filter((contract) => !filters.unitId || contract.units?.id === filters.unitId),
    [contractsInProperty, filters.unitId],
  );
  const tenantRows = useMemo(() => uniqueById(contractsInUnit.map((contract) => contract.people)), [contractsInUnit]);
  const scopedContracts = useMemo(
    () => contractsInUnit.filter((contract) => !filters.tenantId || contract.people?.id === filters.tenantId),
    [contractsInUnit, filters.tenantId],
  );

  return (
    <div className="space-y-3">
      <FilterBar
        filters={(
          <>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">من تاريخ</span>
              <Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
            </label>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">إلى تاريخ</span>
              <Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
            </label>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">تاريخ الاحتساب</span>
              <Input aria-label="تاريخ الاحتساب" type="date" value={filters.asOf} onChange={(event) => onChange({ ...filters, asOf: event.target.value })} />
            </label>

            <Select
              aria-label="العقار"
              value={filters.propertyId ?? ''}
              onChange={(event) => onChange({ ...filters, propertyId: event.target.value, unitId: '', tenantId: '', contractId: '' })}
            >
              <option value="">كل العقارات</option>
              {propertyRows.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </Select>
            <Select
              aria-label="الوحدة"
              value={filters.unitId ?? ''}
              onChange={(event) => onChange({ ...filters, unitId: event.target.value, tenantId: '', contractId: '' })}
            >
              <option value="">كل الوحدات</option>
              {unitRows.map((unit) => <option key={unit.id} value={unit.id}>وحدة {unit.unit_number}</option>)}
            </Select>
            <Select
              aria-label="المستأجر"
              value={filters.tenantId ?? ''}
              onChange={(event) => onChange({ ...filters, tenantId: event.target.value, contractId: '' })}
            >
              <option value="">كل المستأجرين</option>
              {tenantRows.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>)}
            </Select>
            <Select
              aria-label="حالة الفاتورة"
              value={filters.status ?? 'all'}
              onChange={(event) => onChange({ ...filters, status: event.target.value as ReportsFilterState['status'] })}
            >
              <option value="all">كل حالات الفواتير</option>
              {reportInvoiceStatuses.map((status) => (
                <option key={status} value={status}>{invoiceStatusLabels[status] ?? status}</option>
              ))}
            </Select>
            <Select aria-label="مركز التكلفة" value={filters.costCenterId} onChange={(event) => onChange({ ...filters, costCenterId: event.target.value })}>
              <option value="">كل مراكز التكلفة</option>
              {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
              ))}
            </Select>
            <Select aria-label="المالك للكشف" value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}>
              <option value="">كل الملاك / اختر للكشف</option>
              {ownerRows.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name}</option>)}
            </Select>
            <Select aria-label="العقد لكشف المستأجر" value={filters.contractId} onChange={(event) => onChange({ ...filters, contractId: event.target.value })}>
              <option value="">كل العقود / اختر لكشف المستأجر</option>
              {scopedContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.reference || 'عقد بلا مرجع'} · {(contract.people?.full_name ?? 'مستأجر غير محدد')} · {(contract.properties?.title ?? 'عقار غير محدد')} · {(contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'وحدة غير محددة')}
                </option>
              ))}
            </Select>
          </>
        )}
        actions={(
          <Button onClick={onResetCurrentMonth} variant="secondary">
            <RefreshCcw className="me-2 size-4" aria-hidden="true" />
            الشهر الحالي
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground" aria-live="polite">
        <span>الفترة: {filters.from || '—'} إلى {filters.to || '—'}</span>
        <span aria-hidden="true">•</span>
        <span>الاحتساب: {filters.asOf || '—'}</span>
        {labels.property ? <><span aria-hidden="true">•</span><span>العقار: {labels.property}</span></> : null}
        {labels.unit ? <><span aria-hidden="true">•</span><span>الوحدة: {labels.unit}</span></> : null}
        {labels.tenant ? <><span aria-hidden="true">•</span><span>المستأجر: {labels.tenant}</span></> : null}
        {filters.status && filters.status !== 'all' ? <><span aria-hidden="true">•</span><span>الحالة: {invoiceStatusLabels[filters.status] ?? filters.status}</span></> : null}
        {labels.costCenter ? <><span aria-hidden="true">•</span><span>مركز التكلفة: {labels.costCenter}</span></> : null}
        {labels.owner ? <><span aria-hidden="true">•</span><span>المالك/الكشف: {labels.owner}</span></> : null}
        {labels.contract ? <><span aria-hidden="true">•</span><span>العقد: {labels.contract}</span></> : null}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        العقار والوحدة والمستأجر والعقد وحالة الفاتورة تُطبق على تقارير التحصيل والفواتير التي تدعم هذه الأبعاد؛ مركز التكلفة يطبق على المصادر المالية الداعمة، واختيار المالك يستخدم لكشف المالك فقط.
      </p>
    </div>
  );
}
