import { ContractTable } from './ContractTable';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractListItem } from '../services/contractService';
import type { ContractAttention } from '../contract-attention';

export function ContractResults({
  attentionByContractId,
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
  onPreview,
  onRetry,
  pagination,
  setExpandedId,
  visibleColumnKeys,
}: {
  /** Operational attention per contract (see `useContractAttention`). */
  attentionByContractId?: ReadonlyMap<string, ContractAttention>;
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  expandedId: string | null;
  emptyDescription: string;
  emptyTitle: string;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPreview: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
  visibleColumnKeys: readonly string[];
}) {
  return (
    <section data-contract-register className="min-w-0">
      <ContractTable
        attentionByContractId={attentionByContractId}
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
        onPreview={onPreview}
        onRetry={onRetry}
        pagination={pagination}
        setExpandedId={setExpandedId}
        visibleColumnKeys={visibleColumnKeys}
      />
    </section>
  );
}
