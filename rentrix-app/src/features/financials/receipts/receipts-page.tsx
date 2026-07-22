import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Ban, CalendarDays, CheckCircle2, Eye, Printer, ReceiptText, Wallet, WalletCards } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileCard } from '@/components/ui/mobile-card';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
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
import { useReceipt, useReceipts, useVoidReceipt } from './useReceipts';

// Keep the public helper reachable from this page (used by tests and older call sites).
export { createReceiptPrintHref };

type MethodFilter = 'all' | ReceiptRecord['payment_method'];

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
  const loaded = loadedCount.toLocaleString('ar');
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

function receiptStatusTone(status: string): 'green' | 'gray' | 'red' | 'gold' {
  if (status === 'posted') return 'green';
  if (status === 'void' || status === 'voided' || status === 'cancelled') return 'red';
  if (status === 'draft') return 'gray';
  return 'gold';
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
      title={`إلغاء الإيصال ${state.receipt?.receipt_number ?? ''}`}
      description="أدخل سبب الإلغاء لتوثيق العملية. يتم تحديث الدفعة والفاتورة وإنشاء القيد العكسي داخل عملية ذرية واحدة."
      headerExtra={<StatusBadge tone="red"><Ban className="me-1 size-3" aria-hidden="true" />إجراء حساس</StatusBadge>}
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
        <EntityForm.Section title="سبب الإلغاء" description="اكتب سبباً واضحاً يمكن الرجوع إليه في سجل التدقيق.">
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
          submitLabel={isLoading ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
          onCancel={onClose}
          isSubmitting={isLoading}
          submitDisabled={reasonMissing}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

function ReceiptsHistoryContent() {
  const { authorization } = useAuth();
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<MethodFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voidDialog, setVoidDialog] = useState<VoidDialogState>({ receipt: null, reason: '' });
  const [receiptsLimit, setReceiptsLimit] = useState(RECEIPTS_PAGE_SIZE);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const receiptsQuery = useReceipts({ limit: receiptsLimit });
  const selectedDetailQuery = useReceipt(selectedReceiptId);
  const voidReceiptMutation = useVoidReceipt();
  const canVoidReceipt = canVoidReceipts(authorization);

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
    voidReceiptMutation.mutate(
      {
        receipt_id: voidDialog.receipt.id,
        reason: voidDialog.reason.trim(),
        request_id: createVoidRequestId(),
      },
      { onSettled: closeVoidDialog },
    );
  };

  const receiptColumns: ColumnDef<ReceiptRecord>[] = [
    { key: 'receipt_number', header: 'رقم الإيصال', render: (receipt) => <span className="font-black">{receipt.receipt_number}</span> },
    { key: 'payment_date', header: 'تاريخ الدفع', render: (receipt) => formatDate(receipt.payment_date) },
    { key: 'amount', header: 'المبلغ', render: (receipt) => <span dir="ltr" className="block font-bold tabular-nums">{formatMoney(receipt.amount)}</span> },
    { key: 'method', header: 'طريقة الدفع', render: (receipt) => paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method },
    { key: 'invoice_id', header: 'الفاتورة', render: (receipt) => formatShortId(receipt.invoice_id) },
    { key: 'context', header: 'السياق', render: (receipt) => formatReceiptContext(receipt) },
    { key: 'status', header: 'الحالة', render: (receipt) => <StatusBadge tone={receiptStatusTone(receipt.status)}>{receiptStatusLabels[receipt.status] ?? receipt.status}</StatusBadge> },
    { key: 'actions', header: 'الإجراءات', render: (receipt) => (
      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Button variant="secondary" className="min-h-10 px-3" onClick={() => setSelectedReceiptId(receipt.id)}>عرض</Button>
        <Button variant="secondary" className="min-h-10 px-3" onClick={() => openReceiptPrintView(receipt.id)}><Printer className="me-2 size-4" />طباعة</Button>
        {canVoidReceipt && receipt.status === 'posted' ? (
          <Button variant="danger" className="min-h-10 px-3" onClick={() => openVoidDialog(receipt)} disabled={voidReceiptMutation.isPending}>
            <Ban className="me-2 size-4" />إلغاء
          </Button>
        ) : null}
      </div>
    ) },
  ];

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="الإيصالات"
        description="مراجعة إيصالات الدفعات المنشورة، فتح التفاصيل والطباعة، وإدارة الإلغاء وفق الصلاحيات."
        secondaryActions={<Button variant="secondary" asChild><Link to="/financials"><ArrowRight className="me-2 size-4" />المالية</Link></Button>}
        primaryAction={selectedReceiptId ? (
          <Button onClick={() => openReceiptPrintView(selectedReceiptId)}><Printer className="me-2 size-4" />طباعة المحدد</Button>
        ) : undefined}
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="الإيصالات المعروضة" value={filteredReceipts.length} sub="ضمن الفلاتر الحالية" icon={ReceiptText} accent="primary" />
        <KpiCard label="إجمالي التحصيل" value={formatMoney(totalAmount)} sub="الإيصالات المنشورة فقط" icon={WalletCards} accent="emerald" />
        <KpiCard label="أحدث النتائج" value={receipts.length} sub={hasMoreReceipts ? `ضمن أحدث ${receiptsLimit.toLocaleString('ar')} إيصال` : 'كل الإيصالات المتاحة'} icon={CalendarDays} accent="sky" />
        <KpiCard label="تحصيل اليوم" value={formatMoney(todayCollectedAmount)} sub={`${todayReceiptCount.toLocaleString('ar')} إيصال منشور اليوم`} icon={Wallet} accent="emerald" />
      </ResponsiveCardGrid>

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
        actions={hasFilters ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQuery('');
              setMethod('all');
              setFrom('');
              setTo('');
            }}
          >
            مسح الفلاتر
          </Button>
        ) : undefined}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle>تاريخ الإيصالات</CardTitle>
          <CardDescription>اختر إيصالاً لعرض تفاصيله. على الهاتف تظهر البيانات الأساسية أولاً والإجراءات داخل البطاقة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-3 sm:p-5">
          <EntityTable
            aria-label="جدول الإيصالات"
            rows={filteredReceipts}
            columns={receiptColumns}
            keyOf={(receipt) => receipt.id}
            isLoading={receiptsQuery.isLoading}
            error={receiptsQuery.error}
            onRetry={() => { void receiptsQuery.refetch(); }}
            emptyTitle="لا توجد إيصالات مطابقة"
            emptyDescription={hasFilters ? 'غيّر البحث أو الفلاتر لعرض إيصالات أخرى.' : 'لا توجد إيصالات منشورة حتى الآن.'}
            onRowClick={(receipt) => setSelectedReceiptId(receipt.id)}
            renderMobileCard={(receipt) => (
              <MobileCard
                title={`إيصال #${receipt.receipt_number}`}
                subtitle={formatDate(receipt.payment_date)}
                badge={(
                  <StatusBadge tone={receiptStatusTone(receipt.status)} className="shrink-0">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    {receiptStatusLabels[receipt.status] ?? receipt.status}
                  </StatusBadge>
                )}
                onClick={() => setSelectedReceiptId(receipt.id)}
                stats={(
                  <div className="grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-bold"><Wallet className="size-4 shrink-0" aria-hidden="true" />{paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}</span>
                      <strong className="whitespace-nowrap text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(receipt.amount)}</strong>
                    </div>
                    <div className="line-clamp-2 leading-5">{formatReceiptContext(receipt)}</div>
                    <div className="text-[10px] text-muted-foreground/75">فاتورة #{formatShortId(receipt.invoice_id)}</div>
                  </div>
                )}
                actions={(
                  <div className="flex flex-wrap gap-2 w-full">
                    <Button variant="outline" size="sm" className="min-h-9 px-3 gap-1.5 text-xs font-bold" onClick={() => setSelectedReceiptId(receipt.id)}>
                      <Eye className="size-4" />
                      عرض
                    </Button>
                    <Button variant="outline" size="sm" className="min-h-9 px-3 gap-1.5 text-xs font-bold" onClick={() => openReceiptPrintView(receipt.id)}>
                      <Printer className="size-4" />
                      طباعة
                    </Button>
                    {canVoidReceipt && receipt.status === 'posted' ? (
                      <Button variant="danger" size="sm" className="min-h-9 px-3 gap-1.5 text-xs font-bold" onClick={() => openVoidDialog(receipt)}>
                        <Ban className="size-4" />
                        إلغاء
                      </Button>
                    ) : null}
                  </div>
                )}
              />
            )}
          />

          {(hasMoreReceipts || receiptsLimit > RECEIPTS_PAGE_SIZE) ? (
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row">
              <p className="text-xs font-bold text-muted-foreground" aria-live="polite">
                {describeReceiptsViewport(receipts.length, hasMoreReceipts)}
              </p>
              {hasMoreReceipts ? (
                <Button variant="outline" className="min-h-11 rounded-xl" onClick={loadMoreReceipts} disabled={receiptsQuery.isFetching}>
                  {receiptsQuery.isFetching ? 'جارٍ التحميل...' : `عرض ${RECEIPTS_PAGE_SIZE.toLocaleString('ar')} إيصال أقدم`}
                </Button>
              ) : null}
            </div>
          ) : null}

          <ReceiptDetailCard
            selectedReceiptId={selectedReceiptId}
            receiptDetail={selectedDetailQuery.data}
            isLoading={selectedDetailQuery.isLoading}
            isError={selectedDetailQuery.isError}
            error={selectedDetailQuery.error}
          />
        </CardContent>
      </Card>

      <VoidReceiptDialog
        state={voidDialog}
        isLoading={voidReceiptMutation.isPending}
        onClose={closeVoidDialog}
        onConfirm={handleConfirmVoid}
        onReasonChange={(reason) => setVoidDialog((current) => ({ ...current, reason }))}
      />
    </PageLayout>
  );
}

export function ReceiptsPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptIdFromSearch = getReceiptIdFromSearch(searchParams);
  return receiptIdFromSearch ? <ReceiptDetailPage /> : <ReceiptsHistoryContent />;
}
