import { useNavigate } from '@tanstack/react-router';
import { Building2, DoorOpen, Edit, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PropertyFormModal } from './property-form-modal';
import { AsyncContentState } from '@/components/async-content-state';
import { ListPage } from '@/components/layout/list-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityCell } from '@/components/ui/entity-cell';
import { Select } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EntityTable } from '@/components/ui/entity-table';
import { EntityCard } from '@/components/ui/entity-card';
import { cn } from '@/lib/utils';
import { formatPropertyUnitSummary } from './property-card-utils';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { propertyStatusLabels, propertyStatusValues } from './property-schema';
import { useProperties, useSoftDeleteProperty } from './use-properties';
import type { PropertyStatusFilter } from './property-service';

const pageSize = 10;
const propertyStatusTone = { active: 'green', inactive: 'gray', maintenance: 'gold', sold: 'blue' } as const;

function money(value: number | null) {
  if (value === null) return '—';
  return formatCompanyMoney(defaultCompanyLocalSettings, value);
}

export function PropertiesListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PropertyStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPropertyId, setEditPropertyId] = useState<string | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);
  const params = useMemo(() => ({ search, status, page, pageSize }), [page, search, status]);
  const propertiesQuery = useProperties(params);
  const deleteMutation = useSoftDeleteProperty();
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil((propertiesQuery.data?.count ?? 0) / pageSize));
  const hasFilterValues = search.trim().length > 0 || status !== 'all';

  const handleArchiveProperty = async () => {
    if (!archiveTarget) return;
    await deleteMutation.mutateAsync(archiveTarget.id);
    setArchiveTarget(null);
  };

  const properties = propertiesQuery.data?.rows ?? [];

  return (
    <>
      <ListPage
        dir="rtl"
        title="العقارات"
        description="إدارة المحفظة العقارية والتشغيلية"
        action={
          <Button className="rounded-2xl gap-2" onClick={() => { setEditPropertyId(undefined); setModalOpen(true); }}>
            <Plus className="size-4" />إضافة عقار
          </Button>
        }
        filters={
          <Card className="rounded-2xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2">
                <SearchInput
                  value={search}
                  onChange={(value) => { setSearch(value); setPage(1); }}
                  placeholder="بحث بالاسم أو العنوان..."
                  className="flex-1"
                />
                <Select
                  aria-label="الحالة"
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as PropertyStatusFilter); setPage(1); }}
                  className="w-36 rounded-xl"
                >
                  <option value="all">كل الحالات</option>
                  {propertyStatusValues.map((s) => <option key={s} value={s}>{propertyStatusLabels[s]}</option>)}
                </Select>
              </div>
            </CardContent>
          </Card>
        }
      >
        <AsyncContentState
          status={
            propertiesQuery.isLoading ? 'loading'
            : propertiesQuery.isError ? 'error'
            : properties.length === 0 ? 'empty'
            : 'ready'
          }
          error={propertiesQuery.error}
          errorTitle="تعذر تحميل قائمة العقارات"
          errorAction={<Button onClick={() => propertiesQuery.refetch()} className="rounded-2xl">إعادة المحاولة</Button>}
          emptyTitle={hasFilterValues ? 'لا توجد نتائج مطابقة للبحث' : 'لم تُضف عقارات بعد'}
          emptyDescription={hasFilterValues ? 'جرّب تغيير عوامل البحث أو إزالة الفلتر.' : 'ابدأ بإضافة أول عقار لك.'}
          emptyAction={!hasFilterValues ? (
            <Button className="rounded-2xl" onClick={() => { setEditPropertyId(undefined); setModalOpen(true); }}>
              <Building2 className="me-2 size-4" />إضافة أول عقار
            </Button>
          ) : undefined}
        >

        {/* Pure responsive table utilizing EntityTable's built-in renderMobileCard */}
        <EntityTable
          aria-label="جدول العقارات"
          rows={properties}
          keyOf={(p) => p.id}
          onRowClick={(p) => navigate({ to: '/properties/$propertyId', params: { propertyId: p.id } })}
          columns={[
            { key: 'title', header: 'العقار', render: (p) => <EntityCell icon={Building2} title={p.title ?? '—'} /> },
            { key: 'status', header: 'الحالة', render: (p) => (
              <StatusBadge tone={propertyStatusTone[p.status as keyof typeof propertyStatusTone] ?? 'gray'}>
                {propertyStatusLabels[p.status as keyof typeof propertyStatusLabels] ?? p.status}
              </StatusBadge>
            )},
            { key: 'address', header: 'العنوان', render: (p) => <span className="text-muted-foreground text-sm">{p.address ?? '—'}</span> },
            { key: 'actions', header: 'إجراءات', render: (p) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" className="min-h-11 rounded-xl px-3 text-xs gap-1" onClick={() => { setEditPropertyId(p.id); setModalOpen(true); }}>
                  <Edit className="size-3" />تعديل
                </Button>
                <Button variant="danger" className="min-h-11 rounded-xl px-3 text-xs gap-1" onClick={() => setArchiveTarget({ id: p.id, title: p.title ?? 'عقار' })}>
                  <Trash2 className="size-3" />أرشفة
                </Button>
              </div>
            )},
          ]}
          renderMobileCard={(p) => {
            const unitSummary = formatPropertyUnitSummary(undefined, undefined);
            return (
              <div className="space-y-2">
                <EntityCard
                  id={p.id}
                  name={p.title ?? 'عقار'}
                  subtitle={p.address}
                  avatarIcon={Building2}
                  badge={<StatusBadge tone={propertyStatusTone[p.status as keyof typeof propertyStatusTone] ?? 'gray'} dot>{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels] ?? p.status}</StatusBadge>}
                  onClick={() => navigate({ to: '/properties/$propertyId', params: { propertyId: p.id } })}
                  stats={(
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <DoorOpen className="size-3.5" />
                        <span className={cn('font-semibold', unitSummary.hasCount ? 'text-foreground' : 'text-muted-foreground')}>{unitSummary.text}</span>
                      </div>
                    </div>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" className="min-h-11 rounded-xl text-xs gap-1" onClick={() => { setEditPropertyId(p.id); setModalOpen(true); }}>
                    <Edit className="size-3.5" />تعديل
                  </Button>
                  <Button variant="danger" className="min-h-11 rounded-xl text-xs gap-1" onClick={() => setArchiveTarget({ id: p.id, title: p.title ?? 'عقار' })}>
                    <Trash2 className="size-3.5" />أرشفة
                  </Button>
                </div>
              </div>
            );
          }}
        />

        </AsyncContentState>

        {/* Pagination */}
        {!propertiesQuery.isLoading && !propertiesQuery.isError && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              className="rounded-xl"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </Button>
            <span className="text-sm font-bold text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="secondary"
              className="rounded-xl"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              التالي
            </Button>
          </div>
        )}
      </ListPage>
      <PropertyFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPropertyId(undefined); }}
        propertyId={editPropertyId}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        title={`أرشفة العقار "${archiveTarget?.title ?? ''}"؟`}
        description="سيتم إخفاء العقار من القوائم النشطة. يمكن التراجع عن هذا لاحقاً من سجل الأرشيف."
        confirmLabel="أرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={handleArchiveProperty}
      />
    </>
  );
}
