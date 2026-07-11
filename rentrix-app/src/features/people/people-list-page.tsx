import { Edit, IdCard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PersonFormModal } from './person-form-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityCell } from '@/components/ui/entity-cell';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EntityCard, entityCardContactMeta, entityCardTypeMap } from '@/components/ui/entity-card';
import { Select } from '@/components/ui/select';
import { ListPage } from '@/components/layout/list-page';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { personTypeLabels, personTypeValues } from './person-schema';

import type { Person } from '@/types/domain';
import type { PersonTypeFilter } from './people-service';
import { usePeople, useSoftDeletePerson } from './use-people';

const pageSize = 10;

export function PeopleListPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PersonTypeFilter>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo(() => ({ search: debouncedSearch, type, page, pageSize }), [page, debouncedSearch, type]);
  const peopleQuery = usePeople(params);
  const deleteMutation = useSoftDeletePerson();

  // Show error toast once per error occurrence, not on every retry
  const errorToastShownRef = useRef(false);
  useEffect(() => {
    if (peopleQuery.isError && !errorToastShownRef.current) {
      errorToastShownRef.current = true;
      toast.error('تعذر تحميل الأشخاص');
    }
    if (!peopleQuery.isError) {
      errorToastShownRef.current = false;
    }
  }, [peopleQuery.isError]);

  const openEdit = (id: string) => { setEditPersonId(id); setModalOpen(true); };
  const openCreate = () => { setEditPersonId(undefined); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditPersonId(undefined); };
  const confirmDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) });
  };

  const hasFilterValues = search.trim().length > 0 || type !== 'all';
  const activeFilters: ActiveFilterItem[] = [
    ...(search.trim() ? [{ key: 'search', label: 'بحث', value: search.trim(), onRemove: () => { setSearch(''); setPage(1); } }] : []),
    ...(type !== 'all' ? [{ key: 'type', label: 'النوع', value: personTypeLabels[type as Exclude<PersonTypeFilter, 'all'>], onRemove: () => { setType('all'); setPage(1); } }] : []),
  ];
  const clearFilters = () => { setSearch(''); setType('all'); setPage(1); };

  const columns: ColumnDef<Person>[] = [
    {
      key: 'name',
      header: 'الاسم',
      render: (person) => (
        <EntityCell
          icon={entityCardTypeMap[person.type]?.icon ?? entityCardTypeMap['contact']!.icon}
          tone={person.type === 'owner' ? 'emerald' : person.type === 'contact' ? 'slate' : 'primary'}
          title={person.full_name}
          subtitle={person.address}
        />
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (person) => (
        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold',
          (entityCardTypeMap[person.type] ?? entityCardTypeMap['contact']!).bg,
          (entityCardTypeMap[person.type] ?? entityCardTypeMap['contact']!).text,
        )}>
          {personTypeLabels[person.type]}
        </span>
      ),
    },
    { key: 'phone', header: 'الهاتف', render: (p) => p.phone ?? '—' },
    { key: 'email', header: 'البريد', render: (p) => <span dir="ltr" className="block text-right">{p.email ?? '—'}</span> },
    { key: 'national_id', header: 'رقم الهوية', render: (p) => p.national_id ?? '—' },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'w-40',
      render: (person) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="min-h-11 px-3" onClick={() => openEdit(person.id)}>
            <Edit className="size-4" />
          </Button>
          <Button
            variant="danger"
            className="min-h-11 px-3"
            aria-label={`أرشفة ${person.full_name}`}
            onClick={() => setDeleteId(person.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ListPage
        dir="rtl"
        title="الأشخاص"
        description="جدول موحد للمستأجرين والملاك وجهات الاتصال."
        count={peopleQuery.data?.count ?? undefined}
        primaryAction={<Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة شخص</Button>}
        search={{
          value: search,
          onChange: (value) => { setSearch(value); setPage(1); },
          placeholder: 'بحث بالاسم أو الهاتف أو الهوية',
        }}
        filters={(
          <div className="space-y-3">
            <Select
              aria-label="تصفية الأشخاص حسب النوع"
              value={type}
              onChange={(event) => { setType(event.target.value as PersonTypeFilter); setPage(1); }}
            >
              <option value="all">كل الأنواع</option>
              {personTypeValues.map((item) => <option key={item} value={item}>{personTypeLabels[item]}</option>)}
            </Select>
            <ActiveFilterBar filters={activeFilters} onClearAll={clearFilters} />
          </div>
        )}
      >
        <EntityTable
          aria-label="جدول الأشخاص"
          rows={peopleQuery.data?.rows ?? []}
          columns={columns}
          keyOf={(p) => p.id}
          isLoading={peopleQuery.isLoading}
          error={peopleQuery.isError ? peopleQuery.error : null}
          errorTitle="تعذر تحميل الأشخاص"
          onRetry={() => peopleQuery.refetch()}
          emptyTitle={hasFilterValues ? "لا توجد نتائج مطابقة للفلاتر" : "لا توجد سجلات أشخاص"}
          emptyDescription={hasFilterValues ? "غيّر البحث أو النوع أو امسح الفلاتر لعرض سجلات أخرى." : "أضف مستأجراً أو مالكاً أو جهة اتصال."}
          emptyAction={hasFilterValues ? <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button> : <Button onClick={openCreate}>إضافة شخص</Button>}
          pagination={{
            page,
            pageSize,
            total: peopleQuery.data?.count ?? 0,
            onPageChange: setPage,
          }}
          renderMobileCard={(person) => (
            <EntityCard
              id={person.id}
              name={person.full_name}
              subtitle={person.address}
              type={person.type}
              meta={[
                ...(person.phone ? [entityCardContactMeta.phone(person.phone)] : []),
                ...(person.email ? [entityCardContactMeta.email(person.email)] : []),
                ...(person.national_id ? [{ icon: IdCard, value: person.national_id, dir: 'ltr' as const }] : []),
              ]}
              actions={[
                { label: 'تعديل', icon: Edit, onClick: () => openEdit(person.id) },
                { label: 'أرشفة', icon: Trash2, variant: 'danger', ariaLabel: `أرشفة ${person.full_name}`, onClick: () => setDeleteId(person.id) },
              ]}
              onClick={() => openEdit(person.id)}
            />
          )}
        />
      </ListPage>

      <PersonFormModal open={modalOpen} onClose={closeModal} personId={editPersonId} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="أرشفة الشخص؟"
        description="سيتم أرشفة هذا الشخص ولن يظهر في القوائم الرئيسية."
        confirmLabel="أرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
