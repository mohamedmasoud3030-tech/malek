import { Archive, BadgeDollarSign, CheckCircle2, Clock3, Edit, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable } from '@/components/ui/entity-table';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { PageHeader } from '@/components/layout/page-header';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/hooks/useCompanyFormatters';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from '../types';

const statusLabels: Record<string, string> = { pending: 'قيد المراجعة', approved: 'معتمدة للتتبع', paid: 'مسجلة كمدفوعة', cancelled: 'ملغاة' };
const typeLabels: Record<string, string> = { contract: 'عقد', payment: 'تحصيل', owner: 'مالك', lead: 'عميل محتمل', land: 'أرض' };
const statusTone: Record<string, 'blue' | 'green' | 'red' | 'gray' | 'gold'> = { pending: 'gold', approved: 'blue', paid: 'green', cancelled: 'red' };

function money(value: number | null) {
  if (value == null) return '—';
  return formatMoney(value);
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
  const [archiveCandidate, setArchiveCandidate] = useState<CommissionRecord | null>(null);
  const pendingTotal = rows.filter((row) => row.status !== 'paid' && row.status !== 'cancelled').reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const paidTotal = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const approvedCount = rows.filter((row) => row.status === 'approved').length;
  const hasFilters = filters.query.trim().length > 0 || filters.status !== 'all' || filters.type !== 'all';

  return (
    <section className="space-y-5">
      <PageHeader
        title="العمولات"
        description="تتبع تشغيلي لعمولات المكتب والوسطاء حسب الحالة والمصدر، ولا يعتمد صرفاً أو مطابقة مالية."
        action={<Button onClick={onCreate}><Plus className="me-2 size-4" />إضافة عمولة</Button>}
      />
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي السجلات" value={rows.length} icon={BadgeDollarSign} accent="primary" />
        <KpiCard label="قيد المراجعة/التتبع" value={money(pendingTotal)} icon={Clock3} accent="amber" />
        <KpiCard label="معتمدة للتتبع" value={approvedCount} icon={CheckCircle2} accent="sky" />
        <KpiCard label="مسجلة كمدفوعة" value={money(paidTotal)} icon={BadgeDollarSign} accent="emerald" />
      </ResponsiveCardGrid>

      <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_12rem_12rem]"><Input value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} placeholder="بحث بالموظف، المصدر، النوع" aria-label="بحث العمولات" /><Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select value={filters.type} onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })}><option value="all">كل الأنواع</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></CardContent></Card>

      {error ? <ErrorCard message="تعذر تحميل العمولات" onRetry={onRetry} /> : null}
      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير على العمولة. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى.'} /> : null}
      {isLoading ? <PageStateCard title="جارٍ تحميل العمولات..." /> : null}
      {!isLoading && !error && rows.length === 0 ? <PageStateCard title={hasFilters ? 'لا توجد عمولات ضمن الفلاتر الحالية' : 'لا توجد عمولات بعد'} description={hasFilters ? 'غيّر البحث أو الحالة أو النوع لعرض سجلات عمولات أخرى.' : 'أضف عمولة تشغيلية عند توفر مصدر ومبلغ حقيقيين. هذه الصفحة للتتبع فقط ولا تنشئ أمر صرف.'} action={hasFilters ? undefined : <Button onClick={onCreate}>إضافة عمولة</Button>} /> : null}
      {rows.length > 0 ? <CommissionRows rows={rows} isArchiving={isArchiving} onEdit={onEdit} onArchiveClick={setArchiveCandidate} /> : null}

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={onFormOpenChange}
        title={editingCommission ? 'تعديل عمولة' : 'إضافة عمولة'}
        description="يمكن إدخال مبلغ مباشر أو تركه ليُحسب من قيمة الصفقة ونسبة العمولة للتتبع التشغيلي فقط."
        className="max-w-2xl"
      >
        <EntityForm.Root
          className="md:grid-cols-2"
          onSubmit={(event) => { event.preventDefault(); onSubmit(draft); }}
        >
          <Field label="اسم الموظف / الوسيط"><Input required value={draft.staff_name} onChange={(event) => onDraftChange({ ...draft, staff_name: event.target.value })} /></Field>
          <Field label="نوع المصدر"><Select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="الحالة"><Select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="معرف المصدر"><Input value={draft.source_id} onChange={(event) => onDraftChange({ ...draft, source_id: event.target.value })} /></Field>
          <Field label="قيمة الصفقة"><Input type="number" min="0" inputMode="decimal" value={draft.deal_value} onChange={(event) => onDraftChange({ ...draft, deal_value: event.target.value })} /></Field>
          <Field label="النسبة %"><Input type="number" min="0" inputMode="decimal" step="0.01" value={draft.percentage} onChange={(event) => onDraftChange({ ...draft, percentage: event.target.value })} /></Field>
          <Field label="مبلغ مباشر"><Input type="number" min="0" inputMode="decimal" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} /></Field>
          <EntityForm.Actions className="md:col-span-2" onCancel={() => onFormOpenChange(false)} isSubmitting={isSaving} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={archiveCandidate != null}
        onOpenChange={(open) => { if (!open) setArchiveCandidate(null); }}
        title={`إلغاء العمولة لـ ${archiveCandidate?.staff_name ?? ''}؟`}
        description="سيتم إلغاء العمولة ولن تُحتسب ضمن المبالغ النشطة."
        confirmLabel="تأكيد الإلغاء"
        isLoading={isArchiving}
        onConfirm={() => { if (archiveCandidate) { onArchive(archiveCandidate.id); setArchiveCandidate(null); } }}
      />
    </section>
  );
}


