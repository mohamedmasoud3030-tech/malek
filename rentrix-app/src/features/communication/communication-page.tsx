import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { CommunicationHubView } from './components/communication-hub-view';
import { CommunicationOutboundPanel } from './components/communication-outbound-panel';
import type { CommunicationFilters, CommunicationFormValues, CommunicationRecord } from './types';
import { useArchiveCommunicationRecord, useCommunicationRecords, useSaveCommunicationRecord } from './use-communication';

const emptyForm: CommunicationFormValues = { contact_name: '', contact_phone: '', contact_email: '', channel: 'phone', direction: 'outbound', status: 'logged', subject: '', body: '', related_entity_type: '', related_entity_id: '' };

function formFromRecord(record: CommunicationRecord): CommunicationFormValues {
  return {
    contact_name: record.contact_name,
    contact_phone: record.contact_phone ?? '',
    contact_email: record.contact_email ?? '',
    channel: record.channel,
    direction: record.direction,
    status: record.status,
    subject: record.subject ?? '',
    body: record.body,
    related_entity_type: record.related_entity_type ?? '',
    related_entity_id: record.related_entity_id ?? '',
  };
}

export function CommunicationPage() {
  const [filters, setFilters] = useState<CommunicationFilters>({ query: '', channel: 'all', status: 'all' });
  const [editingRecord, setEditingRecord] = useState<CommunicationRecord | null>(null);
  const [draft, setDraft] = useState<CommunicationFormValues>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const recordsQuery = useCommunicationRecords(filters);
  const saveRecord = useSaveCommunicationRecord();
  const archiveRecord = useArchiveCommunicationRecord();

  const openCreate = () => {
    setEditingRecord(null);
    setDraft(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (record: CommunicationRecord) => {
    setEditingRecord(record);
    setDraft(formFromRecord(record));
    setFormOpen(true);
  };

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="مركز التواصل"
        description="سجل تشغيلي للتواصل مع الأطراف، مع واجهة قوالب وواتساب وبريد قابلة للتوسعة دون ربط مزود خارجي داخل الواجهة."
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="me-2 size-4" />
            إضافة تواصل
          </Button>
        }
      />
      <CommunicationOutboundPanel />
      <CommunicationHubView
        rows={recordsQuery.data ?? []}
        filters={filters}
        draft={draft}
        editingRecord={editingRecord}
        formOpen={formOpen}
        isLoading={recordsQuery.isLoading}
        isSaving={saveRecord.isPending}
        isArchiving={archiveRecord.isPending}
        error={recordsQuery.error}
        writeError={saveRecord.error ?? archiveRecord.error}
        onFiltersChange={setFilters}
        onDraftChange={setDraft}
        onCreate={openCreate}
        onEdit={openEdit}
        onFormOpenChange={setFormOpen}
        onSubmit={(values) => saveRecord.mutate({ id: editingRecord?.id, values }, { onSuccess: () => setFormOpen(false) })}
        onArchive={(id) => archiveRecord.mutate(id)}
        onRetry={() => void recordsQuery.refetch()}
      />
    </PageLayout>
  );
}
