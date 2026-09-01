import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
import { useCrudFormState } from '@/hooks/use-crud-form-state';
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
  /** Embedded finance tabs and standalone routes share one canonical shell. */
  embedded?: boolean;
}>;

/**
 * Owns commission queries/mutations while EmbeddableWorkspace owns all route
 * identity, layout, and action composition. No feature-local shell exists.
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

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="العمولات"
      workspaceName="commissions"
      dir="rtl"
      lang="ar"
      size="wide"
      visualVariant="malek-pro"
      primaryAction={(
        <Button onClick={formState.openCreate} className="min-h-11">
          <Plus className="me-2 size-4" />
          إضافة عمولة
        </Button>
      )}
    >
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
        onArchive={async (id) => {
          await archiveCommission.mutateAsync(id);
        }}
        onRetry={() => void commissionsQuery.refetch()}
        onApprove={(row) => approveCommission.mutate({ id: row.id, values: formFromCommission(row) })}
        onPayAtomic={(id, paymentDate, accountId) => payCommission.mutateAsync({ id, paymentDate, accountId })}
        onReverseAtomic={(id, reason) => reverseCommission.mutateAsync({ id, reason })}
      />
    </EmbeddableWorkspace>
  );
}

export function CommissionsPage() {
  return <CommissionsWorkspace />;
}
