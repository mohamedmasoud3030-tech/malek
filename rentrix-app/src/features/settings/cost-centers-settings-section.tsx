import { useMemo, useState, type KeyboardEvent } from 'react';
import { Archive, Pencil, RefreshCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useProperties } from '@/features/properties/use-properties';
import type { Property } from '@/types/domain';
import type { CostCenterFormValues, CostCenterRecord } from './costCenterService';
import { useArchiveCostCenter, useCostCenters, useSaveCostCenter } from './useCostCenters';

const emptyForm: CostCenterFormValues = {
  name: '',
  property_id: '',
  parent_id: '',
  is_active: true,
};

type PropertyOption = Pick<Property, 'id' | 'title'>;

function getPropertyTitle(properties: readonly PropertyOption[], propertyId: string | null) {
  if (!propertyId) return 'بدون عقار محدد';
  return properties.find((property) => property.id === propertyId)?.title ?? 'عقار غير معروف';
}

function getParentName(costCenters: readonly CostCenterRecord[], parentId: string | null) {
  if (!parentId) return 'رئيسي';
  return costCenters.find((costCenter) => costCenter.id === parentId)?.name ?? 'مركز غير معروف';
}

function shouldSaveOnEnter(event: KeyboardEvent<HTMLElement>) {
  return event.key === 'Enter' && !event.shiftKey && !(event.target instanceof HTMLTextAreaElement);
}

export function CostCentersSettingsSection() {
  const costCentersQuery = useCostCenters();
  const propertiesQuery = useProperties({ search: '', status: 'all', page: 1, pageSize: 1000 });
  const saveMutation = useSaveCostCenter();
  const archiveMutation = useArchiveCostCenter();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<CostCenterFormValues>(emptyForm);

  const properties = propertiesQuery.data?.rows ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const activeCostCenters = useMemo(
    () => costCenters.filter((costCenter) => costCenter.is_active !== false && costCenter.id !== editingId),
    [costCenters, editingId],
  );
  const isBusy = saveMutation.isPending || archiveMutation.isPending;

  const resetForm = () => {
    setEditingId(undefined);
    setForm(emptyForm);
  };

  const handleEdit = (costCenter: CostCenterRecord) => {
    setEditingId(costCenter.id);
    setForm({
      name: costCenter.name,
      property_id: costCenter.property_id ?? '',
      parent_id: costCenter.parent_id ?? '',
      is_active: costCenter.is_active !== false,
    });
  };

  const handleSave = async () => {
    if (isBusy || !form.name.trim()) return;
    await saveMutation.mutateAsync({ id: editingId, values: form });
    resetForm();
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!shouldSaveOnEnter(event)) return;
    event.preventDefault();
    void handleSave();
  };

  if (costCentersQuery.isLoading || propertiesQuery.isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (costCentersQuery.isError || propertiesQuery.isError) {
    const error = costCentersQuery.error ?? propertiesQuery.error;
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-black text-destructive">تعذر تحميل مراكز التكلفة</p>
        <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل البيانات.'}</p>
        <Button className="mt-3" variant="secondary" onClick={() => void Promise.all([costCentersQuery.refetch(), propertiesQuery.refetch()])}>
          <RefreshCcw className="me-2 size-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3 rounded-2xl border bg-background/70 p-4" onKeyDown={handleEditorKeyDown}>
        <div>
          <p className="text-sm font-black">{editingId ? 'تعديل مركز تكلفة' : 'مركز تكلفة جديد'}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">اربط المصروفات لاحقاً بعقار أو مركز تشغيلي بدون فتح دفتر أستاذ عام.</p>
        </div>

        <label className="space-y-1 text-sm font-medium">
          <span>اسم مركز التكلفة</span>
          <Input value={form.name} disabled={isBusy} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="مثال: صيانة برج النخيل" />
        </label>

        <label className="space-y-1 text-sm font-medium">
          <span>العقار المرتبط</span>
          <Select value={form.property_id} disabled={isBusy} onChange={(event) => setForm({ ...form, property_id: event.target.value })}>
            <option value="">بدون عقار محدد</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-medium">
          <span>المركز الأب</span>
          <Select value={form.parent_id} disabled={isBusy} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}>
            <option value="">مركز رئيسي</option>
            {activeCostCenters.map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
          </Select>
        </label>

        <label className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium">
          <input type="checkbox" checked={form.is_active} disabled={isBusy} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          <span>مركز نشط للاستخدام</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleSave()} disabled={isBusy || !form.name.trim()}>
            <Save className="me-2 size-4" />
            {isBusy ? 'جارٍ الحفظ...' : 'حفظ مركز التكلفة'}
          </Button>
          {editingId ? <Button type="button" variant="secondary" onClick={resetForm}>إلغاء التعديل</Button> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-background/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">مراكز التكلفة الحالية</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{costCenters.length} مركز مسجل</p>
          </div>
          <StatusBadge tone={costCenters.length > 0 ? 'success' : 'neutral'}>{costCenters.length > 0 ? 'مفعلة' : 'فارغة'}</StatusBadge>
        </div>

        {costCenters.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            لا توجد مراكز تكلفة بعد. أضف أول مركز لتجهيز ربط المصروفات والتقارير.
          </div>
        ) : (
          <div className="grid gap-2">
            {costCenters.map((costCenter) => (
              <div key={costCenter.id} className="rounded-2xl border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{costCenter.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {getPropertyTitle(properties, costCenter.property_id)} · {getParentName(costCenters, costCenter.parent_id)}
                    </p>
                  </div>
                  <StatusBadge tone={costCenter.is_active === false ? 'neutral' : 'success'}>{costCenter.is_active === false ? 'غير نشط' : 'نشط'}</StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => handleEdit(costCenter)} disabled={isBusy}>
                    <Pencil className="me-2 size-3.5" />
                    تعديل
                  </Button>
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => archiveMutation.mutate(costCenter.id)} disabled={isBusy}>
                    <Archive className="me-2 size-3.5" />
                    أرشفة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
