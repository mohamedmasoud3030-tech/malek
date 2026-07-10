import { Archive, Edit, MapPinned, Plus, RotateCcw, Layers, TrendingUp, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { DataErrorScreen } from '@/components/data-error-screen';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { WriteErrorCard } from '@/components/page-state-card';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import type { LandFilters, LandFormValues, LandRecord } from '../types';

const statusLabels: Record<string, string> = {
  available: 'متاحة',
  reserved: 'محجوزة',
  sold: 'مباعة',
  archived: 'مؤرشفة',
};
const categoryLabels: Record<string, string> = {
  residential: 'سكني',
  commercial: 'تجاري',
  agricultural: 'زراعي',
  investment: 'استثماري',
};

function money(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value);
}

function tone(status: string | null | undefined) {
  if (status === 'available') return 'green' as const;
  if (status === 'reserved') return 'gold' as const;
  if (status === 'sold') return 'blue' as const;
  return 'gray' as const;
}

type Props = Readonly<{
  rows: LandRecord[];
  filters: LandFilters;
  draft: LandFormValues;
  editingLand: LandRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: LandFilters) => void;
  onDraftChange: (draft: LandFormValues) => void;
  onCreate: () => void;
  onEdit: (land: LandRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: LandFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}>;

export function LandsView(props: Props) {
  const {
    rows, filters, draft, editingLand, formOpen,
    isLoading, isSaving, isArchiving, error, writeError,
    onFiltersChange, onDraftChange, onCreate, onEdit,
    onFormOpenChange, onSubmit, onArchive, onRetry,
  } = props;

  const activeRows = rows.filter((r) => r.status !== 'archived').length;
  const availableRows = rows.filter((r) => r.status === 'available').length;
  const totalArea = rows.reduce((sum, r) => sum + (r.area ?? 0), 0);
  const hasFilters = filters.query.trim().length > 0 || filters.status !== 'all';

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="قطع الأراضي التشغيلية"
        description="إدارة الأراضي ومتابعة حالتها ومساحاتها وقيمها التشغيلية من واجهة موحدة."
        count={isLoading ? '...' : rows.length}
        secondaryActions={
          <div className="flex min-w-max items-center gap-2 rounded-2xl border bg-background/70 px-3 py-2 text-xs font-bold text-muted-foreground">
            <Layers className="size-4" />
            <span>{isLoading ? 'جارٍ حساب المساحة...' : `إجمالي المساحة ${money(totalArea)} م²`}</span>
          </div>
        }
        primaryAction={
          <Button onClick={onCreate}>
            <Plus className="me-2 size-4" />
            إضافة أرض
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))
        ) : (
          <>
            <KpiCard
              label="إجمالي السجلات"
              value={rows.length}
              icon={MapPinned}
              accent="primary"
              sub={`${activeRows} نشطة`}
            />
            <KpiCard
              label="متاحة"
              value={availableRows}
              icon={TrendingUp}
              accent="emerald"
              sub="قطع قابلة للتعامل"
              trend={availableRows > 0 ? 'up' : 'neutral'}
              trendValue={String(availableRows)}
            />
            <KpiCard
              label="محجوزة"
              value={rows.filter((r) => r.status === 'reserved').length}
              icon={Tag}
              accent="amber"
              sub="قيد التفاوض"
            />
            <KpiCard
              label="إجمالي المساحة"
              value={`${money(totalArea)} م²`}
              icon={Layers}
              accent="sky"
              sub="مجموع المساحات المدخلة"
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-[1fr_12rem]">
          <Input
            value={filters.query}
            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
            placeholder="بحث بالاسم، رقم القطعة، الموقع، التصنيف"
            aria-label="بحث الأراضي"
          />
          <Select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            aria-label="حالة الأرض"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Error states */}
      {error ? (
        <div className="space-y-3">
          <DataErrorScreen
            title="تعذر تحميل الأراضي"
            fallbackMessage="راجع الاتصال والصلاحيات ثم أعد المحاولة."
            error={error}
          />
          <Button variant="secondary" onClick={onRetry} className="rounded-2xl">
            <RotateCcw className="me-2 size-4" />إعادة المحاولة
          </Button>
        </div>
      ) : null}

      {writeError ? (
        <WriteErrorCard
          message={
            writeError instanceof Error
              ? writeError.message
              : 'تعذر حفظ التغيير على سجل الأرض. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى.'
          }
        />
      ) : null}

      {/* Land list */}
      <AsyncContentState
        status={isLoading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
        error={error}
        errorTitle="تعذر تحميل الأراضي"
        errorFallbackMessage="راجع الاتصال والصلاحيات ثم أعد المحاولة."
        errorAction={<Button variant="secondary" onClick={onRetry} className="rounded-2xl"><RotateCcw className="me-2 size-4" />إعادة المحاولة</Button>}
        emptyTitle={hasFilters ? 'لا توجد أراضٍ ضمن الفلاتر الحالية' : 'لا توجد سجلات أراضٍ بعد'}
        emptyDescription={hasFilters ? 'غيّر البحث أو الحالة لعرض سجلات أراضٍ أخرى.' : 'أضف أول سجل أرض تشغيلي عند توفر بيانات قطعة أرض حقيقية.'}
        emptyAction={!hasFilters ? <Button onClick={onCreate}><Plus className="me-2 size-4" />إضافة سجل أرض</Button> : undefined}
      >
        <LandRows rows={rows} isArchiving={isArchiving} onEdit={onEdit} onArchive={onArchive} />
      </AsyncContentState>

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLand ? 'تعديل أرض' : 'إضافة أرض'}</DialogTitle>
            <DialogDescription>
              الحقول تحفظ سجل أرض تشغيلي وتربطه بالمالك عند توفر معرفه.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}
          >
            <Field label="اسم الأرض">
              <Input required value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="رقم القطعة">
              <Input value={draft.plot_no} onChange={(e) => onDraftChange({ ...draft, plot_no: e.target.value })} />
            </Field>
            <Field label="الموقع">
              <Input value={draft.location} onChange={(e) => onDraftChange({ ...draft, location: e.target.value })} />
            </Field>
            <Field label="التصنيف">
              <Select value={draft.category} onChange={(e) => onDraftChange({ ...draft, category: e.target.value })}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={draft.status} onChange={(e) => onDraftChange({ ...draft, status: e.target.value })}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="معرف المالك">
              <Input
                value={draft.owner_id}
                onChange={(e) => onDraftChange({ ...draft, owner_id: e.target.value })}
                placeholder="اختياري: معرف مالك موجود فقط"
              />
            </Field>
            <Field label="سعر المالك">
              <Input type="number" min="0" value={draft.owner_price} onChange={(e) => onDraftChange({ ...draft, owner_price: e.target.value })} />
            </Field>
            <Field label="سعر الشراء">
              <Input type="number" min="0" value={draft.purchase_price} onChange={(e) => onDraftChange({ ...draft, purchase_price: e.target.value })} />
            </Field>
            <Field label="عمولة تقديرية مسجلة">
              <Input type="number" min="0" value={draft.commission} onChange={(e) => onDraftChange({ ...draft, commission: e.target.value })} />
            </Field>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              ملاحظات
              <Textarea value={draft.notes} onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })} />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
              <Button type="button" variant="secondary" onClick={() => onFormOpenChange(false)}>إلغاء</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      {children}
    </label>
  );
}

