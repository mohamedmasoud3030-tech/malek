import { ContractTable } from './ContractTable';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractListItem } from '../services/contractService';
import type { ContractAttention } from '../contract-attention';

export function ContractResults({
  attentionByContractId,
  companySettings,
  contracts,
  emptyDescription,
  emptyTitle,
  error,
  isError,
  isLoading,
  onCreate,
  onDelete,
  onEdit,
  onOpenFull,
  onPreview,
  onRetry,
  pagination,
  visibleColumnKeys,
}: {
  /** Operational attention per contract (see `useContractAttention`). */
  attentionByContractId?: ReadonlyMap<string, ContractAttention>;
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  emptyDescription: string;
  emptyTitle: string;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  /** Navigates directly to the canonical contract page. */
  onOpenFull: (id: string) => void;
  onPreview: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  visibleColumnKeys: readonly string[];
}) {
  return (
    <section data-contract-register className="min-w-0">
      <ContractTable
        attentionByContractId={attentionByContractId}
        companySettings={companySettings}
        contracts={contracts}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        error={isError ? error : undefined}
        isLoading={isLoading}
        onCreate={onCreate}
        onDelete={onDelete}
        onEdit={onEdit}
        onOpenFull={onOpenFull}
        onPreview={onPreview}
        onRetry={onRetry}
        pagination={pagination}
        visibleColumnKeys={visibleColumnKeys}
      />
    </section>
  );
}
