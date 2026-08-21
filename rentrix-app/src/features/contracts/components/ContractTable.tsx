import { Edit, Eye, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CompanySettingsContract } from "@/lib/companySettings";
import { cn } from "@/lib/utils";
import { getContractNumber } from "../contractListExport";
import {
  formatContractDate,
  formatContractMoney,
} from "../contractDisplayFormatters";
import { contractStatusLabels, contractStatusTone, paymentCycleLabels } from "../contractSchema";
import { normalizeContractStatus } from "@/lib/contractStatus";
import type { ContractListItem } from "../services/contractService";
import { getDaysUntilEnd, isExpiringSoon } from "../hooks/useContractFilters";

function DetailBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1 text-sm leading-6">{children}</div>
    </div>
  );
}

const contractColumnOptions = [
  { key: "contract_number", label: "رقم العقد", locked: true },
  { key: "tenant", label: "المستأجر" },
  { key: "unit", label: "الوحدة" },
  { key: "start_date", label: "تاريخ البداية" },
  { key: "end_date", label: "تاريخ النهاية" },
  { key: "rent_amount", label: "قيمة الإيجار" },
  { key: "status", label: "الحالة" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

const defaultContractColumns = contractColumnOptions.map((column) => column.key);

export function ContractTable({
  companySettings,
  contracts,
  expandedId,
  error,
  isLoading,
  emptyDescription,
  emptyTitle,
  onCreate,
  onDelete,
  onEdit,
  onPreview,
  onRetry,
  pagination,
  setExpandedId,
}: {
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  expandedId: string | null;
  error?: unknown;
  isLoading: boolean;
  emptyDescription: string;
  emptyTitle: string;
  onCreate?: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
}) {
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultContractColumns]);

  const columns: ColumnDef<ContractListItem>[] = [
    {
      key: "contract_number",
      header: "العقد رقم",
      priority: "identity",
      render: (contract) => {
        const expiringSoon = isExpiringSoon(contract);
        const daysUntilEnd = getDaysUntilEnd(contract);
        return (
          <>
            <p className="font-bold">{getContractNumber(contract)}</p>
            {expiringSoon && <p className="mt-1 text-xs font-semibold text-warning">ينتهي خلال {daysUntilEnd} يوم</p>}
          </>
        );
      },
    },
    {
      key: "tenant",
      header: "المستأجر",
      priority: "primary",
      render: (contract) => <span className="font-black">{contract.people?.full_name ?? "—"}</span>,
    },
    {
      key: "unit",
      header: "الوحدة",
      priority: "secondary",
      render: (contract) => contract.units?.unit_number ?? contract.properties?.title ?? "—",
    },
    {
      key: "start_date",
      header: "تاريخ البداية",
      priority: "detail",
      render: (contract) => formatContractDate(companySettings, contract.start_date),
    },
    {
      key: "end_date",
      header: "تاريخ النهاية",
      priority: "secondary",
      render: (contract) => formatContractDate(companySettings, contract.end_date),
    },
    {
      key: "rent_amount",
      header: "قيمة الإيجار",
      priority: "detail",
      render: (contract) => formatContractMoney(companySettings, contract.rent_amount),
    },
    {
      key: "status",
      header: "الحالة",
      priority: "secondary",
      render: (contract) => (
        <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
          {contractStatusLabels[normalizeContractStatus(contract.status)]}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "إجراءات",
      priority: "actions",
      render: (contract) => (
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات العقد ${getContractNumber(contract)}`}
            items={[
              { id: 'view', label: 'عرض', icon: Eye, onClick: () => onPreview(contract.id) },
              { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => onEdit(contract.id) },
              { id: 'archive', label: 'أرشفة', icon: Trash2, variant: 'destructive', onClick: () => onDelete(contract.id) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <EntityTable
      aria-label="جدول العقود"
      rows={contracts}
      columns={columns}
      keyOf={(c) => c.id}
      toolbar={(
        <div className="flex min-w-0 items-center justify-end gap-2">
          <DataTableColumnsMenu
            columns={contractColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        </div>
      )}
      visibleColumnKeys={visibleColumnKeys}
      mobileVisibleSecondaryKeys={["tenant", "unit", "status"]}
      isLoading={isLoading}
      error={error}
      errorTitle="تعذر تحميل العقود"
      onRetry={onRetry}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={onCreate ? <Button onClick={onCreate}>إنشاء عقد</Button> : undefined}
      pagination={pagination}
      onRowClick={(contract) => onPreview(contract.id)}
      onExpandedRowChange={(rowId) => setExpandedId(() => rowId)}
      renderRowExpansion={(contract) => (
        <div className="grid grid-cols-2 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2">
          <DetailBox label="بيانات المستأجر">
            <p className="font-bold">{contract.people?.full_name ?? "—"}</p>
            <p className="text-muted-foreground">هاتف: {contract.people?.phone ?? "—"}</p>
            <p className="text-muted-foreground">بريد: {contract.people?.email ?? "—"}</p>
            <p className="text-muted-foreground">هوية: {contract.people?.national_id ?? "—"}</p>
          </DetailBox>
          <DetailBox label="بيانات الوحدة والعقار">
            <p className="font-bold">{contract.units?.unit_number ?? "—"} / {contract.properties?.title ?? "—"}</p>
            <p className="text-muted-foreground">الدور: {contract.units?.floor ?? "—"}</p>
            <p className="text-muted-foreground">العنوان: {contract.properties?.address ?? "—"}</p>
          </DetailBox>
          <DetailBox label="قيمة الإيجار">
            <p className="text-lg font-bold tabular-nums" dir="ltr">{formatContractMoney(companySettings, contract.rent_amount)}</p>
            <p className="text-muted-foreground">دورة السداد: {paymentCycleLabels[contract.payment_cycle]}</p>
          </DetailBox>
          <DetailBox label="فترة العقد">
            <p>{formatContractDate(companySettings, contract.start_date)} ← {formatContractDate(companySettings, contract.end_date)}</p>
            <p className="text-muted-foreground">رقم العقد: {getContractNumber(contract)}</p>
            {isExpiringSoon(contract) && <p className="font-semibold text-warning">تنبيه: العقد ينتهي خلال {getDaysUntilEnd(contract)} يوم.</p>}
          </DetailBox>
          <DetailBox label="الحالة">
            <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
              {contractStatusLabels[normalizeContractStatus(contract.status)]}
            </StatusBadge>
            <p className={cn("mt-2 text-muted-foreground", contract.units?.status === "occupied" && "text-primary")}>
              حالة الوحدة: {contract.units?.status ?? "—"}
            </p>
          </DetailBox>
        </div>
      )}
      expandedRowId={expandedId}
    />
  );
}
