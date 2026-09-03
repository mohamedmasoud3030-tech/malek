import { useEffect, useRef, useState } from 'react';
import { ReceiptText, Scale, UserRound, UsersRound, WalletCards } from 'lucide-react';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import type { OwnerReportPayload } from '@/services/documents/documentPayloads';
import { createReceiptPrintHref } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportPanelSkeleton, ReportState } from '@/components/ui/report-section-primitives';
import { ReportOutputActions } from '../report-output-actions';
import { ReportPayloadGroup } from '../report-payload-groups';
import { formatLatinNumber } from '@/lib/formatters';
import { loadPremiumOwnerReportPayload } from '../../documents/premium-owner-report';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type TenantFallbackRow = Readonly<{
  contractId: string;
  tenantName: string | null;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
}>;

type OwnerFallbackRow = Readonly<{
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
}>;

type TenantLedgerRow = TenantStatementReport['lines'][number] & { rowKey: string };
type OwnerLedgerRow = OwnerStatementReport['transactions'][number] & { rowKey: string };

function tenantOpeningBalance(statement: TenantStatementReport) {
  const first = statement.lines[0];
  return first ? (first.balance || 0) - (first.debit || 0) + (first.credit || 0) : statement.finalBalance || 0;
}

function tenantLineType(type: string | null) {
  if (type === 'invoice') return 'فاتورة / استحقاق';
  if (type === 'receipt') return 'دفعة / إيصال';
  if (type === 'credit') return 'دائن / عكس';
  return 'حركة حساب';
}

function ownerLineType(type: string | null) {
  if (type === 'receipt') return 'تحصيل';
  if (type === 'expense') return 'مصروف';
  if (type === 'settlement') return 'تسوية / صرف';
  return 'حركة مالية';
}

function ownerCommissionSummary(type: string | null, value: number) {
  if (type === 'RATE') return `نسبة ${formatLatinNumber(value, 'ar')}٪`;
  if (type === 'FIXED_MONTHLY') return `مبلغ شهري ${formatMoney(value)}`;
  return 'غير محددة';
}

