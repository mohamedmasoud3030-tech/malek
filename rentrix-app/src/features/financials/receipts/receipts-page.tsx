import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Ban, CalendarDays, CheckCircle2, Clock3, Eye, Printer, ReceiptText, ShieldCheck, Wallet, WalletCards } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { RegisterHeading, RegisterMetricStrip } from '@/components/layout/register-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { canAccess, financialOperationPermissions, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatMoney, formatShortId } from '../components/financials-formatters';
import { getTodayLocalDateString } from '../financials-date-utils';
import { ReceiptDetailCard } from '../components/receipt-detail-card';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from '../components/receipt-formatters';
import type { ReceiptRecord } from './receiptService';
import { ReceiptDetailPage } from './receipt-detail-page';
import { createReceiptPrintHref, openReceiptPrintTab } from './receipt-print';
import { useApproveReceiptVoid, usePendingReceiptVoidRequests, useReceipt, useReceipts, useRequestReceiptVoid } from './useReceipts';
import { formatLatinNumber } from '@/lib/formatters';

// Keep the public helper reachable from this page (used by tests and older call sites).
export { createReceiptPrintHref };

type MethodFilter = 'all' | ReceiptRecord['payment_method'];

const receiptColumnOptions = [
  { key: 'receipt_number', label: 'رقم الإيصال', locked: true },
  { key: 'payment_date', label: 'تاريخ الدفع' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'method', label: 'طريقة الدفع' },
  { key: 'invoice_id', label: 'الفاتورة' },
  { key: 'context', label: 'السياق' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'الإجراءات', locked: true },
] as const;

const defaultReceiptColumns = receiptColumnOptions.map((column) => column.key);

function getReceiptIdFromSearch(search: Record<string, unknown>) {
  return typeof search.receiptId === 'string' ? search.receiptId : '';
}

function isWithinDate(receipt: ReceiptRecord, from: string, to: string) {
  return (!from || receipt.payment_date >= from) && (!to || receipt.payment_date <= to);
}

export function canVoidReceipts(authorization: AuthorizationContext | null | undefined) {
  return canAccess(authorization, financialOperationPermissions.voidReceipt);
}

/** Receipts are fetched in a growing window (newest first) — one step per «عرض المزيد». */
export const RECEIPTS_PAGE_SIZE = 100;

/** More history may exist only when the last fetch returned a FULL window. */
export function canLoadMoreReceipts(fetchedCount: number, limit: number) {
  return fetchedCount >= limit;
}

export function nextReceiptsLimit(limit: number, step: number = RECEIPTS_PAGE_SIZE) {
  return limit + step;
}

export function describeReceiptsViewport(loadedCount: number, canLoadMore: boolean) {
  const loaded = formatLatinNumber(loadedCount, 'ar');
  return canLoadMore
    ? `يعرض أحدث ${loaded} إيصال — توجد إيصالات أقدم لم تُحمّل بعد`
    : `يعرض كل الإيصالات المتاحة (${loaded})`;
}

export function sumPostedReceiptAmount(receipts: readonly ReceiptRecord[]) {
  return receipts.reduce(
    (total, receipt) => total + (receipt.status === 'posted' ? receipt.amount : 0),
    0,
  );
}

export function sumPostedReceiptsForDate(receipts: readonly ReceiptRecord[], day: string) {
  return receipts.reduce(
    (total, receipt) => total + (receipt.status === 'posted' && receipt.payment_date === day ? receipt.amount : 0),
    0,
  );
}

export function countPostedReceiptsForDate(receipts: readonly ReceiptRecord[], day: string) {
  return receipts.filter((receipt) => receipt.status === 'posted' && receipt.payment_date === day).length;
}

function receiptStatusTone(status: string): 'success' | 'neutral' | 'danger' | 'warning' {
  if (status === 'posted') return 'success';
  if (status === 'void' || status === 'voided' || status === 'cancelled') return 'danger';
  if (status === 'draft') return 'neutral';
  return 'warning';
}

function createVoidRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `void-${Date.now()}`;
}

interface VoidDialogState {
  receipt: ReceiptRecord | null;
  reason: string;
}

