import { Archive, BadgeDollarSign, Edit, Plus, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineStatCard } from '@/components/ui/inline-stat-card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from '../types';

const statusLabels: Record<string, string> = { pending: 'قيد المراجعة', approved: 'معتمدة للتتبع', paid: 'مسجلة كمدفوعة', cancelled: 'ملغاة' };
const typeLabels: Record<string, string> = { contract: 'عقد', payment: 'تحصيل', owner: 'مالك', lead: 'عميل محتمل', land: 'أرض' };
const statusTone: Record<string, 'blue' | 'green' | 'red' | 'gray' | 'gold'> = { pending: 'gold', approved: 'blue', paid: 'green', cancelled: 'red' };

function money(value: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('ar-OM', { style: 'currency', currency: 'OMR', maximumFractionDigits: 3 }).format(value);
}

type Props = Readonly<{
  rows: CommissionRecord[];
  filters: CommissionFilters;
  draft: CommissionFormValues;
  editingCommission: CommissionRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: CommissionFilters) => void;
  onDraftChange: (draft: CommissionFormValues) => void;
  onCreate: () => void;
  onEdit: (commission: CommissionRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: CommissionFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}>;

export function CommissionsView(props: Props) {
  const { rows, filters, draft, editingCommission, formOpen, isLoading, isSaving, isArchiving, error, writeError, onFiltersChange, onDraftChange, onCreate, onEdit, onFormOpenChange, onSubmit, onArchive, onRetry } = props;
  const pendingTotal = rows.filter((row) => row.status !== 'paid' && row.status !== 'cancelled').reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const paidTotal = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const hasFilters = filters.query.trim().length > 0 || filters.status !== 'all' || filters.type !== 'all';

  return (
    <section className="space-y-5">
      <PageHeader
        title="العمولات"
        description="تتبع تشغيلي لعمولات المكتب والوسطاء حسب الحالة والمصدر، ولا يعتمد صرفاً أو مطابقة مالية."
        action={<Button onClick={onCreate}><Plus className="me-2 size-4" />إضافة عمولة</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <InlineStatCard label="إجمالي السجلات" value={String(rows.length)} />
        <InlineStatCard label="قيد المراجعة/التتبع" value={money(pendingTotal)} />
        <InlineStatCard label="مسجلة كمدفوعة" value={money(paidTotal)} />
      </div>

      <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_12rem_12rem]"><Input value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} placeholder="بحث بالموظف، المصدر، النوع" aria-label="بحث العمولات" /><Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select value={filters.type} onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })}><option value="all">كل الأنواع</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></CardContent></Card>

      {error ? <ErrorCard message="تعذر تحميل العمولات" onRetry={onRetry} /> : null}
      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير على العمولة. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى.'} /> : null}
      {isLoading ? <PageStateCard title="جارٍ تحميل العمولات..." /> : null}
      {!isLoading && !error && rows.length === 0 ? <PageStateCard title={hasFilters ? 'لا توجد عمولات ضمن الفلاتر الحالية' : 'لا توجد عمولات بعد'} description={hasFilters ? 'غيّر البحث أو الحالة أو النوع لعرض سجلات عمولات أخرى.' : 'أضف عمولة تشغيلية عند توفر مصدر ومبلغ حقيقيين. هذه الصفحة للتتبع فقط ولا تنشئ أمر صرف.'} action={hasFilters ? undefined : <Button onClick={onCreate}>إضافة عمولة</Button>} /> : null}
      {rows.length > 0 ? <CommissionRows rows={rows} isArchiving={isArchiving} onEdit={onEdit} onArchive={onArchive} /> : null}

      <Dialog open={formOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingCommission ? 'تعديل عمولة' : 'إضافة عمولة'}</DialogTitle><DialogDescription>يمكن إدخال مبلغ مباشر أو تركه ليُحسب من قيمة الصفقة ونسبة العمولة للتتبع التشغيلي فقط.</DialogDescription></DialogHeader>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(draft); }}>
            <Field label="اسم الموظف / الوسيط"><Input required value={draft.staff_name} onChange={(event) => onDraftChange({ ...draft, staff_name: event.target.value })} /></Field>
            <Field label="نوع المصدر"><Select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="الحالة"><Select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="معرف المصدر"><Input value={draft.source_id} onChange={(event) => onDraftChange({ ...draft, source_id: event.target.value })} /></Field>
            <Field label="قيمة الصفقة"><Input type="number" min="0" value={draft.deal_value} onChange={(event) => onDraftChange({ ...draft, deal_value: event.target.value })} /></Field>
            <Field label="النسبة %"><Input type="number" min="0" step="0.01" value={draft.percentage} onChange={(event) => onDraftChange({ ...draft, percentage: event.target.value })} /></Field>
            <Field label="مبلغ مباشر"><Input type="number" min="0" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} /></Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-end sm:justify-end md:col-span-2"><Button variant="secondary" onClick={() => onFormOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}


