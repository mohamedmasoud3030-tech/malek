import type { FilterState } from './reports-page.helpers';

type FilterLabels = Readonly<{
  costCenter?: string;
  owner?: string;
  contract?: string;
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

  const segments = [
    `${filters.from || '—'} إلى ${filters.to || '—'}`,
    `حتى ${filters.asOf || '—'}`,
  ];

  if (labels.costCenter) segments.push(labels.costCenter);
  if (labels.owner) segments.push(labels.owner);
  if (labels.contract) segments.push(labels.contract);

  return {
    activeCount,
    label: segments.join(' · '),
  } as const;
}
