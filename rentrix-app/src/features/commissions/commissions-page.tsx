import { PageLayout } from '@/components/layout/page-layout';
import { useCrudFormState } from '@/hooks/use-crud-form-state';
import { useState } from 'react';
import { CommissionsView } from './components/commissions-view';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from './types';
import { useArchiveCommission, useCommissionApproval, useCommissions, usePayCommissionAtomic, useReverseCommissionAtomic, useSaveCommission } from './use-commissions';

const emptyForm: CommissionFormValues = { staff_name: '', type: 'contract', status: 'pending', source_id: '', deal_value: '', percentage: '2.5', amount: '' };

function formFromCommission(commission: CommissionRecord): CommissionFormValues {
  return {
    staff_name: commission.staff_name ?? '',
    type: commission.type ?? 'contract',
    status: commission.status ?? 'pending',
    source_id: commission.source_id ?? '',
    deal_value: commission.deal_value?.toString() ?? '',
    percentage: commission.percentage?.toString() ?? '2.5',
    amount: commission.amount?.toString() ?? '',
  };
}

export type CommissionsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout wrapper.
   * standalone (default): reached via /commissions, so it owns the shell.
   *
   * CommissionsView renders its own section heading and actions, so unlike the
   * other finance workspaces this page never owned a PageHeader; embedding
   * therefore only removes the PageLayout wrapper.
   */
  embedded?: boolean;
}>;

/**
 * Owns the commissions workspace body. Shared verbatim between the standalone
 * /commissions route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function CommissionsWorkspace({ embedded = false }: CommissionsWorkspaceProps) {
  const [filters, setFilters] = useState<CommissionFilters>({ query: '', status: 'all', type: 'all' });
  const formState = useCrudFormState<CommissionRecord, CommissionFormValues>({ emptyDraft: emptyForm, draftFromRecord: formFromCommission });
  const commissionsQuery = useCommissions(filters);
  const saveCommission = useSaveCommission();
  const archiveCommission = useArchiveCommission();
  const approveCommission = useCommissionApproval();
  const payCommission = usePayCommissionAtomic();
  const reverseCommission = useReverseCommissionAtomic();

  const workspaceContent = (
    <CommissionsView
      rows={commissionsQuery.data ?? []}
      filters={filters}
      draft={formState.draft}
      editingCommission={formState.editingRecord}
      formOpen={formState.formOpen}
      isLoading={commissionsQuery.isLoading}
      isSaving={saveCommission.isPending}
      isArchiving={archiveCommission.isPending}
      error={commissionsQuery.error}
      writeError={saveCommission.error ?? archiveCommission.error}
      onFiltersChange={setFilters}
      onDraftChange={formState.setDraft}
      onCreate={formState.openCreate}
      onEdit={formState.openEdit}
      onFormOpenChange={formState.setFormOpen}
      onSubmit={(values) => saveCommission.mutate({ id: formState.editingRecord?.id, values }, { onSuccess: formState.closeForm })}
      onArchive={(id) => archiveCommission.mutate(id)}
      onRetry={() => void commissionsQuery.refetch()}
      onApprove={(row) => approveCommission.mutate({ id: row.id, values: formFromCommission(row) })}
      onPayAtomic={(id, paymentDate, accountId) => payCommission.mutateAsync({ id, paymentDate, accountId })}
      onReverseAtomic={(id, reason) => reverseCommission.mutateAsync({ id, reason })}
    />
  );

  if (embedded) {
    return <div data-embedded-workspace className="min-w-0 space-y-5 sm:space-y-6">{workspaceContent}</div>;
  }

  return (
    <PageLayout dir="rtl" lang="ar">
      {workspaceContent}
    </PageLayout>
  );
}

export function CommissionsPage() {
  return <CommissionsWorkspace />;
}
