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
  onPreview,
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
  onPreview: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
}) {
  return (
    <section data-contract-register className="min-w-0 space-y-2.5">
      <header className="flex min-h-11 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">سجل العقود</h2>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {formatCount(contracts.length)} عقد ضمن النتائج الحالية
            </p>
          </div>
        </div>
      </header>

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
        onPreview={onPreview}
        onRetry={onRetry}
        pagination={pagination}
        setExpandedId={setExpandedId}
      />
    </section>
  );
}