function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <label className="grid gap-2 text-sm font-bold">{label}{children}</label>;
}

function ErrorCard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return <Card role="alert"><CardHeader><CardTitle>{message}</CardTitle><CardDescription>راجع الاتصال والصلاحيات ثم أعد المحاولة.</CardDescription><Button variant="secondary" onClick={onRetry}><RotateCcw className="me-2 size-4" />إعادة المحاولة</Button></CardHeader></Card>;
}

function CommissionRows({ rows, isArchiving, onEdit, onArchiveClick }: Readonly<{ rows: CommissionRecord[]; isArchiving: boolean; onEdit: (row: CommissionRecord) => void; onArchiveClick: (row: CommissionRecord) => void }>) {
  return (
    <EntityTable
      aria-label="جدول العمولات"
      rows={rows}
      keyOf={(row) => row.id}
      columns={[
        { key: 'staff_name', header: 'المستفيد', render: (row) => (
          <span className="max-w-56 whitespace-normal break-words">
            <span className="font-bold">{row.staff_name ?? '—'}</span>
            <p className="text-xs text-muted-foreground">{row.source_id ?? 'بدون مصدر'}</p>
          </span>
        ) },
        { key: 'type', header: 'النوع', render: (row) => typeLabels[row.type ?? ''] ?? row.type ?? '—' },
        { key: 'amount', header: 'المبلغ', render: (row) => money(row.amount) },
        { key: 'status', header: 'الحالة', render: (row) => (
          <StatusBadge tone={statusTone[row.status ?? ''] ?? 'gray'}>{statusLabels[row.status ?? ''] ?? row.status ?? '—'}</StatusBadge>
        ) },
        { key: 'actions', header: 'إجراءات', render: (row) => (
          <RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchiveClick={() => onArchiveClick(row)} />
        ) },
      ]}
      renderMobileCard={(row) => (
        <div className="rounded-2xl border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">{row.staff_name ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{typeLabels[row.type ?? ''] ?? row.type ?? '—'}</p>
            </div>
            <StatusBadge tone={statusTone[row.status ?? ''] ?? 'gray'}>{statusLabels[row.status ?? ''] ?? row.status ?? '—'}</StatusBadge>
          </div>
          <p className="mt-3 text-sm">المبلغ: {money(row.amount)}</p>
          <RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchiveClick={() => onArchiveClick(row)} />
        </div>
      )}
    />
  );
}

function RowActions({ id, disabled, onEdit, onArchiveClick }: Readonly<{ id: string; disabled: boolean; onEdit: () => void; onArchiveClick: () => void }>) {
  return <div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-11" variant="secondary" onClick={onEdit}><Edit className="me-2 size-4" />تعديل</Button><Button className="min-h-11" variant="danger" disabled={disabled} onClick={onArchiveClick}><Archive className="me-2 size-4" />إلغاء</Button></div>;
}
