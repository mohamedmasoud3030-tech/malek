import { Edit, Eye, Trash2, User } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { EntityCell } from "@/components/ui/entity-cell";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CompanySettingsContract } from "@/lib/companySettings";
import { cn } from "@/lib/utils";
import { getContractNumber } from "../contractListExport";
import {
  formatContractDate,
  formatContractMoney,
} from "../contractDisplayFormatters";
import { contractStatusLabels, contractStatusTone, leaseModeLabels, paymentCycleLabels } from "../contractSchema";
import { normalizeContractStatus } from "@/lib/contractStatus";
import { unitStatusLabels, type UnitStatus } from "@/features/units/unit-schema";
import type { ContractListItem } from "../services/contractService";
import { getDaysUntilEnd, isExpiringSoon } from "../hooks/useContractFilters";
import {
  type ContractAttention,
  type ContractAttentionSeverity,
} from "../contract-attention";
import { contractNextActionShortLabels, getContractNextAction } from "../lifecycle/contractLifecycleRules";

function DetailBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 border-t border-border/60 pt-3 first:border-t-0", className)}>
      <p className="mb-1.5 text-xs font-bold text-muted-foreground">{label}</p>
      <div className="space-y-1 text-sm leading-6">{children}</div>
    </div>
  );
}

/** Attention severity maps straight onto the canonical StatusBadge tones. */
const attentionToneBySeverity: Record<ContractAttentionSeverity, "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

/** Rows predating the Short Stay column default to long-term leasing. */
function isShortStayContract(contract: Pick<ContractListItem, "lease_mode">) {
  return contract.lease_mode === "short_stay";
}

/**
 * Row-expansion operational summary: why this contract needs attention, what
 * the payment exposure is, and the one canonical next step. Deliberately short
 * — the full contract workspace stays the place for the complete record.
 */
function ContractAttentionPanel({
  attention,
  companySettings,
  contract,
}: {
  attention: ContractAttention | undefined;
  companySettings: CompanySettingsContract;
  contract: ContractListItem;
}) {
  const nextAction = attention?.nextAction ?? getContractNextAction(contract);
  const reasons = attention?.reasons ?? [];
  const paymentLoaded = attention ? attention.invoiceContextLoaded : false;

  return (
    <DetailBox label="المتابعة والإجراء التالي" className="md:col-span-2">
      {reasons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {reasons.map((reason) => (
            <StatusBadge key={reason.flag} tone={attentionToneBySeverity[reason.severity]}>
              {reason.detail ? `${reason.label} — ${reason.detail}` : reason.label}
            </StatusBadge>
          ))}
        </div>
      ) : !paymentLoaded ? (
        <p className="text-muted-foreground">جارٍ التحقق من حالة المدفوعات…</p>
      ) : (
        <p className="text-muted-foreground">لا توجد متابعة مطلوبة على هذا العقد.</p>
      )}

      {paymentLoaded ? (
        <p className="text-muted-foreground" data-contract-payment-attention>
          المدفوعات: {attention && attention.overdueInvoiceCount > 0
            ? `${attention.overdueInvoiceCount} فاتورة متأخرة بإجمالي ${formatContractMoney(companySettings, attention.overdueAmount)}`
            : attention && attention.receivableInvoiceCount > 0
              ? `${attention.receivableInvoiceCount} فاتورة غير مسددة بإجمالي ${formatContractMoney(companySettings, attention.outstandingAmount)}`
              : "لا توجد فواتير غير مسددة"}
        </p>
      ) : null}

      <p>
        <span className="text-muted-foreground">الإجراء التالي: </span>
        <span className="font-bold text-primary">
          {nextAction ? contractNextActionShortLabels[nextAction] : "لا يوجد إجراء مطلوب"}
        </span>
      </p>
    </DetailBox>
  );
}

