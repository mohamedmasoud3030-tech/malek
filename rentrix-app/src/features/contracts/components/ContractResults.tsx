import { ContractTable } from './ContractTable';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractListItem } from '../services/contractService';

export function ContractResults({
  companySettings,
  contracts,
  expandedId,
  emptyDescription,
  emptyTitle,
  error,
  isError,
  isLoading,
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
  emptyDescription: string;
  emptyTitle: string;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  onCreate?: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
}) {
  return (
      <ContractTable
        companySettings={companySettings}
        contracts={contracts}
        expandedId={expandedId}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        error={isError ? error : undefined}
        isLoading={isLoading}
        onCreate={onCreate}
        onDelete={onDelete}
        onEdit={onEdit}
        onRetry={onRetry}
        pagination={pagination}
        setExpandedId={setExpandedId}
      />
  );
}