function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <label className="grid gap-2 text-sm font-bold">{label}{children}</label>;
}

function ErrorCard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return <Card role="alert"><CardHeader><CardTitle>{message}</CardTitle><CardDescription>راجع الاتصال والصلاحيات ثم أعد المحاولة.</CardDescription><Button variant="secondary" onClick={onRetry}><RotateCcw className="me-2 size-4" />إعادة المحاولة</Button></CardHeader></Card>;
}

function CommissionRows({ rows, isArchiving, onEdit, onArchive }: Readonly<{ rows: CommissionRecord[]; isArchiving: boolean; onEdit: (row: CommissionRecord) => void; onArchive: (id: string) => void }>) {
  return <Card className="overflow-hidden"><div className="grid gap-3 p-4 md:hidden">{rows.map((row) => <CommissionCard key={row.id} row={row} isArchiving={isArchiving} onEdit={onEdit} onArchive={onArchive} />)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3 text-right">المستفيد</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">المبلغ</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">إجراءات</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="max-w-56 whitespace-normal break-words p-3 font-bold">{row.staff_name ?? '—'}<p className="text-xs text-muted-foreground">{row.source_id ?? 'بدون مصدر'}</p></td><td className="p-3">{typeLabels[row.type ?? ''] ?? row.type ?? '—'}</td><td className="p-3">{money(row.amount)}</td><td className="p-3"><StatusBadge tone={statusTone[row.status ?? ''] ?? 'gray'}>{statusLabels[row.status ?? ''] ?? row.status ?? '—'}</StatusBadge></td><td className="p-3"><RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchive={onArchive} /></td></tr>)}</tbody></table></div></Card>;
}

function CommissionCard({ row, isArchiving, onEdit, onArchive }: Readonly<{ row: CommissionRecord; isArchiving: boolean; onEdit: (row: CommissionRecord) => void; onArchive: (id: string) => void }>) {
  return <div className="rounded-2xl border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{row.staff_name ?? '—'}</p><p className="text-sm text-muted-foreground">{typeLabels[row.type ?? ''] ?? row.type ?? '—'}</p></div><StatusBadge tone={statusTone[row.status ?? ''] ?? 'gray'}>{statusLabels[row.status ?? ''] ?? row.status ?? '—'}</StatusBadge></div><p className="mt-3 text-sm">المبلغ: {money(row.amount)}</p><RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchive={onArchive} /></div>;
}

function RowActions({ id, disabled, onEdit, onArchive }: Readonly<{ id: string; disabled: boolean; onEdit: () => void; onArchive: (id: string) => void }>) {
  return <div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-11" variant="secondary" onClick={onEdit}><Edit className="me-2 size-4" />تعديل</Button><Button className="min-h-11" variant="danger" disabled={disabled} onClick={() => onArchive(id)}><Archive className="me-2 size-4" />إلغاء</Button></div>;
}
