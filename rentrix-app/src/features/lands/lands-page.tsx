import { useCrudFormState } from '@/hooks/use-crud-form-state';
import { useState } from 'react';
import { LandsView } from './components/lands-view';
import { useArchiveLand, useLands, useSaveLand } from './use-lands';
import { landFormSchema, type LandFormValues } from './land-schema';
import type { LandFilters, LandRecord } from './types';

const emptyForm: LandFormValues = {
  plot_no: '',
  name: '',
  location: '',
  area: '',
  owner_id: '',
  purchase_price: '',
  owner_price: '',
  commission: '',
  category: 'residential',
  status: 'available',
  notes: '',
};

function formFromLand(land: LandRecord): LandFormValues {
  return {
    plot_no: land.plot_no ?? '',
    name: land.name ?? '',
    location: land.location ?? '',
    area: land.area == null ? '' : String(land.area),
    owner_id: land.owner_id ?? '',
    purchase_price: land.purchase_price == null ? '' : String(land.purchase_price),
    owner_price: land.owner_price == null ? '' : String(land.owner_price),
    commission: land.commission == null ? '' : String(land.commission),
    category: (land.category as LandFormValues['category']) ?? 'residential',
    status: (land.status as LandFormValues['status']) ?? 'available',
    notes: land.notes ?? '',
  };
}

export type LandsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function LandsWorkspace({ embedded = false }: LandsWorkspaceProps) {
  const [filters, setFilters] = useState<LandFilters>({ query: '', status: 'all' });
  const [formError, setFormError] = useState<string | null>(null);
  const formState = useCrudFormState<LandRecord, LandFormValues>({ emptyDraft: emptyForm, draftFromRecord: formFromLand });
  const landsQuery = useLands(filters);
  const saveLand = useSaveLand();
  const archiveLand = useArchiveLand();

  const handleSubmit = (values: LandFormValues) => {
    setFormError(null);
    // Re-validate at the page boundary: schema already runs in the
    // service layer, but we surface a clear message here so the user
    // gets feedback without waiting for a network round-trip.
    const result = landFormSchema.safeParse(values);
    if (!result.success) {
      const firstMessage = result.error.issues[0]?.message;
      setFormError(firstMessage ?? 'تعذر حفظ الأرض، تحقق من الحقول ثم أعد المحاولة.');
      return;
    }
    saveLand.mutate(
      { id: formState.editingRecord?.id, values: result.data },
      { onSuccess: formState.closeForm },
    );
  };

  return (
    <LandsView
      embedded={embedded}
      rows={landsQuery.data ?? []}
      filters={filters}
      draft={formState.draft}
      editingLand={formState.editingRecord}
      formOpen={formState.formOpen}
      isLoading={landsQuery.isLoading}
      isSaving={saveLand.isPending}
      isArchiving={archiveLand.isPending}
      error={landsQuery.error}
      writeError={formError ?? (saveLand.error ?? archiveLand.error)}
      onFiltersChange={setFilters}
      onDraftChange={formState.setDraft}
      onCreate={formState.openCreate}
      onEdit={formState.openEdit}
      onFormOpenChange={(open) => { setFormError(null); formState.setFormOpen(open); }}
      onSubmit={handleSubmit}
      onArchive={async (id) => {
        await archiveLand.mutateAsync(id);
      }}
      onRetry={() => void landsQuery.refetch()}
    />
  );
}


export function LandsPage() {
  return <LandsWorkspace />;
}
