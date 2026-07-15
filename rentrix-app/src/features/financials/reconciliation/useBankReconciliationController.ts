import { useMemo, useState } from 'react';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getTodayLocalDateString } from '../financials-date-utils';
import { summarizeReconciliation } from './bankReconciliationService';
import type {
  BankReconciliationFilters,
  BankReconciliationMatchValues,
  BankStatementImportValues,
  BankStatementLine,
  BankStatementLineFormValues,
} from './types';
import {
  useBankAccounts,
  useBankStatementLines,
  useCreateBankStatementLine,
  useIgnoreBankStatementLine,
  useImportBankStatementCsv,
  useMatchBankStatementLine,
  useSuggestedBankMatches,
} from './useBankReconciliation';

export const statusLabels = {
  all: 'كل الحالات',
  unmatched: 'غير مطابقة',
  matched: 'مطابقة',
  ignored: 'متجاهلة',
} as const;

export const entityLabels = {
  payment: 'دفعة',
  receipt: 'إيصال',
  expense: 'مصروف',
  manual_adjustment: 'تسوية يدوية',
} as const;

export const emptyLineDraft: BankStatementLineFormValues = {
  bank_account_id: '',
  transaction_date: getTodayLocalDateString(),
  description: '',
  reference: '',
  amount: '',
};

export const emptyMatchDraft: BankReconciliationMatchValues = {
  statement_line_id: '',
  matched_entity_type: 'payment',
  matched_entity_id: '',
  matched_amount: '',
  notes: '',
};

export const emptyImportDraft: BankStatementImportValues = {
  bank_account_id: '',
  statement_name: '',
  csv: '',
};

export function useBankReconciliationController() {
  const [filters, setFilters] = useState<BankReconciliationFilters>({
    bankAccountId: '',
    status: 'all',
    from: '',
    to: '',
  });
  const [lineDraft, setLineDraft] = useState<BankStatementLineFormValues>(emptyLineDraft);
  const [matchDraft, setMatchDraft] = useState<BankReconciliationMatchValues>(emptyMatchDraft);
  const [importDraft, setImportDraft] = useState<BankStatementImportValues>(emptyImportDraft);
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [importFormOpen, setImportFormOpen] = useState(false);
  const [pendingIgnoreLineId, setPendingIgnoreLineId] = useState<string | null>(null);

  const accountsQuery = useBankAccounts();
  const linesQuery = useBankStatementLines(filters);
  const createLine = useCreateBankStatementLine();
  const importCsv = useImportBankStatementCsv();
  const matchLine = useMatchBankStatementLine();
  const ignoreLine = useIgnoreBankStatementLine();
  const { authorization } = useAuth();

  const lines = linesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const summary = useMemo(() => summarizeReconciliation(lines), [lines]);
  const selectedLine = lines.find((line) => line.id === matchDraft.statement_line_id);
  const suggestionsQuery = useSuggestedBankMatches(selectedLine);
  const canManageReconciliation = canAccess(authorization, financialOperationPermissions.matchBankReconciliation);
  const writeError = createLine.error ?? importCsv.error ?? matchLine.error ?? ignoreLine.error;
  const pendingIgnoreLine = lines.find((line) => line.id === pendingIgnoreLineId) ?? null;
  const unmatchedLines = lines.filter((line) => line.status === 'unmatched');
  const hasFilters = Boolean(filters.bankAccountId || filters.status !== 'all' || filters.from || filters.to);

  const openManualLineForm = () => {
    setLineDraft({
      ...emptyLineDraft,
      bank_account_id: filters.bankAccountId || accounts[0]?.id || '',
    });
    setLineFormOpen(true);
  };

  const openImportForm = () => {
    setImportDraft({
      ...emptyImportDraft,
      bank_account_id: filters.bankAccountId || accounts[0]?.id || '',
    });
    setImportFormOpen(true);
  };

  const openMatchForm = () => {
    const firstLine = unmatchedLines[0];
    setMatchDraft({
      ...emptyMatchDraft,
      statement_line_id: firstLine?.id ?? '',
      matched_amount: firstLine?.amount.toString() ?? '',
    });
    setMatchFormOpen(true);
  };

  const handleCreateLineSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageReconciliation) return;
    createLine.mutate(lineDraft, {
      onSuccess: () => {
        setLineDraft(emptyLineDraft);
        setLineFormOpen(false);
      },
    });
  };

  const handleImportCsvSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageReconciliation) return;
    importCsv.mutate(importDraft, {
      onSuccess: () => {
        setImportDraft(emptyImportDraft);
        setImportFormOpen(false);
      },
    });
  };

  const handleMatchLineSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageReconciliation || !selectedLine) return;
    matchLine.mutate(matchDraft, {
      onSuccess: () => {
        setMatchDraft(emptyMatchDraft);
        setMatchFormOpen(false);
      },
    });
  };

  const handleIgnoreLineConfirm = () => {
    if (!pendingIgnoreLineId || !canManageReconciliation) return;
    ignoreLine.mutate(pendingIgnoreLineId, { onSuccess: () => setPendingIgnoreLineId(null) });
  };

  return {
    filters,
    lineDraft,
    matchDraft,
    importDraft,
    lineFormOpen,
    matchFormOpen,
    importFormOpen,
    pendingIgnoreLineId,
    accountsQuery,
    linesQuery,
    createLine,
    importCsv,
    matchLine,
    ignoreLine,
    lines,
    accounts,
    summary,
    selectedLine,
    suggestionsQuery,
    canManageReconciliation,
    writeError,
    pendingIgnoreLine,
    unmatchedLines,
    hasFilters,
    setFilters,
    setLineDraft,
    setMatchDraft,
    setImportDraft,
    setLineFormOpen,
    setMatchFormOpen,
    setImportFormOpen,
    setPendingIgnoreLineId,
    openManualLineForm,
    openImportForm,
    openMatchForm,
    handleCreateLineSubmit,
    handleImportCsvSubmit,
    handleMatchLineSubmit,
    handleIgnoreLineConfirm,
  };
}
