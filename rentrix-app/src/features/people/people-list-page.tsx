import { Edit, IdCard, Plus, Trash2, UserCheck, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PersonFormModal } from "./person-form-modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
    <article className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div
        className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl transition-colors group-hover:bg-primary/12"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{formatCount(value)}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export type PeopleListPageProps = Readonly<{
  embedded?: boolean;
}>;

export function PeopleListPage({ embedded = false }: PeopleListPageProps) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<PersonTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

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
            key: "type",
            label: "النوع",
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
      key: "name",
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
      key: "type",
      header: "النوع",
      render: (person) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
            (entityCardTypeMap[person.type] ?? entityCardTypeMap.contact!).bg,
            (entityCardTypeMap[person.type] ?? entityCardTypeMap.contact!).text,
          )}
        >
          {personTypeLabels[person.type]}
        </span>
      ),
    },
    { key: "phone", header: "الهاتف", render: (person) => person.phone ?? "—" },
    {
      key: "email",
      header: "البريد",
      render: (person) => (
        <span dir="ltr" className="block text-right">
          {person.email ?? "—"}
        </span>
      ),
    },
    {
      key: "national_id",
      header: "رقم الهوية",
      render: (person) => person.national_id ?? "—",
    },
    {
      key: "actions",
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
            onClick={() => openEdit(person.id)}
          >
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
          <div className="space-y-3">
            <Select
              aria-label="تصفية الأشخاص حسب النوع"
              value={type}
              onChange={(event) => {
                setType(event.target.value as PersonTypeFilter);
                setPage(1);
              }}
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
      >
        {!peopleQuery.isLoading && !peopleQuery.isError ? (
          <section
            data-people-summary
            aria-label="ملخص الأشخاص"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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

        <section
          data-people-register
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                  <Users className="size-4.5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-black">سجل الأشخاص</h2>
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {formatCount(rows.length)} سجل في الصفحة الحالية.
              </p>
            </div>
          </header>

          <div className="p-3 sm:p-4">
            <EntityTable
              aria-label="جدول الأشخاص"
              rows={rows}
              columns={columns}
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
              enableViewModeToggle
              viewModeStorageKey="rentrix:view-mode:people"
              renderMobileCard={(person) => (
                <EntityCard
                  id={person.id}
                  name={person.full_name}
                  subtitle={person.address}
                  type={person.type}
                  meta={[
                    ...(person.phone
                      ? [entityCardContactMeta.phone(person.phone)]
                      : []),
                    ...(person.email
                      ? [entityCardContactMeta.email(person.email)]
                      : []),
                    ...(person.national_id
                      ? [
                          {
                            icon: IdCard,
                            value: person.national_id,
                            dir: "ltr" as const,
                          },
                        ]
                      : []),
                  ]}
                  actions={[
                    {
                      label: "تعديل",
                      icon: Edit,
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
                  onClick={() => openEdit(person.id)}
                />
              )}
            />
          </div>
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
        description={`سيتم أرشفة الشخص "${rows.find((person) => person.id === deleteId)?.full_name ?? ""}" ولن يظهر في القوائم الرئيسية. المرجع: ${deleteId ? deleteId.slice(0, 8) : ""} — ستبقى السجلات المرتبطة محفوظة.`}
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
