import { useQuery } from '@tanstack/react-query';
import { listChartOfAccounts } from '@/features/accounting/chartOfAccountsService';
import { listAccountingPeriods } from '@/features/accounting/accountingPeriodsService';
import { listJournalBatches } from '@/features/accounting/journalService';

export type { AccountType, NormalBalance, AccountingPeriodStatus, JournalBatchStatus } from '@/features/accounting/accountingDomain';

export function useGeneralLedgerCore() {
  const accountsQuery = useQuery({
    queryKey: ['accounting', 'chart-of-accounts'],
    queryFn: listChartOfAccounts,
  });

  const periodsQuery = useQuery({
    queryKey: ['accounting', 'periods'],
    queryFn: listAccountingPeriods,
  });

  const batchesQuery = useQuery({
    queryKey: ['accounting', 'journal-batches'],
    queryFn: () => listJournalBatches({ limit: 15 }),
  });

  const isLoading = accountsQuery.isLoading || periodsQuery.isLoading || batchesQuery.isLoading;
  const isError = accountsQuery.isError || periodsQuery.isError || batchesQuery.isError;

  const accounts = accountsQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];

  const refetchAll = () => {
    void accountsQuery.refetch();
    void periodsQuery.refetch();
    void batchesQuery.refetch();
  };

  return {
    accounts,
    periods,
    batches,
    isLoading,
    isError,
    refetchAll,
  };
}
