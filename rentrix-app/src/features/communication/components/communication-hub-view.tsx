import { communicationChannelLabels, communicationDirectionLabels, communicationStatusLabels, communicationStatusTone } from "../labels";
import { Archive, CheckCircle2, Edit, Rows3, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { AsyncContentState } from '@/components/async-content-state';
import { WriteErrorCard } from '@/components/page-state-card';
import type { CommunicationFilters, CommunicationFormValues, CommunicationRecord } from '../types';


type Props = Readonly<{
  rows: CommunicationRecord[];
  filters: CommunicationFilters;
  draft: CommunicationFormValues;
  editingRecord: CommunicationRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: CommunicationFilters) => void;
  onDraftChange: (draft: CommunicationFormValues) => void;
  onCreate: () => void;
  onEdit: (record: CommunicationRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: CommunicationFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}>;

export function CommunicationHubView({
  rows,
  filters,
  draft,
  editingRecord,
  formOpen,
  isLoading,
  isSaving,
  isArchiving,
  error,
  writeError,
  onFiltersChange,
  onDraftChange,
  onCreate,
  onEdit,
  onFormOpenChange,
  onSubmit,
  onArchive,
  onRetry,
}: Props) {
  const [archiveCandidate, setArchiveCandidate] = useState<CommunicationRecord | null>(null);
  const followUps = rows.filter((row) => row.status === 'follow_up').length;
  const resolved = rows.filter((row) => row.status === 'resolved').length;
  const archived = rows.filter((row) => row.status === 'archived').length;
  const hasFilters = filters.query.trim().length > 0 || filters.channel !== 'all' || filters.status !== 'all';

  const activeFilters: ActiveFilterItem[] = [
    ...(filters.query.trim() ? [{ key: 'query', label: 'بحث', value: filters.query.trim(), onRemove: () => onFiltersChange({ ...filters, query: '' }) }] : []),
    ...(filters.channel !== 'all' ? [{ key: 'channel', label: 'القناة', value: communicationChannelLabels[filters.channel] ?? filters.channel, onRemove: () => onFiltersChange({ ...filters, channel: 'all' }) }] : []),
    ...(filters.status !== 'all' ? [{ key: 'status', label: 'الحالة', value: communicationStatusLabels[filters.status] ?? filters.status, onRemove: () => onFiltersChange({ ...filters, status: 'all' }) }] : []),
  ];
  const clearFilters = () => onFiltersChange({ query: '', channel: 'all', status: 'all' });

  const rowActions = (row: CommunicationRecord) => (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button variant="secondary" onClick={() => onEdit(row)}><Edit className="size-4" />تعديل</Button>
      {row.status !== 'archived' ? (
        <Button variant="danger" disabled={isArchiving} onClick={() => setArchiveCandidate(row)}><Archive className="size-4" />أرشفة</Button>
      ) : null}
    </div>
  );

  const columns: ColumnDef<CommunicationRecord>[] = [
    {
      key: 'contact', priority: 'identity' as const,
      header: 'جهة التواصل',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-bold">{row.contact_name}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">{row.contact_phone || row.contact_email || '—'}</p>
        </div>
      ),
    },
    { key: 'channel', priority: 'secondary' as const, header: 'القناة', render: (row) => communicationChannelLabels[row.channel] ?? row.channel },
    { key: 'direction', priority: 'detail' as const, header: 'الاتجاه', render: (row) => communicationDirectionLabels[row.direction] ?? row.direction },
    {
      key: 'subject', priority: 'secondary' as const,
      header: 'الموضوع',
      render: (row) => (
        <div className="max-w-72">
          <p className="truncate font-semibold">{row.subject || 'بدون موضوع'}</p>
          <p className="truncate text-xs text-muted-foreground">{row.body}</p>
        </div>
      ),
    },
    { key: 'status', priority: 'primary' as const, header: 'الحالة', render: (row) => <StatusBadge tone={communicationStatusTone[row.status] ?? 'neutral'}>{communicationStatusLabels[row.status] ?? row.status}</StatusBadge> },
    { key: 'actions', priority: 'actions' as const, header: 'إجراءات', render: rowActions },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-bold tracking-tight">سجل التواصل</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">المكالمات والرسائل والاجتماعات والمتابعات في سجل واحد؛ الربط التقني بالكيانات لا يُطلب من المستخدم يدوياً.</p>
      </div>

      <ResponsiveCardGrid>
        <KpiCard label="إجمالي السجلات" value={rows.length} icon={Rows3} accent="primary" compact />
        <KpiCard label="متابعة مطلوبة" value={followUps} icon={UserRoundSearch} accent="amber" compact />
        <KpiCard label="مغلقة" value={resolved} icon={CheckCircle2} accent="emerald" compact />
        <KpiCard label="مؤرشفة" value={archived} icon={Archive} accent="sky" compact />
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={filters.query}
        onSearchChange={(query) => onFiltersChange({ ...filters, query })}
        searchPlaceholder="بحث بالاسم، الهاتف، الموضوع، المحتوى"
        searchAriaLabel="بحث سجل التواصل"
        filters={(
          <>
            <Select value={filters.channel} onChange={(event) => onFiltersChange({ ...filters, channel: event.target.value })} aria-label="قناة التواصل" className="w-full sm:w-48">
              <option value="all">كل القنوات</option>
              {Object.entries(communicationChannelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })} aria-label="حالة التواصل" className="w-full sm:w-48">
              <option value="all">كل الحالات</option>
              {Object.entries(communicationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </>
        )}
      />
      <ActiveFilterBar filters={activeFilters} onClearAll={clearFilters} />

      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير على سجل التواصل.'} /> : null}

      <AsyncContentState
        status={isLoading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
        error={error}
        errorTitle="تعذر تحميل سجل التواصل"
        errorFallbackMessage="راجع الاتصال والصلاحيات ثم أعد المحاولة."
        errorAction={<Button variant="secondary" onClick={onRetry}>إعادة المحاولة</Button>}
        emptyTitle={hasFilters ? 'لا توجد سجلات تواصل ضمن الفلاتر الحالية' : 'لا توجد سجلات تواصل بعد'}
        emptyDescription={hasFilters ? 'غيّر البحث أو القناة أو الحالة أو امسح الفلاتر.' : 'أضف أول سجل عند حدوث اتصال أو اجتماع أو ملاحظة تشغيلية.'}
        emptyAction={hasFilters ? <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button> : <Button onClick={onCreate}>إضافة سجل تواصل</Button>}
      >
        <EntityTable
          aria-label="جدول سجل التواصل"
          rows={rows}
          columns={columns}
          keyOf={(row) => row.id}
        />
      </AsyncContentState>

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={(open) => { if (!isSaving) onFormOpenChange(open); }}
        title={editingRecord ? 'تعديل سجل تواصل' : 'إضافة سجل تواصل'}
        description="هذا تسجيل تشغيلي فقط؛ لن يرسل النظام رسالة خارجية عند الحفظ."
        className="max-w-2xl"
        visualVariant="operational"
      >
        <EntityForm.Root
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.contact_name.trim() || !draft.body.trim()) return;
            onSubmit(draft);
          }}
        >
          <EntityForm.Section title="جهة التواصل">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="اسم جهة التواصل *"><Input required value={draft.contact_name} onChange={(event) => onDraftChange({ ...draft, contact_name: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="الهاتف"><Input dir="ltr" value={draft.contact_phone ?? ''} onChange={(event) => onDraftChange({ ...draft, contact_phone: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="البريد الإلكتروني"><Input type="email" dir="ltr" value={draft.contact_email ?? ''} onChange={(event) => onDraftChange({ ...draft, contact_email: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="الموضوع"><Input value={draft.subject ?? ''} onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })} /></EntityForm.Field>
            </div>
          </EntityForm.Section>

          <EntityForm.Section title="تفاصيل التواصل">
            <div className="grid gap-4 sm:grid-cols-3">
              <EntityForm.Field label="القناة *"><Select required value={draft.channel} onChange={(event) => onDraftChange({ ...draft, channel: event.target.value as CommunicationFormValues['channel'] })}>{Object.entries(communicationChannelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="الاتجاه *"><Select required value={draft.direction} onChange={(event) => onDraftChange({ ...draft, direction: event.target.value as CommunicationFormValues['direction'] })}>{Object.entries(communicationDirectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="الحالة *"><Select required value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value as CommunicationFormValues['status'] })}>{Object.entries(communicationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
            </div>
            <EntityForm.Field label="المحتوى *"><Textarea required className="min-h-28" value={draft.body} onChange={(event) => onDraftChange({ ...draft, body: event.target.value })} /></EntityForm.Field>
            {editingRecord?.related_entity_id ? (
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium text-muted-foreground">هذا السجل مرتبط بكيان موجود. تم الحفاظ على الربط كما هو بدون عرض UUID أو طلب معرف تقني منك.</p>
            ) : null}
          </EntityForm.Section>

          <EntityForm.Actions submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'} onCancel={() => onFormOpenChange(false)} isSubmitting={isSaving} submitDisabled={!draft.contact_name.trim() || !draft.body.trim()} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={Boolean(archiveCandidate)}
        onOpenChange={(open) => { if (!open && !isArchiving) setArchiveCandidate(null); }}
        title={`أرشفة سجل التواصل مع ${archiveCandidate?.contact_name ?? ''}؟`}
        description={archiveCandidate ? `سيُخفى السجل من القوائم النشطة مع الاحتفاظ بتاريخ التواصل وعلاقاته` : undefined}
        confirmLabel="تأكيد الأرشفة"
        variant="danger"
        isLoading={isArchiving}
        onConfirm={async () => {
          if (!archiveCandidate || isArchiving) return;
          try {
            await onArchive(archiveCandidate.id);
            setArchiveCandidate(null);
          } catch {
            // Keep context open after failure.
          }
        }}
      />
    </section>
  );
}
