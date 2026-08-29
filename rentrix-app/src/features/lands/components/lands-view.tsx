import { Archive, Edit, Layers, MapPinned, Plus, Tag, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { useDialogNavigate } from '@/app/router/background-location';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { WriteErrorCard } from '@/components/page-state-card';
import { useOwnerOptions } from '@/hooks/use-owner-options';
import { formatMoney, formatNumber } from '@/hooks/useCompanyFormatters';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';
import type { LandFilters, LandRecord } from '../types';
import type { LandFormValues } from '../land-schema';
import { MONEY_STEP } from '@/lib/money';
import { landStatusLabels, landCategoryLabels, landStatusTone } from '../labels';

function money(value: number | null | undefined) {
  return value == null ? '—' : formatMoney(value);
}

function area(value: number | null | undefined) {
  return value == null ? '—' : `${formatNumber(value)} م²`;
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
  embedded?: boolean;
}>;

export function LandsView({
  rows,
  filters,
  draft,
  editingLand,
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
  embedded = false,
}: Props) {
  const [archiveCandidate, setArchiveCandidate] = useState<LandRecord | null>(null);
  const dialogNavigate = useDialogNavigate();
  const ownersQuery = useOwnerOptions();
  const owners = ownersQuery.data ?? [];
  const activeRows = rows.filter((row) => row.status !== 'archived').length;
  const availableRows = rows.filter((row) => row.status === 'available').length;
  const totalArea = rows.reduce((sum, row) => sum + (row.area ?? 0), 0);
  const hasFilters = filters.query.trim().length > 0 || filters.status !== 'all';

  const activeFilters: ActiveFilterItem[] = [
    ...(filters.query.trim()
      ? [{ key: 'query', label: 'بحث', value: filters.query.trim(), onRemove: () => onFiltersChange({ ...filters, query: '' }) }]
      : []),
    ...(filters.status !== 'all'
      ? [{ key: 'status', label: 'الحالة', value: landStatusLabels[filters.status] ?? 'حالة أخرى', onRemove: () => onFiltersChange({ ...filters, status: 'all' }) }]
      : []),
  ];

  const clearFilters = () => onFiltersChange({ query: '', status: 'all' });
  const ownerLabel = (ownerId: string | null | undefined) => {
    if (!ownerId) return 'غير مرتبط بمالك';
    const owner = owners.find((item) => item.id === ownerId);
    return owner?.display_name || owner?.full_name || owner?.name || 'مالك مسجل';
  };

  const rowActions = (row: LandRecord) => (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button variant="secondary" onClick={() => onEdit(row)}><Edit className="size-4" />تعديل</Button>
      {row.status !== 'archived' ? (
        <Button variant="danger" disabled={isArchiving} onClick={() => setArchiveCandidate(row)}><Archive className="size-4" />أرشفة</Button>
      ) : null}
    </div>
  );

  const columns: ColumnDef<LandRecord>[] = [
    {
      key: 'name', priority: 'identity' as const,
      header: 'الأرض',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-bold">{row.name || row.plot_no || 'بدون اسم'}</p>
          <p className="text-xs text-muted-foreground">{landCategoryLabels[row.category ?? ''] ?? 'غير مصنفة'}</p>
        </div>
      ),
    },
    { key: 'location', priority: 'secondary' as const, header: 'الموقع', render: (row) => row.location || '—' },
    { key: 'area', priority: 'detail' as const, header: 'المساحة', render: (row) => <span dir="ltr">{area(row.area)}</span> },
    { key: 'owner', priority: 'secondary' as const, header: 'المالك', render: (row) => ownerLabel(row.owner_id) },
    { key: 'value', priority: 'detail' as const, header: 'القيمة', render: (row) => <span dir="ltr">{money(row.owner_price ?? row.purchase_price)}</span> },
    { key: 'status', priority: 'primary' as const, header: 'الحالة', render: (row) => <StatusBadge tone={landStatusTone[row.status ?? ""] ?? "neutral"}>{landStatusLabels[row.status ?? ''] ?? 'حالة أخرى'}</StatusBadge> },
    { key: 'actions', priority: 'actions' as const, header: 'إجراءات', render: rowActions },
  ];

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      dir="rtl"
      lang="ar"
      visualVariant="malek-pro"
      title="الأراضي"
      description="إدارة قطع الأراضي وحالتها ومساحتها ومالكها وقيمتها من سجل واحد."
      count={isLoading ? '...' : rows.length}
      secondaryActions={(
        <div className="hidden max-w-full items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-xs font-bold text-muted-foreground lg:flex">
          <Layers className="size-4" />
          <span>{isLoading ? 'جارٍ حساب المساحة...' : `إجمالي المساحة ${area(totalArea)}`}</span>
        </div>
      )}
      primaryAction={<Button onClick={onCreate}><Plus className="size-4" />إضافة أرض</Button>}
    >
      <ResponsiveCardGrid desktopColumns={4}>
        {isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl sm:h-28" />) : (
          <>
            <KpiCard label="إجمالي السجلات" value={rows.length} icon={MapPinned} accent="primary" sub={`${activeRows} نشطة`} />
            <KpiCard label="متاحة" value={availableRows} icon={TrendingUp} accent="emerald" sub="قابلة للتعامل" />
            <KpiCard label="محجوزة" value={rows.filter((row) => row.status === 'reserved').length} icon={Tag} accent="amber" sub="قيد التفاوض" />
            <KpiCard label="إجمالي المساحة" value={area(totalArea)} icon={Layers} accent="sky" sub="مجموع المساحات" />
          </>
        )}
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={filters.query}
        onSearchChange={(query) => onFiltersChange({ ...filters, query })}
        searchPlaceholder="بحث بالاسم، رقم القطعة، الموقع، التصنيف"
        searchAriaLabel="بحث الأراضي"
        filters={(
          <Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })} aria-label="حالة الأرض" className="w-full sm:w-48">
            <option value="all">كل الحالات</option>
            {Object.entries(landStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
      />
      <ActiveFilterBar filters={activeFilters} onClearAll={clearFilters} />

      {writeError ? <WriteErrorCard message={getActionableSupabaseErrorMessage(writeError, 'تعذر حفظ التغيير على سجل الأرض.')} /> : null}

      <AsyncContentState
        status={isLoading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
        error={error}
        errorTitle="تعذر تحميل الأراضي"
        errorFallbackMessage="راجع الاتصال والصلاحيات ثم أعد المحاولة."
        errorAction={<Button variant="secondary" onClick={onRetry}>إعادة المحاولة</Button>}
        emptyTitle={hasFilters ? 'لا توجد أراضٍ ضمن الفلاتر الحالية' : 'لا توجد سجلات أراضٍ بعد'}
        emptyDescription={hasFilters ? 'غيّر البحث أو الحالة أو امسح الفلاتر.' : 'أضف أول سجل أرض عند توفر بيانات حقيقية.'}
        emptyAction={hasFilters ? <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button> : <Button onClick={onCreate}>إضافة أرض</Button>}
      >
        <EntityTable
          aria-label="جدول الأراضي"
          rows={rows}
          columns={columns}
          keyOf={(row) => row.id}
          onRowClick={(row) => dialogNavigate({ to: '/lands/$landId', params: { landId: row.id } })}
        />
      </AsyncContentState>

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={(open) => { if (!isSaving) onFormOpenChange(open); }}
        title={editingLand ? 'تعديل أرض' : 'إضافة أرض'}
        description="أدخل بيانات الأرض واختر المالك بالاسم عند الحاجة."
        visualVariant="operational"
        className="max-w-2xl"
      >
        <EntityForm.Root
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            onSubmit(draft);
          }}
        >
          <EntityForm.Section title="بيانات الأرض">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="اسم الأرض *"><Input required value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="رقم القطعة"><Input value={draft.plot_no} onChange={(event) => onDraftChange({ ...draft, plot_no: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="الموقع"><Input value={draft.location} onChange={(event) => onDraftChange({ ...draft, location: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="المساحة (م²)"><Input type="number" min="0" step="0.01" inputMode="decimal" dir="ltr" value={draft.area} onChange={(event) => onDraftChange({ ...draft, area: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="التصنيف"><Select value={draft.category} onChange={(event) => onDraftChange({ ...draft, category: event.target.value as LandFormValues['category'] })}>{Object.entries(landCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="الحالة"><Select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value as LandFormValues['status'] })}>{Object.entries(landStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
            </div>
          </EntityForm.Section>

          <EntityForm.Section title="الملكية والقيمة" description="اختر المالك من السجل بالاسم عند الحاجة.">
            <EntityForm.Field label="المالك">
              <Select value={draft.owner_id} disabled={ownersQuery.isLoading} onChange={(event) => onDraftChange({ ...draft, owner_id: event.target.value })}>
                <option value="">بدون مالك محدد</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name || owner.full_name || owner.name}</option>)}
              </Select>
            </EntityForm.Field>
            {ownersQuery.isError ? <p className="text-xs font-medium text-destructive">تعذر تحميل قائمة الملاك. يمكنك حفظ الأرض بدون مالك ثم ربطه لاحقاً من ملف المالك.</p> : null}
            <div className="grid gap-4 sm:grid-cols-3">
              <EntityForm.Field label="سعر المالك"><Input type="number" min="0" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={draft.owner_price} onChange={(event) => onDraftChange({ ...draft, owner_price: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="سعر الشراء"><Input type="number" min="0" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={draft.purchase_price} onChange={(event) => onDraftChange({ ...draft, purchase_price: event.target.value })} /></EntityForm.Field>
              <EntityForm.Field label="عمولة تقديرية"><Input type="number" min="0" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={draft.commission} onChange={(event) => onDraftChange({ ...draft, commission: event.target.value })} /></EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظات"><Textarea value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} /></EntityForm.Field>
          </EntityForm.Section>

          <EntityForm.Actions submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'} onCancel={() => onFormOpenChange(false)} isSubmitting={isSaving} submitDisabled={!draft.name.trim()} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={Boolean(archiveCandidate)}
        onOpenChange={(open) => { if (!open && !isArchiving) setArchiveCandidate(null); }}
        title={`أرشفة الأرض ${archiveCandidate?.name ?? archiveCandidate?.plot_no ?? ''}؟`}
        description={archiveCandidate ? `ستُخفى الأرض من القوائم النشطة مع الاحتفاظ بسجلها وعلاقاتها ومستنداتها.` : undefined}
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
    </EmbeddableWorkspace>
  );
}