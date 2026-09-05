import { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { ReportFilterFieldId, ReportsFilterState } from '../reports-workspace-filters';

function uniqueById<T extends { id: string }>(values: Array<T | null | undefined>): T[] {
  return [...new Map(values.filter((value): value is T => Boolean(value)).map((value) => [value.id, value])).values()];
}

const reportInvoiceStatuses = ['unpaid', 'partial', 'paid', 'overdue', 'void', 'cancelled', 'draft'] as const;

const ALL_FILTER_FIELDS: readonly ReportFilterFieldId[] = [
  'period',
  'asOf',
  'property',
  'unit',
  'tenant',
  'status',
  'costCenter',
  'owner',
  'contract',
];

export function FiltersPanel({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  visibleFields,
  contentKind = 'report',
  showPeriodReset = true,
  onChange,
  onResetCurrentMonth,
}: Readonly<{
  filters: ReportsFilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  visibleFields?: readonly ReportFilterFieldId[];
  contentKind?: 'report' | 'statement';
  showPeriodReset?: boolean;
  onChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>) {
  const fields = new Set<ReportFilterFieldId>(visibleFields ?? ALL_FILTER_FIELDS);
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
  const isStatement = contentKind === 'statement';
  const filterTitle = isStatement ? 'نطاق كشف الحساب' : 'فلاتر التقرير';
  const filterDescription = isStatement
    ? showPeriodReset
      ? 'راجع نطاق الفترة المعتمد قبل قراءة كشف الحساب.'
      : 'اختر العقد لقراءة كشف الحساب المعتمد.'
    : 'اختر فقط ما تحتاجه لتضييق نتائج التقرير.';

  return (
    <FilterBar
      advancedFilterTitle={filterTitle}
      advancedFilterDescription={filterDescription}
      filters={(
        <>
          {fields.has('period') ? (
            <>
              <EntityForm.Field label={<span className="sr-only">من تاريخ</span>}>
                <Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
              </EntityForm.Field>
              <EntityForm.Field label={<span className="sr-only">إلى تاريخ</span>}>
                <Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
              </EntityForm.Field>
            </>
          ) : null}

          {fields.has('asOf') ? (
            <EntityForm.Field label={<span className="sr-only">تاريخ الاحتساب</span>}>
              <Input aria-label="تاريخ الاحتساب" type="date" value={filters.asOf} onChange={(event) => onChange({ ...filters, asOf: event.target.value })} />
            </EntityForm.Field>
          ) : null}

          {fields.has('property') ? (
            <Select
              aria-label="العقار"
              value={filters.propertyId ?? ''}
              onChange={(event) => onChange({ ...filters, propertyId: event.target.value, unitId: '', tenantId: '', contractId: '' })}
            >
              <option value="">كل العقارات</option>
              {propertyRows.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </Select>
          ) : null}

          {fields.has('unit') ? (
            <Select
              aria-label="الوحدة"
              value={filters.unitId ?? ''}
              onChange={(event) => onChange({ ...filters, unitId: event.target.value, tenantId: '', contractId: '' })}
            >
              <option value="">كل الوحدات</option>
              {unitRows.map((unit) => <option key={unit.id} value={unit.id}>وحدة {unit.unit_number}</option>)}
            </Select>
          ) : null}

          {fields.has('tenant') ? (
            <Select
              aria-label="المستأجر"
              value={filters.tenantId ?? ''}
              onChange={(event) => onChange({ ...filters, tenantId: event.target.value, contractId: '' })}
            >
              <option value="">كل المستأجرين</option>
              {tenantRows.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>)}
            </Select>
          ) : null}

          {fields.has('status') ? (
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
          ) : null}

          {fields.has('costCenter') ? (
            <Select aria-label="مركز التكلفة" value={filters.costCenterId} onChange={(event) => onChange({ ...filters, costCenterId: event.target.value })}>
              <option value="">كل مراكز التكلفة</option>
              {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
              ))}
            </Select>
          ) : null}

          {fields.has('owner') ? (
            <Select aria-label="المالك للكشف" value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}>
              <option value="">كل الملاك / اختر للكشف</option>
              {ownerRows.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name}</option>)}
            </Select>
          ) : null}

          {fields.has('contract') ? (
            <Select aria-label="العقد لكشف المستأجر" value={filters.contractId} onChange={(event) => onChange({ ...filters, contractId: event.target.value })}>
              <option value="">كل العقود / اختر لكشف المستأجر</option>
              {scopedContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.reference || 'عقد بلا مرجع'} · {(contract.people?.full_name ?? 'مستأجر غير محدد')} · {(contract.properties?.title ?? 'عقار غير محدد')} · {(contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'وحدة غير محددة')}
                </option>
              ))}
            </Select>
          ) : null}
        </>
      )}
      actions={
        showPeriodReset ? (
          <Button onClick={onResetCurrentMonth} variant="secondary">
            <RefreshCcw className="me-2 size-4" aria-hidden="true" />
            الشهر الحالي
          </Button>
        ) : undefined
      }
    />
  );
}
