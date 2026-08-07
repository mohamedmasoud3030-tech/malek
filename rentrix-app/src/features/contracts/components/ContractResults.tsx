import { FileText } from 'lucide-react';
import { ContractTable } from './ContractTable';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractListItem } from '../services/contractService';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

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
    <section
      data-contract-register
      className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
    >
      <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
              <FileText className="size-4.5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-black">سجل العقود</h2>
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
            {formatCount(contracts.length)} عقد ضمن البحث والفلاتر الحالية.
          </p>
        </div>
      </header>

      <div className="p-3 sm:p-4">
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
      </div>
    </section>
  );
}