export const contractColumnOptions = [
  { key: "contract_number", label: "رقم العقد", locked: true },
  { key: "tenant", label: "المستأجر" },
  { key: "unit", label: "الوحدة" },
  { key: "period", label: "الفترة" },
  { key: "rent_amount", label: "قيمة الإيجار" },
  { key: "status", label: "الحالة" },
  { key: "attention", label: "المتابعة" },
  { key: "next_action", label: "الإجراء التالي" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

export const defaultContractColumns = contractColumnOptions.map((column) => column.key);

export function ContractTable({
  attentionByContractId,
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
  visibleColumnKeys,
}: {
  /**
   * Operational attention per contract, produced by `useContractAttention`
   * from one batched invoice read. Optional so static fixtures (and any caller
   * without invoice context) still render: the next-action column falls back to
   * the canonical lifecycle rules, and payment attention is simply withheld
   * rather than reported as clean.
   */
  attentionByContractId?: ReadonlyMap<string, ContractAttention>;
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  expandedId: string | null;
  error?: unknown;
  isLoading: boolean;
  emptyDescription: string;
  emptyTitle: string;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPreview: (id: string) => void;
  onRetry: () => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  setExpandedId: (updater: (value: string | null) => string | null) => void;
  visibleColumnKeys: readonly string[];
}) {
  const columns = useMemo((): ColumnDef<ContractListItem>[] => [
    {
      key: "contract_number",
      header: "العقد رقم",
      priority: "identity",
      // Expiry is no longer restated here: the dedicated attention column owns
      // that signal, so the identity stays one clean, scannable reference.
      render: (contract) => <p className="font-bold">{getContractNumber(contract)}</p>,
    },
    {
      key: "tenant",
      header: "المستأجر",
      priority: "primary",
      render: (contract) => <EntityCell icon={User} title={contract.people?.full_name ?? "—"} />,
    },
    {
      key: "unit",
      header: "الوحدة",
      priority: "secondary",
      render: (contract) => contract.units?.unit_number ?? contract.properties?.title ?? "—",
    },
    {
      key: "period",
      header: "الفترة",
      priority: "secondary",
      render: (contract) => (
        <span className="whitespace-nowrap tabular-nums" dir="rtl">
          {formatContractDate(companySettings, contract.start_date)}
          {" ← "}
          {formatContractDate(companySettings, contract.end_date)}
        </span>
      ),
    },
    {
      key: "rent_amount",
      header: "قيمة الإيجار",
      priority: "detail",
      render: (contract) => (
        <span className="whitespace-nowrap">
          {formatContractMoney(companySettings, contract.rent_amount)}
          {isShortStayContract(contract) ? <span className="ms-1.5 text-xs text-muted-foreground">/ إجمالي الإقامة</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      priority: "secondary",
      render: (contract) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
            {contractStatusLabels[normalizeContractStatus(contract.status)]}
          </StatusBadge>
          {isShortStayContract(contract) ? (
            <StatusBadge tone="info">{leaseModeLabels.short_stay}</StatusBadge>
          ) : null}
        </span>
      ),
    },
    {
      key: "attention",
      header: "المتابعة",
      priority: "secondary",
      render: (contract) => {
        const attention = attentionByContractId?.get(contract.id);
        const primaryReason = attention?.primaryReason ?? null;
        if (!primaryReason) {
          // Distinguish "verified clean" from "payment context not loaded yet".
          if (attention && !attention.invoiceContextLoaded) {
            return <span className="text-xs text-muted-foreground">جارٍ التحقق من المدفوعات…</span>;
          }
          return <span className="text-xs text-muted-foreground">لا يحتاج متابعة</span>;
        }
        const additional = attention ? attention.reasons.length - 1 : 0;
        return (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusBadge tone={attentionToneBySeverity[primaryReason.severity]}>
              {primaryReason.label}
            </StatusBadge>
            {primaryReason.detail ? (
              <span className="text-xs text-muted-foreground">{primaryReason.detail}</span>
            ) : null}
            {additional > 0 ? (
              <span className="text-xs font-bold text-muted-foreground" title="أسباب متابعة إضافية">
                +{additional}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "next_action",
      header: "الإجراء التالي",
      priority: "detail",
      render: (contract) => {
        // Canonical lifecycle rules stay the only source of the next step.
        const nextAction = attentionByContractId?.get(contract.id)?.nextAction ?? getContractNextAction(contract);
        if (!nextAction) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="whitespace-nowrap text-xs font-bold text-primary">
            {contractNextActionShortLabels[nextAction]}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "إجراءات",
      priority: "actions",
      className: "w-52",
      render: (contract) => (
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات العقد ${getContractNumber(contract)}`}
            items={[
              {
                id: 'preview',
                label: 'عرض',
                icon: Eye,
                onClick: () => onPreview(contract.id),
              },
              ...(onEdit ? [{
                id: 'edit',
                label: 'تعديل',
                icon: Edit,
                onClick: () => onEdit(contract.id),
              }] : []),
              ...(onDelete ? [{
                id: 'archive',
                label: 'أرشفة',
                icon: Trash2,
                danger: true,
                onClick: () => onDelete(contract.id),
              }] : []),
            ]}
          />
        </div>
      ),
    },
  ], [attentionByContractId, companySettings, onDelete, onEdit, onPreview]);

  return (
    <EntityTable
      aria-label="جدول العقود"
      rows={contracts}
      columns={columns}
      keyOf={(c) => c.id}
      visibleColumnKeys={visibleColumnKeys}
      isLoading={isLoading}
      error={error}
      errorTitle="تعذر تحميل العقود"
      onRetry={onRetry}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={onCreate ? <Button onClick={onCreate}>إنشاء عقد</Button> : undefined}
      pagination={pagination}
      mobileCardType="contract"
      mobileBadgeKey="status"
      mobileSupportingKey="tenant"
      // Card hierarchy: identity = contract number, supporting = tenant,
      // badge = status, then attention first among the quick facts (that is the
      // datum that decides whether the row needs a human), with unit and period
      // beside it. Rent and the next step drop to the compact secondary line so
      // the card carries the operational signal without growing taller.
      mobilePrimaryMetaKeys={["attention", "unit", "period"]}
      mobileSecondaryMetaKeys={["rent_amount", "next_action"]}
      mobileCardPrimaryAction={(contract) => ({
        label: "عرض العقد",
        variant: "default",
        ariaLabel: `عرض العقد ${getContractNumber(contract)}`,
        onClick: () => onPreview(contract.id),
      })}
      mobileCardActions={(contract) => [
        ...(onEdit ? [{
          label: "تعديل",
          icon: Edit,
          variant: "secondary" as const,
          ariaLabel: `تعديل العقد ${getContractNumber(contract)}`,
          onClick: () => onEdit(contract.id),
        }] : []),
        ...(onDelete ? [{
          label: "أرشفة",
          icon: Trash2,
          variant: "danger" as const,
          ariaLabel: `أرشفة العقد ${getContractNumber(contract)}`,
          onClick: () => onDelete(contract.id),
        }] : []),
      ]}
      onRowClick={(contract) => setExpandedId((current) => current === contract.id ? null : contract.id)}
      renderRowExpansion={(contract) => (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-5">
          <ContractAttentionPanel
            attention={attentionByContractId?.get(contract.id)}
            companySettings={companySettings}
            contract={contract}
          />
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
          <DetailBox label={isShortStayContract(contract) ? "إجمالي الإقامة" : "قيمة الإيجار"}>
            <p className="text-lg font-bold tabular-nums" dir="ltr">{formatContractMoney(companySettings, contract.rent_amount)}</p>
            {isShortStayContract(contract) ? (
              <>
                <p className="text-muted-foreground">فاتورة واحدة عند تاريخ الوصول</p>
                {contract.daily_reference_rate != null ? (
                  <p className="text-muted-foreground">سعر اليوم المرجعي: {formatContractMoney(companySettings, contract.daily_reference_rate)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">دورة السداد: {paymentCycleLabels[contract.payment_cycle]}</p>
            )}
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
              حالة الوحدة: {contract.units?.status ? (unitStatusLabels[contract.units.status as UnitStatus] ?? contract.units.status) : "—"}
            </p>
          </DetailBox>
        </div>
      )}
      expandedRowId={expandedId}
    />
  );
}