function LandRows({
  rows, isArchiving, onEdit, onArchive,
}: Readonly<{ rows: LandRecord[]; isArchiving: boolean; onEdit: (row: LandRecord) => void; onArchive: (id: string) => void }>) {
  return (
    <>
      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <LandCard key={row.id} row={row} isArchiving={isArchiving} onEdit={onEdit} onArchive={onArchive} />
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-right">الأرض</th>
                <th className="p-3 text-right">الموقع</th>
                <th className="p-3 text-right">القيمة</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="max-w-56 whitespace-normal break-words p-3 font-bold">
                    {row.name ?? row.plot_no ?? 'بدون اسم'}
                    <p className="text-xs text-muted-foreground">
                      {categoryLabels[row.category ?? ''] ?? row.category}
                    </p>
                  </td>
                  <td className="max-w-72 whitespace-normal break-words p-3">{row.location ?? '—'}</td>
                  <td className="p-3" dir="ltr">{money(row.owner_price ?? row.purchase_price)}</td>
                  <td className="p-3">
                    <StatusBadge tone={tone(row.status)}>
                      {statusLabels[row.status ?? ''] ?? row.status ?? '—'}
                    </StatusBadge>
                  </td>
                  <td className="p-3">
                    <RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchive={onArchive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function LandCard({
  row, isArchiving, onEdit, onArchive,
}: Readonly<{ row: LandRecord; isArchiving: boolean; onEdit: (row: LandRecord) => void; onArchive: (id: string) => void }>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">{row.name ?? row.plot_no ?? 'بدون اسم'}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{row.location ?? 'بدون موقع'}</p>
          {row.category ? (
            <p className="mt-1 text-xs text-muted-foreground/70">
              {categoryLabels[row.category] ?? row.category}
            </p>
          ) : null}
        </div>
        <StatusBadge tone={tone(row.status)}>
          {statusLabels[row.status ?? ''] ?? row.status ?? '—'}
        </StatusBadge>
      </div>
      {(row.owner_price ?? row.purchase_price) != null ? (
        <p className="mt-3 text-sm font-bold" dir="ltr">
          {money(row.owner_price ?? row.purchase_price)}
        </p>
      ) : null}
      <RowActions id={row.id} disabled={isArchiving} onEdit={() => onEdit(row)} onArchive={onArchive} />
    </div>
  );
}

function RowActions({
  id, disabled, onEdit, onArchive,
}: Readonly<{ id: string; disabled: boolean; onEdit: () => void; onArchive: (id: string) => void }>) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button className="min-h-11" variant="secondary" onClick={onEdit}>
        <Edit className="me-2 size-4" />تعديل
      </Button>
      <Button className="min-h-11" variant="danger" disabled={disabled} onClick={() => onArchive(id)}>
        <Archive className="me-2 size-4" />أرشفة
      </Button>
    </div>
  );
}