export function TenantStatementPanel({
  selectedContractId,
  statement,
  error,
  isLoading,
  fallbackRows,
  receipts,
  onPrint,
  onDownloadPdf,
  onDownloadExcel,
  actionsDisabled = false,
}: Readonly<{
  selectedContractId: string;
  statement: TenantStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: TenantFallbackRow[];
  receipts: ReceiptRow[];
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadExcel: () => void;
  actionsDisabled?: boolean;
}>) {
  const ledgerRows: TenantLedgerRow[] = (statement?.lines ?? []).map((line, index) => ({
    ...line,
    rowKey: `${line.date ?? 'line'}-${index}`,
  }));
  const opening = statement ? tenantOpeningBalance(statement) : 0;
  const totalDebit = ledgerRows.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = ledgerRows.reduce((sum, line) => sum + (line.credit || 0), 0);
  const tenantColumns: ColumnDef<TenantLedgerRow>[] = [
    { key: 'date', header: 'التاريخ', priority: 'identity', render: (line) => <span dir="ltr" className="tabular-nums">{line.date ?? '—'}</span> },
    { key: 'type', header: 'نوع الحركة', priority: 'secondary', render: (line) => tenantLineType(line.type) },
    { key: 'description', header: 'البيان / المرجع', priority: 'secondary', render: (line) => line.description ?? 'حركة حساب' },
    { key: 'debit', header: 'مدين', priority: 'detail', render: (line) => <span dir="ltr">{formatMoney(line.debit)}</span> },
    { key: 'credit', header: 'دائن', priority: 'detail', render: (line) => <span dir="ltr">{formatMoney(line.credit)}</span> },
    { key: 'balance', header: 'الرصيد الجاري', priority: 'primary', render: (line) => <strong dir="ltr">{formatMoney(line.balance)}</strong> },
  ];

  return (
    <ReportPanel
      title="كشف حساب المستأجر"
      description="دفتر حركة فعلي للعقد المحدد: افتتاحي، استحقاقات، تحصيلات/عكوس، رصيد جارٍ وختامي."
      icon={UserRound}
      action={statement ? (
        <ReportOutputActions
          downloadLabel="تنزيل كشف المستأجر PDF"
          menuLabel="خيارات إخراج كشف المستأجر"
          onDownloadPdf={onDownloadPdf}
          onPrint={onPrint}
          onDownloadExcel={onDownloadExcel}
          disabled={actionsDisabled}
        />
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المستأجر.')} /></div>
      ) : selectedContractId && statement?.error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(statement.error, 'تعذر تحميل كشف المستأجر.')} /></div>
      ) : selectedContractId && statement && ledgerRows.length > 0 ? (
        <div className="space-y-4 p-3 sm:p-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-black">{statement.tenantName ?? 'مستأجر غير محدد'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {statement.propertyName ?? 'عقار غير محدد'} · {statement.unitName ?? 'وحدة غير محددة'} · {statement.startDate ?? '—'} إلى {statement.endDate ?? '—'}
            </p>
            {statement.tenantPhone ? <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{statement.tenantPhone}</p> : null}
          </div>
          <ResponsiveCardGrid>
            <KpiCard label="الرصيد الافتتاحي" value={formatMoney(opening)} icon={WalletCards} accent="slate" compact />
            <KpiCard label="إجمالي الاستحقاقات" value={formatMoney(totalDebit)} icon={ReceiptText} accent="primary" compact />
            <KpiCard label="إجمالي التحصيل/الدائن" value={formatMoney(totalCredit)} icon={WalletCards} accent="emerald" compact />
            <KpiCard label="الرصيد الختامي" value={formatMoney(statement.finalBalance)} icon={Scale} accent={statement.finalBalance > 0 ? 'amber' : 'emerald'} compact />
          </ResponsiveCardGrid>
          <EntityTable
            aria-label="حركات كشف حساب المستأجر"
            rows={ledgerRows}
            columns={tenantColumns}
            keyOf={(row) => row.rowKey}
            emptyTitle="لا توجد حركات في كشف المستأجر"
            emptyDescription="غيّر العقد أو نطاق التقرير ثم أعد المحاولة."
          />
        </div>
      ) : selectedContractId ? (
        <div className="p-4"><ReportState message="لا توجد حركات في كشف المستأجر لهذا العقد." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.contractId}
              title={row.tenantName ?? 'مستأجر غير محدد'}
              subtitle={`${formatLatinNumber(row.invoiceCount, 'ar')} فواتير`}
              meta={`متأخر ${formatMoney(row.totalOverdue)}`}
              value={<span dir="ltr">{formatMoney(row.totalOutstanding)}</span>}
            />
          ))}
          {receipts.slice(0, 3).map((receipt) => (
            <ReportListRow
              key={`receipt-${receipt.id}`}
              title={<a className="inline-flex min-h-11 items-center hover:text-primary hover:underline" href={createReceiptPrintHref(receipt.id)}>{receipt.receipt_number}</a>}
              subtitle={receipt.tenant_name ?? 'مستأجر غير محدد'}
              value={<span dir="ltr">{formatMoney(receipt.amount)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر عقدًا من فلاتر التقرير لعرض كشف المستأجر الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}

/**
 * OwnerStatementPanel — mirrors the canonical printed owner statement.
 *
 * The workspace keeps `EntityTable` for the potentially long daily movement
 * ledger, but every statement section around it comes from the SAME premium
 * payload used by print/PDF (`loadPremiumOwnerReportPayload`). That payload
 * owns the authoritative summary, property/unit context, maintenance,
 * recorded expenses, utilities/services, management fees, settlements and
 * final reconciliation. No formula, RPC or accounting semantic is duplicated
 * here.
 */
export function OwnerStatementPanel({
  selectedOwnerId,
  statement,
  error,
  isLoading,
  fallbackRows,
  period,
  onPrint,
  onDownloadPdf,
  onDownloadExcel,
  actionsDisabled = false,
}: Readonly<{
  selectedOwnerId: string;
  statement: OwnerStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: OwnerFallbackRow[];
  period: { from?: string; to?: string; propertyId?: string };
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadExcel: () => void;
  actionsDisabled?: boolean;
}>) {
  const ledgerRows: OwnerLedgerRow[] = (statement?.transactions ?? []).map((transaction, index) => ({
    ...transaction,
    rowKey: `${transaction.date ?? 'line'}-${index}`,
  }));
  const properties = [...new Set(ledgerRows.map((row) => row.propertyName).filter((value): value is string => Boolean(value)))];
  const ownerColumns: ColumnDef<OwnerLedgerRow>[] = [
    { key: 'date', header: 'التاريخ', priority: 'identity', render: (row) => <span dir="ltr" className="tabular-nums">{row.date ?? '—'}</span> },
    { key: 'type', header: 'نوع الحركة', priority: 'secondary', render: (row) => ownerLineType(row.type) },
    { key: 'property', header: 'العقار', priority: 'secondary', render: (row) => row.propertyName ?? 'غير محدد' },
    { key: 'details', header: 'البيان', priority: 'secondary', render: (row) => row.details ?? 'حركة مالية' },
    { key: 'gross', header: 'إجمالي', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.gross)}</span> },
    { key: 'deduction', header: 'استقطاع', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.deduction)}</span> },
    { key: 'net', header: 'صافي الحركة', priority: 'primary', render: (row) => <strong dir="ltr">{formatMoney(row.net)}</strong> },
  ];

  const hasOwnerStatement = Boolean(selectedOwnerId && statement && !statement.error);
  const [fullStatement, setFullStatement] = useState<OwnerReportPayload | null>(null);
  const [isLoadingFullStatement, setIsLoadingFullStatement] = useState(false);
  const [fullStatementError, setFullStatementError] = useState<unknown>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!hasOwnerStatement || !selectedOwnerId || !statement || !period.from || !period.to) {
      requestIdRef.current += 1;
      setFullStatement(null);
      setFullStatementError(null);
      setIsLoadingFullStatement(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoadingFullStatement(true);
    setFullStatementError(null);

    loadPremiumOwnerReportPayload({
      ownerId: selectedOwnerId,
      from: period.from,
      to: period.to,
      propertyId: period.propertyId ?? null,
      statement,
    })
      .then((payload) => {
        if (requestIdRef.current !== requestId) return;
        setFullStatement(payload);
      })
      .catch((loadError: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setFullStatementError(loadError);
        setFullStatement(null);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setIsLoadingFullStatement(false);
      });
  }, [hasOwnerStatement, selectedOwnerId, statement, period.from, period.to, period.propertyId]);

  const summaryGroup = fullStatement?.groups.find((group) => group.blocks.some((block) => block.kind === 'kpis')) ?? null;
  const supplementalGroups = fullStatement?.groups.filter((group) => {
    if (group === summaryGroup) return false;
    return !group.blocks.some(
      (block) => block.kind === 'table' && block.table.title === 'الحركة المالية اليومية التفصيلية',
    );
  }) ?? [];

  return (
    <ReportPanel
      title="كشف حساب المالك"
      description="كشف تشغيلي ومالي موحّد يطابق بنية نسخة الطباعة: الملخص، الحركة اليومية، الصيانة والمصروفات والمرافق، التسويات والحساب الختامي."
      icon={UsersRound}
      action={statement ? (
        <ReportOutputActions
          downloadLabel="تنزيل كشف المالك PDF"
          menuLabel="خيارات إخراج كشف المالك"
          onDownloadPdf={onDownloadPdf}
          onPrint={onPrint}
          onDownloadExcel={onDownloadExcel}
          disabled={actionsDisabled}
        />
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المالك.')} /></div>
      ) : selectedOwnerId && statement?.error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(statement.error, 'تعذر تحميل كشف المالك.')} /></div>
      ) : hasOwnerStatement && statement ? (
        <div className="space-y-4 p-3 sm:p-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-black">{statement.ownerName ?? 'مالك غير محدد'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              الفترة: {statement.periodFrom ?? period.from ?? '—'} إلى {statement.periodTo ?? period.to ?? '—'} · العمولة: {ownerCommissionSummary(statement.commissionType, statement.commissionValue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              نطاق العقارات: {fullStatement?.scopeLabel ?? (properties.length ? properties.join('، ') : 'جميع عقارات المالك المُدارة')}
            </p>
          </div>

          {isLoadingFullStatement ? (
            <ReportPanelSkeleton />
          ) : fullStatementError ? (
            <ReportState
              kind="error"
              message={getErrorMessage(fullStatementError, 'تعذر تحميل الملخص والتفاصيل الإضافية لكشف المالك. تظل الحركة المالية الأساسية متاحة أدناه.')}
            />
          ) : summaryGroup ? (
            <ReportPayloadGroup group={summaryGroup} />
          ) : null}

          <div>
            <p className="mb-2 text-xs font-black text-muted-foreground">الحركة المالية اليومية</p>
            <EntityTable
              aria-label="حركات كشف حساب المالك"
              rows={ledgerRows}
              columns={ownerColumns}
              keyOf={(row) => row.rowKey}
              emptyTitle="لا توجد حركات مالية في الفترة"
              emptyDescription="قد تظل أقسام الصيانة أو المرافق أو التسويات متاحة أدناه إذا كان لها سجل في الفترة."
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              الرصيد الجاري لا يُعرض لأن سلطة كشف المالك الحالية لا توفّر رصيد افتتاح معتمدًا. لا يعيد هذا العرض احتساب أي رقم مالي.
            </p>
          </div>

          {!isLoadingFullStatement && !fullStatementError && supplementalGroups.length > 0 ? (
            <div className="space-y-5 border-t border-border/60 pt-4">
              {supplementalGroups.map((group, index) => (
                <ReportPayloadGroup key={index} group={group} />
              ))}
            </div>
          ) : null}
        </div>
      ) : selectedOwnerId ? (
        <div className="p-4"><ReportState message="لا توجد بيانات كشف مالك معتمدة للفترة المحددة." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.propertyId}
              title={row.propertyTitle ?? 'عقار غير محدد'}
              subtitle={`${formatLatinNumber(row.count, 'ar')} حركة مصروفات`}
              value={<span dir="ltr">{formatMoney(row.total)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر مالكًا من فلاتر التقرير لعرض كشف المالك الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}
