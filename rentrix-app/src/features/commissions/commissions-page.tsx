import { useCrudFormState } from '@/hooks/use-crud-form-state';
import { useState } from 'react';
import { CommissionsView } from './components/commissions-view';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from './types';
import { useArchiveCommission, useCommissions, useSaveCommission } from './use-commissions';

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

export function CommissionsPage() {
  const [filters, setFilters] = useState<CommissionFilters>({ query: '', status: 'all', type: 'all' });
  const formState = useCrudFormState<CommissionRecord, CommissionFormValues>({ emptyDraft: emptyForm, draftFromRecord: formFromCommission });
  const commissionsQuery = useCommissions(filters);
  const saveCommission = useSaveCommission();
  const archiveCommission = useArchiveCommission();

  return (
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
    />
  );
}
