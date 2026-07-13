import { useCrudFormState } from '@/hooks/use-crud-form-state';
import { LeadsView } from './components/leads-view';
import type { LeadFilters, LeadFormValues, LeadRecord } from './types';
import { useArchiveLead, useLeads, useSaveLead } from './use-leads';

const emptyForm: LeadFormValues = { name: '', phone: '', email: '', source: 'walk_in', status: 'new', desired_unit_type: '', min_budget: '', max_budget: '', notes: '' };

function formFromLead(lead: LeadRecord): LeadFormValues {
  return {
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    source: lead.source ?? 'walk_in',
    status: lead.status ?? 'new',
    desired_unit_type: lead.desired_unit_type ?? '',
    min_budget: lead.min_budget?.toString() ?? '',
    max_budget: lead.max_budget?.toString() ?? '',
    notes: lead.notes ?? '',
  };
}

export function LeadsPage() {
  const [filters, setFilters] = useState<LeadFilters>({ query: '', status: 'all', source: 'all' });
  const formState = useCrudFormState<LeadRecord, LeadFormValues>({ emptyDraft: emptyForm, draftFromRecord: formFromLead });
  const leadsQuery = useLeads(filters);
  const saveLead = useSaveLead();
  const archiveLead = useArchiveLead();

  return (
    <LeadsView
      rows={leadsQuery.data ?? []}
      filters={filters}
      draft={formState.draft}
      editingLead={formState.editingRecord}
      formOpen={formState.formOpen}
      isLoading={leadsQuery.isLoading}
      isSaving={saveLead.isPending}
      isArchiving={archiveLead.isPending}
      error={leadsQuery.error}
      writeError={saveLead.error ?? archiveLead.error}
      onFiltersChange={setFilters}
      onDraftChange={formState.setDraft}
      onCreate={formState.openCreate}
      onEdit={formState.openEdit}
      onFormOpenChange={formState.setFormOpen}
      onSubmit={(values) => saveLead.mutate({ id: formState.editingRecord?.id, values }, { onSuccess: formState.closeForm })}
      onArchive={(id) => archiveLead.mutate(id)}
      onRetry={() => void leadsQuery.refetch()}
    />
  );
}
