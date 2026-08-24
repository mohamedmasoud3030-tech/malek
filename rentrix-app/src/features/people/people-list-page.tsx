import { Edit, IdCard, Plus, Trash2, UserCheck, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from "sonner";
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
import {
  EntityCard,
  entityCardContactMeta,
  entityCardTypeMap,
} from "@/components/ui/entity-card";
import { Select } from "@/components/ui/select";
import { ListPage } from "@/components/layout/list-page";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { personTypeLabels, personTypeValues } from "./person-schema";

import type { Person } from "@/types/domain";
import type { PersonTypeFilter } from "./people-service";
import { usePeople, useSoftDeletePerson } from "./use-people";

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

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function PeopleMetric({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
}>) {
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-border/75 bg-card p-3 shadow-card sm:p-3.5">
      <div className="relative flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-1.5 text-xl font-black tabular-nums sm:text-2xl">{formatCount(value)}</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-muted-foreground sm:text-xs">{hint}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary sm:size-10">
          <Icon className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

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

  const errorToastShownRef = useRef(false);
  useEffect(() => {
    if (peopleQuery.isError && !errorToastShownRef.current) {
      errorToastShownRef.current = true;
      toast.error("تعذر تحميل الأشخاص");
    }
    if (!peopleQuery.isError) {
      errorToastShownRef.current = false;
    }
  }, [peopleQuery.isError]);

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
        <span dir="ltr" className="block text-right">
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
          className="flex gap-2"
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
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Select
              aria-label="تصفية الأشخاص حسب النوع"
              value={type}
              onChange={(event) => {
                setType(event.target.value as PersonTypeFilter);
                setPage(1);
              }}
              className="h-10 w-36 shrink-0 rounded-lg"
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
          <section
            data-people-summary
            aria-label="ملخص الأشخاص"
            className="grid grid-cols-2 gap-3"
          >
            <PeopleMetric
              label="إجمالي السجلات"
              value={totalCount}
              hint="كل النتائج المطابقة"
              icon={Users}
            />
            <PeopleMetric
              label="ملاك في الصفحة"
              value={ownersOnPage}
              hint="من السجلات المعروضة"
              icon={UserRound}
            />
            <PeopleMetric
              label="مستأجرون في الصفحة"
              value={tenantsOnPage}
              hint="من السجلات المعروضة"
              icon={UserCheck}
            />
            <PeopleMetric
              label="بيانات تواصل متاحة"
              value={completeContactsOnPage}
              hint="هاتف أو بريد مسجل"
              icon={IdCard}
            />
          </section>
        ) : null}

        <section data-people-register className="min-w-0 space-y-2.5">
          <header className="flex min-h-11 items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black">سجل الأشخاص</h2>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {formatCount(rows.length)} سجل في الصفحة الحالية
                </p>
              </div>
            </div>
          </header>

          <EntityTable
            aria-label="جدول الأشخاص"
            rows={rows}
            columns={columns}
            visibleColumnKeys={visibleColumnKeys}
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
