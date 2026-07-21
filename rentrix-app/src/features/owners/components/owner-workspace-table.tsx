import { Link } from "@tanstack/react-router";
import { Building2, Eye, LinkIcon, Pencil, Users } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/empty-state";
import { EntityCell } from "@/components/ui/entity-cell";
import { FilterBar } from "@/components/ui/filter-bar";
import { MobileCard } from "@/components/ui/mobile-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { defaultCompanyLocalSettings } from "@/lib/companySettings";
import { formatCompanyNumber } from "@/lib/companyFormatters";
import type { Owner } from "../services/owner-service";
import {
  getOwnerDisplayLabel,
  getOwnerPropertyOwnershipLabel,
  type OwnerWorkspaceRow,
} from "../utils/owner-ui-helpers";

function OwnerContact({ owner }: Readonly<{ owner: Owner }>) {
  return (
    <div className="space-y-1 text-sm">
      <div dir="ltr" className="text-right">
        {owner.phone ?? "—"}
      </div>
      <div dir="ltr" className="text-right text-muted-foreground">
        {owner.email ?? "—"}
      </div>
    </div>
  );
}

function OwnerPropertyLinks({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length)
    return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {row.properties.map((p) => (
        <Button
          key={`${row.owner.id}-${p.id}`}
          variant="secondary"
          className="min-h-11 px-3 text-xs"
          asChild
        >
          <Link to="/properties/$propertyId" params={{ propertyId: p.id }}>
            {p.title}
          </Link>
        </Button>
      ))}
    </div>
  );
}

function OwnershipSummary({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length)
    return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {row.properties.map((p) => (
        <div key={`${row.owner.id}-${p.id}-ownership`}>
          {getOwnerPropertyOwnershipLabel(p)}
        </div>
      ))}
    </div>
  );
}

export type OwnerWorkspaceTableProps = Readonly<{
  rows: OwnerWorkspaceRow[];
  search: string;
  selectedOwner: Owner | null;
  onCreateOwner: () => void;
  onEditOwner: (owner: Owner) => void;
  onSearchChange: (search: string) => void;
  onSelectOwner: (ownerId: string) => void;
}>;

/**
 * Owner directory: search bar plus the desktop DataTable / mobile-card
 * dual rendering for the owner list. Row selection drives the ownership
 * relationships panel in the parent page; this component owns only
 * presentation and search filtering, not data fetching.
 */
