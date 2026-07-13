import { useCrudFormState } from '@/hooks/use-crud-form-state';
import { useState } from 'react';
import { LandsView } from './components/lands-view';
import { useArchiveLand, useLands, useSaveLand } from './use-lands';
import type { LandFilters, LandFormValues, LandRecord } from './types';

const emptyForm: LandFormValues = { plot_no: '', name: '', location: '', area: '', owner_id: '', purchase_price: '', owner_price: '', commission: '', category: 'residential', status: 'available', notes: '' };

function formFromLand(land: LandRecord): LandFormValues {
  return {
    plot_no: land.plot_no ?? '',
    name: land.name ?? '',
    location: land.location ?? '',
    area: land.area?.toString() ?? '',
    owner_id: land.owner_id ?? '',
    purchase_price: land.purchase_price?.toString() ?? '',
    owner_price: land.owner_price?.toString() ?? '',
    commission: land.commission?.toString() ?? '',
    category: land.category ?? 'residential',
    status: land.status ?? 'available',
    notes: land.notes ?? '',
  };
}

export function LandsPage() {
  const [filters, setFilters] = useState<LandFilters>({ query: '', status: 'all' });
  const formState = useCrudFormState<LandRecord, LandFormValues>({ emptyDraft: emptyForm, draftFromRecord: formFromLand });
  const landsQuery = useLands(filters);
  const saveLand = useSaveLand();
  const archiveLand = useArchiveLand();

  return (
    <LandsView
      rows={landsQuery.data ?? []}
      filters={filters}
      draft={formState.draft}
      editingLand={formState.editingRecord}
      formOpen={formState.formOpen}
      isLoading={landsQuery.isLoading}
      isSaving={saveLand.isPending}
      isArchiving={archiveLand.isPending}
      error={landsQuery.error}
      writeError={saveLand.error ?? archiveLand.error}
      onFiltersChange={setFilters}
      onDraftChange={formState.setDraft}
      onCreate={formState.openCreate}
      onEdit={formState.openEdit}
      onFormOpenChange={formState.setFormOpen}
      onSubmit={(values) => saveLand.mutate({ id: formState.editingRecord?.id, values }, { onSuccess: formState.closeForm })}
      onArchive={(id) => archiveLand.mutate(id)}
      onRetry={() => void landsQuery.refetch()}
    />
  );
}
