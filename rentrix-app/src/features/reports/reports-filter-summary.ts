import type { FilterState } from './reports-page.helpers';

type FilterLabels = Readonly<{
  costCenter?: string;
  owner?: string;
  contract?: string;
}>;

export type ReportFilterChip = Readonly<{
  key: 'period' | 'asOf' | 'costCenter' | 'owner' | 'contract';
  label: string;
  value: string;
  isActive: boolean;
}>;

export function buildReportFilterSummary(
  filters: FilterState,
  defaults: FilterState,
  labels: FilterLabels,
) {
  const hasCustomDates = filters.from !== defaults.from
    || filters.to !== defaults.to
    || filters.asOf !== defaults.asOf;
  const activeCount = Number(hasCustomDates)
    + Number(Boolean(filters.costCenterId))
    + Number(Boolean(filters.ownerId))
    + Number(Boolean(filters.contractId));

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

  if (labels.costCenter) chips.push({ key: 'costCenter', label: 'مركز التكلفة', value: labels.costCenter, isActive: true });
  if (labels.owner) chips.push({ key: 'owner', label: 'المالك', value: labels.owner, isActive: true });
  if (labels.contract) chips.push({ key: 'contract', label: 'العقد', value: labels.contract, isActive: true });

  return {
    activeCount,
    label: chips.map((chip) => `${chip.label}: ${chip.value}`).join(' · '),
    chips,
  } as const;
}
