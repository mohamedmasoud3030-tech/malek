import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUtilityBills } from '@/features/utilities/use-utilities';
import { useAllContracts } from '@/features/contracts/useContracts';
import { useAllUnits } from '@/features/units/use-units';
import { buildVacancyAnalytics } from '@/features/units/vacancy-analytics';
import { listPropertyTitles } from '@/features/properties/property-service';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { buildNeedsAttentionSignal, EMPTY_NEEDS_ATTENTION_SIGNAL, type NeedsAttentionSignal } from './needs-attention-signal';
import { buildMaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import { buildUtilityObligationsSignal } from './utility-obligations-signal';
import { toDateInputValue } from './dashboard-utils';

export type DashboardPriorities = Readonly<{
  signal: NeedsAttentionSignal;
  isLoading: boolean;
  /** The dashboard snapshot failed entirely (priorities cannot be built). */
  isError: boolean;
}>;

/**
 * Shared live "needs your decision" priority queue.
 *
 * Used by the notifications bell so the daily action queue lives with the
 * notification feed instead of taking over the top of the Today workspace.
 * The signal itself is presentation ranking only — no business rule is
 * re-decided here; every number comes from an authoritative read.
 */
export function useDashboardPriorities(enabled: boolean): DashboardPriorities {
  const now = useMemo(() => new Date(), []);
  const today = toDateInputValue(now);

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    isError: snapshotError,
  } = useQuery({
    queryKey: ['dashboard-snapshot', now.getMonth() + 1, now.getFullYear(), today],
    queryFn: () => getDashboardSnapshot(now),
    retry: false,
    enabled,
  });

  const supplementalEnabled = enabled && Boolean(snapshot);

  const utilityBillsQuery = useUtilityBills(undefined, { enabled: supplementalEnabled });
  const utilityObligations = useMemo(
    () => buildUtilityObligationsSignal(utilityBillsQuery.data, today),
    [utilityBillsQuery.data, today],
  );

  const needsVacancyDetails = supplementalEnabled && (snapshot?.occupancy.vacantUnits ?? 0) > 0;
  const unitsQuery = useAllUnits({ enabled: needsVacancyDetails });
  const contractsQuery = useAllContracts('all', { enabled: needsVacancyDetails });
  const propertyTitlesQuery = useQuery({
    queryKey: ['dashboard', 'property-titles'],
    queryFn: listPropertyTitles,
    retry: false,
    enabled: needsVacancyDetails,
  });
  const propertyTitleMap = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title])),
    [propertyTitlesQuery.data],
  );
  const vacancyAnalytics = useMemo(
    () => buildVacancyAnalytics(unitsQuery.data, contractsQuery.data?.rows, propertyTitleMap, today),
    [contractsQuery.data?.rows, propertyTitleMap, today, unitsQuery.data],
  );

  const maintenanceQuery = useMaintenance('all', '', { enabled: supplementalEnabled });
  const maintenanceFollowUp = useMemo(
    () => buildMaintenanceFollowUpSignal(maintenanceQuery.data, today),
    [maintenanceQuery.data, today],
  );

  const sourcesLoading = supplementalEnabled && (
    utilityBillsQuery.isLoading
    || maintenanceQuery.isLoading
    || (needsVacancyDetails && (unitsQuery.isLoading || contractsQuery.isLoading || propertyTitlesQuery.isLoading))
  );
  const sourcesComplete = supplementalEnabled
    && !sourcesLoading
    && !(snapshotError)
    && !(needsVacancyDetails && (unitsQuery.isError || contractsQuery.isError || propertyTitlesQuery.isError))
    && !maintenanceQuery.isError
    && !utilityBillsQuery.isError;

  const signal = useMemo(
    () => (snapshot
      ? buildNeedsAttentionSignal({
        snapshot,
        vacancyAnalytics,
        utilityObligations,
        maintenanceFollowUp,
        isComplete: sourcesComplete,
      })
      : { ...EMPTY_NEEDS_ATTENTION_SIGNAL, isComplete: false }),
    [snapshot, vacancyAnalytics, utilityObligations, maintenanceFollowUp, sourcesComplete],
  );

  return {
    signal,
    isLoading: snapshotLoading || sourcesLoading,
    isError: snapshotError && !snapshot,
  };
}
