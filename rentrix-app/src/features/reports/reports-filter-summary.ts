import type { ReportsFilterState } from './reports-workspace-filters';

type FilterLabels = Readonly<{
  costCenter?: string;
  owner?: string;
  contract?: string;
  property?: string;
  unit?: string;
  tenant?: string;
  status?: string;
}>;

export type ReportFilterChip = Readonly<{
  key: 'period' | 'asOf' | 'costCenter' | 'owner' | 'contract' | 'property' | 'unit' | 'tenant' | 'status';
  label: string;
  value: string;
  isActive: boolean;
}>;

export function buildReportFilterSummary(
  filters: ReportsFilterState,
  defaults: ReportsFilterState,
  labels: FilterLabels,
) {
  const hasCustomDates = filters.from !== defaults.from
    || filters.to !== defaults.to
    || filters.asOf !== defaults.asOf;
  const activeCount = Number(hasCustomDates)
    + Number(Boolean(filters.propertyId))
    + Number(Boolean(filters.unitId))
    + Number(Boolean(filters.tenantId))
    + Number(Boolean(filters.costCenterId))
    + Number(Boolean(filters.ownerId))
    + Number(Boolean(filters.contractId))
    + Number(Boolean(filters.status && filters.status !== 'all'));

  const chips: ReportFilterChip[] = [
    {
      key: 'period',
      label: 'الفترة',
      value: `${filters.from || '—'} — ${filters.to || '—'}`,
      isActive: filters.from !== defaults.from || filters.to !== defaults.to,
    },
    {
      key: 'asOf',
      label: 'حتى',
      value: filters.asOf || '—',
      isActive: filters.asOf !== defaults.asOf,
    },
  ];

  if (labels.property) chips.push({ key: 'property', label: 'العقار', value: labels.property, isActive: true });
  if (labels.unit) chips.push({ key: 'unit', label: 'الوحدة', value: labels.unit, isActive: true });
  if (labels.tenant) chips.push({ key: 'tenant', label: 'المستأجر', value: labels.tenant, isActive: true });
  if (labels.costCenter) chips.push({ key: 'costCenter', label: 'مركز التكلفة', value: labels.costCenter, isActive: true });
  if (labels.owner) chips.push({ key: 'owner', label: 'المالك/الكشف', value: labels.owner, isActive: true });
  if (labels.contract) chips.push({ key: 'contract', label: 'العقد', value: labels.contract, isActive: true });
  if (labels.status) chips.push({ key: 'status', label: 'حالة الفاتورة', value: labels.status, isActive: true });

  return {
    activeCount,
    label: chips.map((chip) => `${chip.label}: ${chip.value}`).join(' · '),
    chips,
  } as const;
}