function VoidReceiptDialog({
  state,
  isLoading,
  onClose,
  onConfirm,
  onReasonChange,
}: Readonly<{
  state: VoidDialogState;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
}>) {
  const reasonMissing = state.reason.trim().length === 0;

  return (
    <EntityForm.Overlay
      open={Boolean(state.receipt)}
      onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}
      title={`طلب إلغاء الإيصال ${state.receipt?.receipt_number ?? ''}`}
      description="أدخل سبباً واضحاً. سيظل الإيصال منشوراً حتى يراجع الطلب مستخدم مخوّل آخر ويعتمده."
      headerExtra={<StatusBadge tone="danger"><Ban className="me-1 size-3" aria-hidden="true" />إجراء حساس</StatusBadge>}
      className="max-w-lg"
    >
      <EntityForm.Root
        aria-busy={isLoading}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <EntityForm.ErrorSummary message={reasonMissing ? 'سبب الإلغاء مطلوب لإتمام العملية.' : undefined} />
        <EntityForm.Section title="سبب طلب الإلغاء" description="يُحفظ السبب وهوية مقدم الطلب في سجل التدقيق ولا يمكن اعتماد الطلب من الشخص نفسه.">
          <EntityForm.Field label="السبب">
            <Input
              value={state.reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="مثال: خطأ في المبلغ أو دفعة مكررة"
              autoFocus
              aria-invalid={reasonMissing}
            />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={isLoading ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الإلغاء'}
          onCancel={onClose}
          isSubmitting={isLoading}
          submitDisabled={reasonMissing}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

function ReceiptsHistoryContent({ embedded, initialSelectedReceiptId = '' }: Readonly<{ embedded: boolean; initialSelectedReceiptId?: string }>) {
  const { authorization } = useAuth();
  const [selectedReceiptId, setSelectedReceiptId] = useState(initialSelectedReceiptId);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<MethodFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voidDialog, setVoidDialog] = useState<VoidDialogState>({ receipt: null, reason: '' });
  const [receiptsLimit, setReceiptsLimit] = useState(RECEIPTS_PAGE_SIZE);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultReceiptColumns]);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const receiptsQuery = useReceipts({ limit: receiptsLimit });
  const selectedDetailQuery = useReceipt(selectedReceiptId);
  const canVoidReceipt = canVoidReceipts(authorization);
  const pendingVoidRequestsQuery = usePendingReceiptVoidRequests(canVoidReceipt);
  const requestVoidMutation = useRequestReceiptVoid();
  const approveVoidMutation = useApproveReceiptVoid();

  const receipts = receiptsQuery.data ?? [];
  const hasMoreReceipts = canLoadMoreReceipts(receipts.length, receiptsLimit);
  const loadMoreReceipts = () => setReceiptsLimit((current) => nextReceiptsLimit(current));
  const filteredReceipts = useMemo(() => receipts.filter((receipt) => {
    const haystack = `${receipt.receipt_number} ${receipt.reference_number ?? ''} ${receipt.tenant_name ?? ''} ${receipt.property_title ?? ''} ${receipt.unit_number ?? ''} ${formatShortId(receipt.invoice_id)}`.toLowerCase();
    return (deferredQuery.length === 0 || haystack.includes(deferredQuery))
      && (method === 'all' || receipt.payment_method === method)
      && isWithinDate(receipt, from, to);
  }), [deferredQuery, from, method, receipts, to]);

  const totalAmount = sumPostedReceiptAmount(filteredReceipts);
  const todayString = getTodayLocalDateString();
  const todayCollectedAmount = sumPostedReceiptsForDate(receipts, todayString);
  const todayReceiptCount = countPostedReceiptsForDate(receipts, todayString);
  const hasFilters = query.trim().length > 0 || method !== 'all' || from.length > 0 || to.length > 0;

  const openVoidDialog = (receipt: ReceiptRecord) => setVoidDialog({ receipt, reason: '' });
  const closeVoidDialog = () => setVoidDialog({ receipt: null, reason: '' });
  // Keep the cashier's filtered list untouched by printing in a new tab.
  const openReceiptPrintView = (receiptId: string) => openReceiptPrintTab(receiptId);

  const handleConfirmVoid = () => {
    if (!voidDialog.receipt || voidDialog.receipt.status !== 'posted' || !voidDialog.reason.trim()) return;
    requestVoidMutation.mutate(
      {
        receipt_id: voidDialog.receipt.id,
        reason: voidDialog.reason.trim(),
        request_id: createVoidRequestId(),
      },
      { onSettled: closeVoidDialog },
    );
  };

  const handleApproveVoid = (voidRequestId: string) => {
    approveVoidMutation.mutate({
      void_request_id: voidRequestId,
      request_id: createVoidRequestId(),
    });
  };

  const receiptColumns: ColumnDef<ReceiptRecord>[] = [
    { key: 'receipt_number', header: 'رقم الإيصال', priority: 'identity', render: (receipt) => <span className="font-black">{receipt.receipt_number}</span> },
    { key: 'payment_date', header: 'تاريخ الدفع', priority: 'secondary', render: (receipt) => formatDate(receipt.payment_date) },
    { key: 'amount', header: 'المبلغ', priority: 'primary', render: (receipt) => <span dir="ltr" className="block font-bold tabular-nums">{formatMoney(receipt.amount)}</span> },
    { key: 'method', header: 'طريقة الدفع', priority: 'detail', render: (receipt) => paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method },
    { key: 'invoice_id', header: 'الفاتورة', priority: 'detail', render: (receipt) => formatShortId(receipt.invoice_id) },
    { key: 'context', header: 'السياق', priority: 'secondary', render: (receipt) => formatReceiptContext(receipt) },
    { key: 'status', header: 'الحالة', priority: 'secondary', render: (receipt) => <StatusBadge tone={receiptStatusTone(receipt.status)}>{receiptStatusLabels[receipt.status] ?? receipt.status}</StatusBadge> },
    { key: 'actions', header: 'الإجراءات', priority: 'actions', render: (receipt) => (
      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Button variant="secondary" className="min-h-11 px-3" onClick={() => setSelectedReceiptId(receipt.id)}>عرض</Button>
        <Button variant="secondary" className="min-h-11 px-3" onClick={() => openReceiptPrintView(receipt.id)}><Printer className="me-2 size-4" />طباعة</Button>
        {canVoidReceipt && receipt.status === 'posted' ? (
          <Button variant="danger" className="min-h-11 px-3" onClick={() => openVoidDialog(receipt)} disabled={requestVoidMutation.isPending}>
            <Ban className="me-2 size-4" />طلب إلغاء
          </Button>
        ) : null}
      </div>
    ) },
  ];

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      visualVariant="malek-pro"
      title="الإيصالات"

      secondaryActions={<Button variant="secondary" className="min-h-11" asChild><Link to="/financials"><ArrowRight className="me-2 size-4" />المالية</Link></Button>}
      primaryAction={selectedReceiptId ? (
        <Button onClick={() => openReceiptPrintView(selectedReceiptId)}><Printer className="me-2 size-4" />طباعة المحدد</Button>
      ) : undefined}
    >
      <RegisterMetricStrip
        aria-label="ملخص الإيصالات"
        items={[
          { id: 'shown', label: 'المعروضة', value: filteredReceipts.length, icon: ReceiptText, hideWhenEmpty: true },
          { id: 'total', label: 'التحصيل', value: formatMoney(totalAmount), icon: WalletCards },
          { id: 'today', label: 'تحصيل اليوم', value: formatMoney(todayCollectedAmount), hint: `${formatLatinNumber(todayReceiptCount, 'ar')} إيصال`, icon: Wallet, hideWhenEmpty: true },
        ]}
      />

      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="رقم الإيصال أو المرجع أو المستأجر أو العقار"
        searchAriaLabel="بحث في الإيصالات"
        filters={(
          <>
            <label className="grid gap-1 text-sm font-bold">
              <span className="sr-only">طريقة الدفع</span>
              <Select aria-label="طريقة الدفع" value={method} onChange={(event) => setMethod(event.target.value as MethodFilter)}>
                <option value="all">كل طرق الدفع</option>
                {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-bold"><span className="sr-only">من تاريخ</span><Input aria-label="من تاريخ" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-bold"><span className="sr-only">إلى تاريخ</span><Input aria-label="إلى تاريخ" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </>
        )}
        actions={(
          <>
            <DataTableColumnsMenu
              columns={receiptColumnOptions}
              visibleKeys={visibleColumnKeys}
              onChange={setVisibleColumnKeys}
            />
            {hasFilters ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 rounded-lg px-3 text-xs"
                onClick={() => {
                  setQuery('');
                  setMethod('all');
                  setFrom('');
                  setTo('');
                }}
              >
                مسح الفلاتر
              </Button>
            ) : null}
          </>
        )}
      />

      {canVoidReceipt && ((pendingVoidRequestsQuery.data ?? []).length > 0 || pendingVoidRequestsQuery.isLoading || pendingVoidRequestsQuery.isError) ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-warning/5">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-warning" aria-hidden="true" />
              طلبات إلغاء تنتظر المراجعة
            </CardTitle>
            <CardDescription>
              الإلغاء لا يُنفّذ إلا بعد اعتماد مستخدم مخوّل آخر. مقدم الطلب لا يستطيع اعتماد طلبه.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-5">
            {pendingVoidRequestsQuery.isLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">جارٍ تحميل طلبات المراجعة...</p>
            ) : pendingVoidRequestsQuery.isError ? (
              <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-destructive">تعذّر تحميل طلبات إلغاء الإيصالات.</p>
                <Button variant="secondary" onClick={() => { void pendingVoidRequestsQuery.refetch(); }}>إعادة المحاولة</Button>
              </div>
            ) : (pendingVoidRequestsQuery.data ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">لا توجد طلبات إلغاء معلّقة.</p>
            ) : (
              <div className="grid gap-3">
                {(pendingVoidRequestsQuery.data ?? []).map((request) => {
                  const isOwnRequest = request.requested_by === authorization?.userId;
                  return (
                    <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black">إيصال {formatShortId(request.receipt_id)}</span>
                          <StatusBadge tone="warning"><Clock3 className="me-1 size-3" aria-hidden="true" />قيد المراجعة</StatusBadge>
                          {isOwnRequest ? <StatusBadge tone="neutral">طلبك</StatusBadge> : null}
                        </div>
                        <p className="mt-1 text-sm">{request.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">تاريخ الطلب: {formatDate(request.requested_at)}</p>
                      </div>
                      {isOwnRequest ? (
                        <p className="text-xs font-bold text-muted-foreground">يلزم مستخدم مخوّل آخر للاعتماد</p>
                      ) : (
                        <Button
                          type="button"
                          variant="danger"
                          className="min-h-11"
                          onClick={() => handleApproveVoid(request.id)}
                          disabled={approveVoidMutation.isPending}
                        >
                          <ShieldCheck className="me-2 size-4" aria-hidden="true" />
                          {approveVoidMutation.isPending ? 'جارٍ الاعتماد...' : 'اعتماد وتنفيذ الإلغاء'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <section data-receipts-register className="min-w-0 space-y-2.5">
        <header className="flex min-h-11 items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
              <ReceiptText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black">سجل الإيصالات</h2>
              <p className="truncate text-xs font-medium text-muted-foreground">{filteredReceipts.length} إيصال ضمن النتائج الحالية</p>
            </div>
          </div>
        </header>

        <div className={selectedReceiptId ? 'grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] xl:items-start' : 'grid min-w-0 gap-4'}>
          <div className="min-w-0 space-y-2.5">
            <EntityTable
              aria-label="جدول الإيصالات"
              rows={filteredReceipts}
              columns={receiptColumns}
              visibleColumnKeys={visibleColumnKeys}
              keyOf={(receipt) => receipt.id}
              isLoading={receiptsQuery.isLoading}
              error={receiptsQuery.error}
              onRetry={() => { void receiptsQuery.refetch(); }}
              emptyTitle="لا توجد إيصالات مطابقة"
              emptyDescription={hasFilters ? 'غيّر البحث أو الفلاتر لعرض إيصالات أخرى.' : 'لا توجد إيصالات منشورة حتى الآن.'}
              onRowClick={(receipt) => setSelectedReceiptId(receipt.id)}
            />

            {(hasMoreReceipts || receiptsLimit > RECEIPTS_PAGE_SIZE) ? (
              <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 sm:flex-row">
                <p className="text-xs font-bold text-muted-foreground" aria-live="polite">
                  {describeReceiptsViewport(receipts.length, hasMoreReceipts)}
                </p>
                {hasMoreReceipts ? (
                  <Button variant="outline" className="min-h-11 rounded-lg" onClick={loadMoreReceipts} disabled={receiptsQuery.isFetching}>
                    {receiptsQuery.isFetching ? 'جارٍ التحميل...' : `عرض ${formatLatinNumber(RECEIPTS_PAGE_SIZE, 'ar')} إيصال أقدم`}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <ReceiptDetailCard
            selectedReceiptId={selectedReceiptId}
            receiptDetail={selectedDetailQuery.data}
            isLoading={selectedDetailQuery.isLoading}
            isError={selectedDetailQuery.isError}
            error={selectedDetailQuery.error}
          />
        </div>
      </section>

      <VoidReceiptDialog
        state={voidDialog}
        isLoading={requestVoidMutation.isPending}
        onClose={closeVoidDialog}
        onConfirm={handleConfirmVoid}
        onReasonChange={(reason) => setVoidDialog((current) => ({ ...current, reason }))}
      />
    </EmbeddableWorkspace>
  );
}

export type ReceiptsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /receipts, so it owns the page shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the receipts workspace body. Shared verbatim between the standalone
 * /receipts route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 *
 * `?receiptId=` opens the single-receipt document. Standalone that renders the
 * full-bleed printable view (the /receipts route keeps serving it directly, so
 * existing print links are untouched). Embedded, the hub already owns the page
 * shell, so the list stays visible and the selected receipt is shown inline
 * rather than nesting a second document shell inside a tab.
 */
export function ReceiptsWorkspace({ embedded = false }: ReceiptsWorkspaceProps) {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptIdFromSearch = getReceiptIdFromSearch(searchParams);

  if (!embedded && receiptIdFromSearch) return <ReceiptDetailPage />;

  return <ReceiptsHistoryContent embedded={embedded} initialSelectedReceiptId={receiptIdFromSearch} />;
}

export function ReceiptsPage() {
  return <ReceiptsWorkspace />;
}