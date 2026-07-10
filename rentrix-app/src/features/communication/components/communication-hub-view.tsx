import { Archive, Edit, MessageSquareText, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import type { CommunicationFilters, CommunicationFormValues, CommunicationRecord } from '../types';

const channelLabels: Record<string, string> = { phone: 'هاتف', whatsapp: 'واتساب مسجل', email: 'بريد إلكتروني', meeting: 'اجتماع', note: 'ملاحظة داخلية' };
const directionLabels: Record<string, string> = { inbound: 'وارد', outbound: 'صادر', internal: 'داخلي' };
const statusLabels: Record<string, string> = { logged: 'مسجل', follow_up: 'متابعة مطلوبة', resolved: 'مغلق', archived: 'مؤرشف' };
const statusTone: Record<string, 'blue' | 'green' | 'red' | 'gray' | 'gold'> = { logged: 'blue', follow_up: 'gold', resolved: 'green', archived: 'gray' };

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

export function CommunicationHubView(props: Props) {
  const { rows, filters, draft, editingRecord, formOpen, isLoading, isSaving, isArchiving, error, writeError, onFiltersChange, onDraftChange, onCreate, onEdit, onFormOpenChange, onSubmit, onArchive, onRetry } = props;
  const [archiveCandidate, setArchiveCandidate] = useState<CommunicationRecord | null>(null);
  const followUps = rows.filter((row) => row.status === 'follow_up').length;
  const hasFilters = filters.query.trim().length > 0 || filters.channel !== 'all' || filters.status !== 'all';
  const showRows = !isLoading && !error && rows.length > 0;
  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <section className="space-y-5">
      <Card className="border-primary/10 bg-gradient-to-l from-primary/10 via-card to-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2"><MessageSquareText className="size-5" /> سجل التواصل</CardTitle><CardDescription>سجل داخلي للمكالمات والرسائل والاجتماعات. لا يرسل رسائل خارجية ولا يستدعي مزودين مدفوعين.</CardDescription></div>
          <Button onClick={onCreate}><Plus className="me-2 size-4" />إضافة تواصل</Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3"><Summary label="إجمالي السجلات" value={String(rows.length)} /><Summary label="متابعة مطلوبة" value={String(followUps)} /><Summary label="مغلقة" value={String(rows.filter((row) => row.status === 'resolved').length)} /></CardContent>
      </Card>

      <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_12rem_12rem]"><Input value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} placeholder="بحث بالاسم، الهاتف، الموضوع، المحتوى" aria-label="بحث سجل التواصل" /><Select value={filters.channel} onChange={(event) => onFiltersChange({ ...filters, channel: event.target.value })}><option value="all">كل القنوات</option>{Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></CardContent></Card>

      {error ? <ErrorCard message="تعذر تحميل سجل التواصل" onRetry={onRetry} /> : null}
      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير على سجل التواصل. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى.'} /> : null}
      {isLoading ? <PageStateCard title="جارٍ تحميل سجل التواصل..." /> : null}
      {showEmpty ? <PageStateCard title={hasFilters ? 'لا توجد سجلات تواصل ضمن الفلاتر الحالية' : 'لا توجد سجلات تواصل بعد'} description={hasFilters ? 'غيّر البحث أو القناة أو الحالة لعرض سجلات تواصل أخرى.' : 'أضف أول سجل داخلي عند حدوث اتصال أو اجتماع أو ملاحظة. لا يتم إرسال أي رسالة خارجية.'} action={hasFilters ? undefined : <Button onClick={onCreate}>إضافة سجل تواصل</Button>} /> : null}
      {showRows ? <CommunicationRows rows={rows} isArchiving={isArchiving} onEdit={onEdit} onArchiveClick={setArchiveCandidate} /> : null}

      <Dialog open={formOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingRecord ? 'تعديل سجل تواصل' : 'إضافة سجل تواصل'}</DialogTitle><DialogDescription>هذا تسجيل داخلي فقط، ولن يرسل النظام أي رسالة خارجية عند الحفظ.</DialogDescription></DialogHeader>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(draft); }}>
            <Field label="اسم جهة التواصل"><Input required value={draft.contact_name} onChange={(event) => onDraftChange({ ...draft, contact_name: event.target.value })} /></Field>
            <Field label="الهاتف"><Input value={draft.contact_phone} onChange={(event) => onDraftChange({ ...draft, contact_phone: event.target.value })} /></Field>
            <Field label="البريد الإلكتروني"><Input type="email" value={draft.contact_email} onChange={(event) => onDraftChange({ ...draft, contact_email: event.target.value })} /></Field>
            <Field label="الموضوع"><Input value={draft.subject} onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })} /></Field>
            <Field label="القناة"><Select value={draft.channel} onChange={(event) => onDraftChange({ ...draft, channel: event.target.value })}>{Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="الاتجاه"><Select value={draft.direction} onChange={(event) => onDraftChange({ ...draft, direction: event.target.value })}>{Object.entries(directionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="الحالة"><Select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="نوع الربط"><Input value={draft.related_entity_type} onChange={(event) => onDraftChange({ ...draft, related_entity_type: event.target.value })} placeholder="مستأجر، مالك، عقد، أو اتركه فارغاً" /></Field>
            <Field label="معرف الربط"><Input value={draft.related_entity_id} onChange={(event) => onDraftChange({ ...draft, related_entity_id: event.target.value })} /></Field>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">المحتوى<Textarea required value={draft.body} onChange={(event) => onDraftChange({ ...draft, body: event.target.value })} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2"><Button variant="secondary" onClick={() => onFormOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveCandidate != null}
        onOpenChange={(open) => { if (!open) setArchiveCandidate(null); }}
        title={`أرشفة سجل التواصل مع ${archiveCandidate?.contact_name ?? ''}؟`}
        description="سيتم نقل سجل التواصل إلى الأرشيف ولن يظهر في القوائم النشطة."
        confirmLabel="تأكيد الأرشفة"
        isLoading={isArchiving}
        onConfirm={() => { if (archiveCandidate) { onArchive(archiveCandidate.id); setArchiveCandidate(null); } }}
      />
    </section>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-2xl border bg-background/70 p-4"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <label className="grid gap-2 text-sm font-bold">{label}{children}</label>;
}

function ErrorCard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return <Card role="alert"><CardHeader><CardTitle>{message}</CardTitle><CardDescription>راجع الاتصال والصلاحيات ثم أعد المحاولة.</CardDescription><Button variant="secondary" onClick={onRetry}><RotateCcw className="me-2 size-4" />إعادة المحاولة</Button></CardHeader></Card>;
}

function CommunicationRows({ rows, isArchiving, onEdit, onArchiveClick }: Readonly<{ rows: CommunicationRecord[]; isArchiving: boolean; onEdit: (row: CommunicationRecord) => void; onArchiveClick: (row: CommunicationRecord) => void }>) {
  return <Card className="overflow-hidden"><div className="grid gap-3 p-4 md:hidden">{rows.map((row) => <CommunicationCard key={row.id} row={row} isArchiving={isArchiving} onEdit={onEdit} onArchiveClick={onArchiveClick} />)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3 text-right">جهة التواصل</th><th className="p-3 text-right">القناة</th><th className="p-3 text-right">الموضوع</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">إجراءات</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="max-w-56 whitespace-normal break-words p-3 font-bold">{row.contact_name}<p className="text-xs text-muted-foreground">{row.contact_phone ?? row.contact_email ?? 'بدون بيانات اتصال'}</p></td><td className="p-3">{channelLabels[row.channel] ?? row.channel}</td><td className="max-w-72 whitespace-normal break-words p-3">{row.subject ?? row.body.slice(0, 48)}</td><td className="p-3"><StatusBadge tone={statusTone[row.status] ?? 'gray'}>{statusLabels[row.status] ?? row.status}</StatusBadge></td><td className="p-3"><RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchiveClick={() => onArchiveClick(row)} /></td></tr>)}</tbody></table></div></Card>;
}

function CommunicationCard({ row, isArchiving, onEdit, onArchiveClick }: Readonly<{ row: CommunicationRecord; isArchiving: boolean; onEdit: (row: CommunicationRecord) => void; onArchiveClick: (row: CommunicationRecord) => void }>) {
  return <div className="rounded-2xl border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{row.contact_name}</p><p className="text-sm text-muted-foreground">{channelLabels[row.channel] ?? row.channel} · {directionLabels[row.direction] ?? row.direction}</p></div><StatusBadge tone={statusTone[row.status] ?? 'gray'}>{statusLabels[row.status] ?? row.status}</StatusBadge></div><p className="mt-3 line-clamp-2 text-sm">{row.subject ?? row.body}</p><RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchiveClick={() => onArchiveClick(row)} /></div>;
}

function RowActions({ id, disabled, onEdit, onArchiveClick }: Readonly<{ id: string; disabled: boolean; onEdit: () => void; onArchiveClick: () => void }>) {
  return <div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-11" variant="secondary" onClick={onEdit}><Edit className="me-2 size-4" />تعديل</Button><Button className="min-h-11" variant="danger" disabled={disabled} onClick={onArchiveClick}><Archive className="me-2 size-4" />أرشفة</Button></div>;
}
