import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createBankStatementImportFromCsv, createBankStatementLine, ignoreBankStatementLine, listBankAccounts, listBankStatementLines, listSuggestedBankMatches, matchBankStatementLine } from './bankReconciliationService';
import type { BankReconciliationFilters, BankReconciliationMatchValues, BankStatementImportValues, BankStatementLine, BankStatementLineFormValues } from './types';

export const bankReconciliationKeys = {
  all: ['bank-reconciliation'] as const,
  accounts: () => [...bankReconciliationKeys.all, 'accounts'] as const,
  lines: (filters: BankReconciliationFilters) => [...bankReconciliationKeys.all, 'lines', filters] as const,
  suggestions: (line?: Pick<BankStatementLine, 'id' | 'amount' | 'transaction_date'> | null) => [...bankReconciliationKeys.all, 'suggestions', line?.id ?? 'none', line?.amount ?? 0, line?.transaction_date ?? ''] as const,
};

export function useBankAccounts() {
  return useQuery({ queryKey: bankReconciliationKeys.accounts(), queryFn: listBankAccounts });
}

export function useBankStatementLines(filters: BankReconciliationFilters) {
  return useQuery({ queryKey: bankReconciliationKeys.lines(filters), queryFn: () => listBankStatementLines(filters) });
}

export function useSuggestedBankMatches(line?: Pick<BankStatementLine, 'id' | 'amount' | 'transaction_date'> | null) {
  return useQuery({ queryKey: bankReconciliationKeys.suggestions(line), queryFn: () => line ? listSuggestedBankMatches(line) : Promise.resolve([]), enabled: Boolean(line) });
}

export function useCreateBankStatementLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BankStatementLineFormValues) => createBankStatementLine(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all });
      toast.success('تمت إضافة حركة كشف البنك');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إضافة حركة كشف البنك'),
  });
}

export function useImportBankStatementCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BankStatementImportValues) => createBankStatementImportFromCsv(values),
    onSuccess: async (lines) => {
      await queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all });
      toast.success(`تم استيراد ${lines.length} حركة من كشف البنك`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر استيراد كشف البنك'),
  });
}

export function useMatchBankStatementLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BankReconciliationMatchValues) => matchBankStatementLine(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all });
      toast.success('تم تسجيل المطابقة البنكية');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل المطابقة البنكية'),
  });
}

export function useIgnoreBankStatementLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreBankStatementLine,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all });
      toast.success('تم تجاهل حركة كشف البنك');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تجاهل حركة كشف البنك'),
  });
}
