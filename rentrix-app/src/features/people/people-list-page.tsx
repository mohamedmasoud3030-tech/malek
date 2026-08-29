import { Edit, IdCard, Plus, Trash2, UserCheck, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PersonFormModal } from "./person-form-modal";
import { useDialogNavigate } from "@/app/router/background-location";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { EntityCell } from "@/components/ui/entity-cell";
import {
  ActiveFilterBar,
  type ActiveFilterItem,
} from "@/components/ui/active-filter-bar";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { entityCardTypeMap } from "@/components/ui/entity-card";
import { Select } from "@/components/ui/select";
import { ListPage } from "@/components/layout/list-page";
import { RegisterHeading, RegisterMetricStrip } from "@/components/layout/register-summary";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { personTypeLabels, personTypeValues } from "./person-schema";

import type { Person } from "@/types/domain";
import type { PersonTypeFilter } from "./people-service";
import { usePeople, useSoftDeletePerson } from "./use-people";
import { formatCount } from '@/lib/formatters';

const pageSize = 10;

const peopleColumnOptions = [
  { key: "name", label: "الاسم", locked: true },
  { key: "type", label: "النوع" },
  { key: "phone", label: "الهاتف" },
  { key: "email", label: "البريد" },
  { key: "national_id", label: "رقم الهوية" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

const defaultPeopleColumns = peopleColumnOptions.map((column) => column.key);

export type PeopleListPageProps = Readonly<{
  embedded?: boolean;
}>;

export function PeopleListPage({ embedded = false }: PeopleListPageProps) {
  const navigate = useNavigate();
  const url = useSearch({ strict: false }) as Record<string, unknown>;
  const [search, setSearch] = useState(typeof url.search === 'string' ? url.search : '');
  const [type, setType] = useState<PersonTypeFilter>(personTypeValues.includes(url.type as never) ? url.type as PersonTypeFilter : 'all');
  const [page, setPage] = useState(typeof url.page === 'number' && url.page > 0 ? url.page : 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultPeopleColumns]);
  const dialogNavigate = useDialogNavigate();
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (embedded) return;
    void navigate({
      to: '/people',
      replace: true,
      search: (previous: Record<string, unknown>) => ({ ...previous, search: debouncedSearch || undefined, type: type === 'all' ? undefined : type, page: page === 1 ? undefined : page }),
    });
  }, [debouncedSearch, embedded, navigate, page, type]);

  const params = useMemo(
    () => ({ search: debouncedSearch, type, page, pageSize }),
    [page, debouncedSearch, type],
  );
  const peopleQuery = usePeople(params);
  const deleteMutation = useSoftDeletePerson();
  const rows = peopleQuery.data?.rows ?? [];
  const totalCount = peopleQuery.data?.count ?? 0;
  const ownersOnPage = rows.filter((person) => person.type === "owner").length;
  const tenantsOnPage = rows.filter((person) => person.type === "tenant").length;
  const completeContactsOnPage = rows.filter(
    (person) => Boolean(person.phone || person.email),
  ).length;

  const openEdit = (id: string) => {
    setEditPersonId(id);
    setModalOpen(true);
  };
  const openCreate = () => {
    setEditPersonId(undefined);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditPersonId(undefined);
  };
  const confirmDelete = async () => {
    if (!deleteId || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // Keep the confirmation open on failure.
    }
  };

  const hasFilterValues = search.trim().length > 0 || type !== "all";
  const activeFilters: ActiveFilterItem[] = [
    ...(search.trim()
      ? [
          {
            key: "search",
            label: "بحث",
            value: search.trim(),
            onRemove: () => {
              setSearch("");
              setPage(1);
            },
          },
        ]
      : []),
    ...(type !== "all"
      ? [
          {
            key: "type", label: "النوع",
            value: personTypeLabels[type as Exclude<PersonTypeFilter, "all">],
            onRemove: () => {
              setType("all");
              setPage(1);
            },
          },
        ]
      : []),
  ];
  const clearFilters = () => {
    setSearch("");
    setType("all");
    setPage(1);
  };

  const columns: ColumnDef<Person>[] = [
    {
      key: "name", priority: 'identity' as const,
      header: "الاسم",
      render: (person) => (
        <EntityCell
          icon={
            entityCardTypeMap[person.type]?.icon ??
            entityCardTypeMap.contact!.icon
          }
          tone={
            person.type === "owner"
              ? "emerald"
              : person.type === "contact"
                ? "slate"
                : "primary"
          }
          title={person.full_name}
          subtitle={person.address}
        />
      ),
    },
    {
      key: "type", priority: 'primary' as const,
      header: "النوع",
      render: (person) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
            (entityCardTypeMap[person.type] ?? entityCardTypeMap.contact!).bg,
            (entityCardTypeMap[person.type] ?? entityCardTypeMap.contact!).text,
          )}
        >
          {personTypeLabels[person.type]}
        </span>
      ),
    },
    { key: "phone", priority: 'secondary' as const, header: "الهاتف", render: (person) => person.phone ?? "—" },
    {
      key: "email", priority: 'detail' as const,
      header: "البريد",
      render: (person) => (
        <span dir="ltr" className="block text-end">
          {person.email ?? "—"}
        </span>
      ),
    },
    {
      key: "national_id", priority: 'detail' as const,
      header: "رقم الهوية",
      render: (person) => person.national_id ?? "—",
    },
    {
      key: "actions", priority: 'actions' as const,
      header: "إجراءات",
      className: "w-40",
      render: (person) => (
        <div
          className="flex flex-wrap gap-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Button
            variant="secondary"
            className="min-h-11 px-3"
            onClick={() => dialogNavigate({ to: '/people/$personId', params: { personId: person.id } })}
          >
            عرض
          </Button>
          <Button
            variant="secondary"
            className="min-h-11 px-3"
            onClick={() => openEdit(person.id)}
          >
            <Edit className="size-4" aria-hidden="true" />
            تعديل
          </Button>
          <Button
            variant="danger"
            className="min-h-11 px-3"
            aria-label={`أرشفة ${person.full_name}`}
            onClick={() => setDeleteId(person.id)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            أرشفة
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ListPage
        embedded={embedded}
        dir="rtl"
        visualVariant="malek-pro"
        title="الأشخاص"
        description="سجل موحد للمستأجرين والملاك وجهات الاتصال مع بيانات التواصل والهوية."
        count={totalCount || undefined}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="me-2 size-4" />
            إضافة شخص
          </Button>
        }
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "بحث بالاسم أو الهاتف أو الهوية",
        }}
        filters={
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
            <Select
              aria-label="تصفية الأشخاص حسب النوع"
              value={type}
              onChange={(event) => {
                setType(event.target.value as PersonTypeFilter);
                setPage(1);
              }}
              className="min-h-11 w-36 shrink-0 rounded-lg"
            >
              <option value="all">كل الأنواع</option>
              {personTypeValues.map((item) => (
                <option key={item} value={item}>
                  {personTypeLabels[item]}
                </option>
              ))}
            </Select>
            <ActiveFilterBar
              filters={activeFilters}
              onClearAll={clearFilters}
            />
          </div>
        }
        toolbarActions={
          <DataTableColumnsMenu
            columns={peopleColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        }
      >
        {!peopleQuery.isLoading && !peopleQuery.isError ? (
          <RegisterMetricStrip
            aria-label="ملخص الأشخاص"
            className="max-w-full"
            items={[
              { id: "total", label: "إجمالي السجلات", value: formatCount(totalCount), hint: "كل النتائج المطابقة", icon: Users },
              { id: "owners", label: "ملاك في الصفحة", value: formatCount(ownersOnPage), hint: "من السجلات المعروضة", icon: UserRound },
              { id: "tenants", label: "مستأجرون في الصفحة", value: formatCount(tenantsOnPage), hint: "من السجلات المعروضة", icon: UserCheck },
              { id: "contacts", label: "بيانات تواصل متاحة", value: formatCount(completeContactsOnPage), hint: "هاتف أو بريد مسجل", icon: IdCard },
            ]}
          />
        ) : null}

        <section data-people-register className="min-w-0 space-y-2.5">
          <RegisterHeading
            title="سجل الأشخاص"
            meta={`${formatCount(rows.length)} سجل في الصفحة الحالية`}
          />

          <EntityTable
            aria-label="جدول الأشخاص"
            rows={rows}
            columns={columns}
            visibleColumnKeys={visibleColumnKeys}
            mobileCardType={(person) => person.type}
            mobileSummaryKeys={["phone", "email"]}
            mobileCardActions={(person) => [
              {
                label: "تعديل",
                icon: Edit,
                variant: "secondary",
                ariaLabel: `تعديل ${person.full_name}`,
                onClick: () => openEdit(person.id),
              },
              {
                label: "أرشفة",
                icon: Trash2,
                variant: "danger",
                ariaLabel: `أرشفة ${person.full_name}`,
                onClick: () => setDeleteId(person.id),
              },
            ]}
            keyOf={(person) => person.id}
            isLoading={peopleQuery.isLoading}
            error={peopleQuery.isError ? peopleQuery.error : null}
            errorTitle="تعذر تحميل الأشخاص"
            onRetry={() => peopleQuery.refetch()}
            emptyTitle={
              hasFilterValues
                ? "لا توجد نتائج مطابقة للفلاتر"
                : "لا توجد سجلات أشخاص"
            }
            emptyDescription={
              hasFilterValues
                ? "غيّر البحث أو النوع أو امسح الفلاتر لعرض سجلات أخرى."
                : "أضف مستأجراً أو مالكاً أو جهة اتصال."
            }
            emptyAction={
              hasFilterValues ? (
                <Button variant="secondary" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              ) : (
                <Button onClick={openCreate}>إضافة شخص</Button>
              )
            }
            pagination={{
              page,
              pageSize,
              total: totalCount,
              onPageChange: setPage,
            }}
            onRowClick={(person) => dialogNavigate({ to: '/people/$personId', params: { personId: person.id } })}
          />
        </section>
      </ListPage>

      <PersonFormModal
        open={modalOpen}
        onClose={closeModal}
        personId={editPersonId}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteId(null);
        }}
        title="أرشفة الشخص؟"
        description={`سيتم أرشفة الشخص "${rows.find((person) => person.id === deleteId)?.full_name ?? ""}" ولن يظهر في القوائم الرئيسية، وستبقى العقود والمستندات والسجلات المرتبطة محفوظة.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export function PeopleWorkspace({ embedded = true }: PeopleListPageProps) {
  return <PeopleListPage embedded={embedded} />;
}