export function OwnerWorkspaceTable({
  rows,
  search,
  selectedOwner,
  onCreateOwner,
  onEditOwner,
  onSearchChange,
  onSelectOwner,
}: OwnerWorkspaceTableProps) {
  const hasSearch = Boolean(search.trim());
  const emptyState = (
    <EmptyState
      title={hasSearch ? "لا توجد نتائج مطابقة" : "لا يوجد ملاك"}
      description={
        hasSearch
          ? "جرّب البحث باسم أو هاتف أو بريد أو اسم عقار آخر."
          : "أضف أول مالك لبدء ربطه بالعقارات."
      }
      action={
        hasSearch ? undefined : (
          <Button onClick={onCreateOwner}>إضافة مالك</Button>
        )
      }
    />
  );

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="بحث باسم المالك أو الهاتف أو الإيميل أو العقار"
        searchAriaLabel="بحث في الملاك"
      />
      {rows.length > 0 ? (
        <DataTable
          aria-label="جدول الملاك"
          rows={rows}
          onRowClick={(row) => onSelectOwner(row.owner.id)}
          columns={[
            {
              key: "name",
              header: "اسم المالك",
              render: (row) => (
                <EntityCell
                  icon={Users}
                  title={
                    <button
                      type="button"
                      className="hover:text-primary text-start font-bold"
                      onClick={() => onSelectOwner(row.owner.id)}
                    >
                      {getOwnerDisplayLabel(row.owner)}
                    </button>
                  }
                  subtitle={row.owner.display_name ? row.owner.full_name : null}
                  meta={
                    <span dir="ltr">
                      معرّف السجل: #{row.owner.id.slice(0, 8)}
                    </span>
                  }
                />
              ),
            },
            {
              key: "contact",
              header: "الهاتف والإيميل",
              render: (row) => <OwnerContact owner={row.owner} />,
            },
            {
              key: "property_count",
              header: "عدد العقارات",
              render: (row) =>
                formatCompanyNumber(
                  defaultCompanyLocalSettings,
                  row.propertyCount,
                ),
            },
            {
              key: "property_links",
              header: "أسماء العقارات",
              render: (row) => <OwnerPropertyLinks row={row} />,
            },
            {
              key: "ownership",
              header: "نسبة الملكية/الدور",
              render: (row) => <OwnershipSummary row={row} />,
            },
            {
              key: "contracts",
              header: "العقود النشطة",
              render: (row) =>
                row.activeContractCount > 0
                  ? formatCompanyNumber(
                      defaultCompanyLocalSettings,
                      row.activeContractCount,
                    )
                  : "—",
            },
            {
              key: "actions",
              header: "روابط آمنة",
              render: (row) => (
                <div
                  className="flex"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ActionMenu
                    label="إجراءات المالك"
                    items={[
                      {
                        id: "relationships",
                        label: "العلاقات",
                        icon: LinkIcon,
                        onClick: () => onSelectOwner(row.owner.id),
                      },
                      {
                        id: "edit",
                        label: "تعديل",
                        icon: Pencil,
                        onClick: () => onEditOwner(row.owner),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          keyOf={(row) => row.owner.id}
          emptyTitle="لا يوجد ملاك"
          emptyDescription="أضف أول مالك لبدء ربطه بالعقارات."
          enableViewModeToggle
          viewModeStorageKey="rentrix:view-mode:owners"
          renderMobileCard={(row) => (
            <MobileCard
              title={getOwnerDisplayLabel(row.owner)}
              subtitle={row.owner.display_name ? row.owner.full_name : "مالك"}
              badge={
                <StatusBadge
                  tone={row.owner.is_active ? "success" : "neutral"}
                  dot
                >
                  {row.owner.is_active ? "نشط" : "غير نشط"}
                </StatusBadge>
              }
              meta={
                <div className="space-y-1 text-xs text-muted-foreground">
                  {row.owner.phone ? <p dir="ltr">{row.owner.phone}</p> : null}
                  {row.owner.email ? (
                    <p dir="ltr" className="truncate">
                      {row.owner.email}
                    </p>
                  ) : null}
                </div>
              }
              stats={
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span>
                    <Building2 className="me-1 inline size-3.5" />
                    {formatCompanyNumber(
                      defaultCompanyLocalSettings,
                      row.propertyCount,
                    )}{" "}
                    عقار
                  </span>
                  <span className="font-bold text-primary">
                    {formatCompanyNumber(
                      defaultCompanyLocalSettings,
                      row.activeContractCount,
                    )}{" "}
                    عقد نشط
                  </span>
                </div>
              }
              actions={
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 text-xs"
                    asChild
                  >
                    <Link
                      to="/owners/$ownerId"
                      params={{ ownerId: row.owner.id }}
                    >
                      <Eye className="me-1 size-4" />
                      التفاصيل
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 text-xs"
                    asChild
                  >
                    <Link to="/reports">
                      <Eye className="me-1 size-4" />
                      كشف الحساب
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 text-xs"
                    onClick={() => onSelectOwner(row.owner.id)}
                  >
                    <LinkIcon className="me-1 size-4" />
                    العلاقات
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 text-xs"
                    onClick={() => onEditOwner(row.owner)}
                  >
                    <Pencil className="me-1 size-4" />
                    تعديل
                  </Button>
                </div>
              }
              onClick={() => onSelectOwner(row.owner.id)}
            />
          )}
        />
      ) : (
        emptyState
      )}
    </div>
  );
}
