import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Ban, CalendarDays, CheckCircle2, Printer, ReceiptText, Wallet, WalletCards } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { EntityCard } from '@/components/ui/entity-card';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import type { AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatMoney, formatShortId, getErrorMessage } from '../components/financials-formatters';
import { ReceiptDetailCard } from '../components/receipt-detail-card';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from '../components/receipt-formatters';
import type { ReceiptRecord } from './receiptService';
import { ReceiptDetailPage } from './receipt-detail-page';
import { useReceipt, useReceipts, useVoidReceipt } from './useReceipts';

type MethodFilter = 'all' | ReceiptRecord['payment_method'];

function getReceiptIdFromSearch(search: Record<string, unknown>) {
  return typeof search.receiptId === 'string' ? search.receiptId : '';
}

function isWithinDate(receipt: ReceiptRecord, from: string, to: string) {
  return (!from || receipt.payment_date >= from) && (!to || receipt.payment_date <= to);
}

export function canVoidReceipts(authorization: AuthorizationContext | null | undefined) {
  return authorization?.role === 'ADMIN' || authorization?.role === 'MANAGER';
}


function receiptStatusTone(status: string): 'green' | 'gray' | 'red' | 'gold' {
  if (status === 'posted') return 'green';
  if (status === 'void' || status === 'voided' || status === 'cancelled') return 'red';
  if (status === 'draft') return 'gray';
  return 'gold';
}

export function createReceiptPrintHref(receiptId: string) {
  return `/receipts?receiptId=${encodeURIComponent(receiptId)}`;
}

function createVoidRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `void-${Date.now()}`;
}

// ─── void dialog ─────────────────────────────────────────────────────────────

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
  return (
    <Dialog open={Boolean(state.receipt)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <Ban className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-black">
              {`إلغاء الإيصال ${state.receipt?.receipt_number ?? ''}`}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
              أدخل سبب الإلغاء لتوثيق العملية.
            </DialogDescription>
          </div>
        </div>
        <div className="mb-4 space-y-2">
          <label className="block text-sm font-bold">سبب الإلغاء <span className="text-destructive">*</span></label>
          <Input
            value={state.reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="مثال: خطأ في المبلغ، دفعة مكررة..."
            autoFocus
          />
          {!state.reason.trim() && (
            <p className="text-xs text-destructive">السبب مطلوب لإتمام الإلغاء</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>إلغاء</Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isLoading || !state.reason.trim()}
          >
            {isLoading ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── main content ────────────────────────────────────────────────────────────

function ReceiptsHistoryContent() {
  const { authorization } = useAuth();
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<MethodFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voidDialog, setVoidDialog] = useState<VoidDialogState>({ receipt: null, reason: '' });

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const receiptsQuery = useReceipts({ limit: 100 });
  const selectedDetailQuery = useReceipt(selectedReceiptId);
  const voidReceiptMutation = useVoidReceipt();
  const canVoidReceipt = canVoidReceipts(authorization);

  const receipts = receiptsQuery.data ?? [];
  const filteredReceipts = useMemo(() => receipts.filter((receipt) => {
    const haystack = `${receipt.receipt_number} ${receipt.reference_number ?? ''} ${receipt.tenant_name ?? ''} ${receipt.property_title ?? ''} ${receipt.unit_number ?? ''} ${formatShortId(receipt.invoice_id)}`.toLowerCase();
    return (deferredQuery.length === 0 || haystack.includes(deferredQuery))
      && (method === 'all' || receipt.payment_method === method)
      && isWithinDate(receipt, from, to);
  }), [deferredQuery, from, method, receipts, to]);

  const totalAmount = filteredReceipts.reduce((total, receipt) => total + receipt.amount, 0);
  const selectedReceipt = selectedDetailQuery.data;

  const openVoidDialog = (receipt: ReceiptRecord) => setVoidDialog({ receipt, reason: '' });
  const closeVoidDialog = () => setVoidDialog({ receipt: null, reason: '' });

  const handleConfirmVoid = () => {
    if (!voidDialog.receipt || !voidDialog.reason.trim()) return;
    voidReceiptMutation.mutate(
      { receipt_id: voidDialog.receipt.id, reason: voidDialog.reason.trim(), request_id: createVoidRequestId() },
      { onSettled: closeVoidDialog },
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="الإيصالات"
        description="مراجعة إيصالات الدفعات المنشورة، فتح تفاصيل الإيصال، واستخدام أمر الطباعة عند الحاجة."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild><Link to="/financials"><ArrowRight className="me-2 size-4" />المالية</Link></Button>
            {selectedReceiptId ? <Button asChild><a href={createReceiptPrintHref(selectedReceiptId)}><Printer className="me-2 size-4" />طباعة المحدد</a></Button> : null}
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="الإيصالات المعروضة" value={filteredReceipts.length} sub="ضمن الفلاتر الحالية" icon={ReceiptText} accent="primary" />
        <KpiCard label="إجمالي التحصيل" value={formatMoney(totalAmount)} sub="من الإيصالات المعروضة" icon={WalletCards} accent="emerald" />
        <KpiCard label="أحدث النتائج" value={receipts.length} sub="آخر 100 إيصال" icon={CalendarDays} accent="sky" />
        <KpiCard label="الإيصال المحدد" value={selectedReceipt?.receipt_number ?? '—'} sub="جاهز للعرض والطباعة" icon={Printer} accent="violet" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>فلاتر الإيصالات</CardTitle>
          <CardDescription>ابحث برقم الإيصال أو رقم المرجع أو اسم المستأجر أو العقار.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="رقم الإيصال REC-، المرجع، المستأجر، العقار"
            />
          </div>
          <label className="space-y-1 text-sm font-bold">
            <span>طريقة الدفع</span>
            <Select value={method} onChange={(e) => setMethod(e.target.value as MethodFilter)}>
              <option value="all">كل الطرق</option>
              {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold"><span>من تاريخ</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="space-y-1 text-sm font-bold"><span>إلى تاريخ</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>تاريخ الإيصالات</CardTitle>
          <CardDescription>اختر إيصالاً لعرض تفاصيله وروابط الطباعة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AsyncContentState
            status={
              receiptsQuery.isLoading ? 'loading'
              : receiptsQuery.isError ? 'error'
              : filteredReceipts.length === 0 ? 'empty'
              : 'ready'
            }
            error={receiptsQuery.error}
            errorTitle="تعذر تحميل الإيصالات"
            emptyTitle="لا توجد إيصالات مطابقة"
            emptyDescription="غيّر البحث أو الفلاتر لعرض إيصالات أخرى."
          >

          {filteredReceipts.length > 0 && (
            <>
              {/* Mobile cards */}
              <div className="grid gap-3 sm:grid-cols-2 md:hidden">
                {filteredReceipts.map((receipt) => (
                  <div key={receipt.id} className="space-y-1.5">
                    <EntityCard
                      id={receipt.id}
                      name={`إيصال #${receipt.receipt_number}`}
                      subtitle={formatDate(receipt.payment_date)}
                      avatarIcon={Printer}
                      badge={<StatusBadge tone={receiptStatusTone(receipt.status)} className="shrink-0"><CheckCircle2 className="size-3" />{receiptStatusLabels[receipt.status] ?? receipt.status}</StatusBadge>}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      stats={(
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Wallet className="size-3.5 shrink-0" />
                              <span>{paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}</span>
                            </div>
                            <div className="truncate">{formatReceiptContext(receipt)}</div>
                            <div className="text-[10px] text-muted-foreground/70">ف#{formatShortId(receipt.invoice_id)}</div>
                          </div>
                          <p className="whitespace-nowrap text-sm font-black text-emerald-600 dark:text-emerald-400">{formatMoney(receipt.amount)}</p>
                        </div>
                      )}
                    />
                    <div className="flex flex-wrap gap-2 px-1">
                      <Button variant="secondary" className="h-9" onClick={() => setSelectedReceiptId(receipt.id)}>عرض</Button>
                      <Button variant="secondary" className="h-9" asChild>
                        <a href={createReceiptPrintHref(receipt.id)}><Printer className="me-1 size-3.5" />طباعة</a>
                      </Button>
                      {canVoidReceipt && (
                        <Button variant="danger" className="h-9" onClick={() => openVoidDialog(receipt)} disabled={voidReceiptMutation.isPending}>
                          <Ban className="me-1 size-3.5" />إلغاء
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <EntityTable
                  aria-label="جدول الإيصالات"
                  rows={filteredReceipts}
                  columns={[
                    { key: 'receipt_number', header: 'رقم الإيصال', render: (r) => <span className="font-black">{r.receipt_number}</span> },
                    { key: 'payment_date', header: 'تاريخ الدفع', render: (r) => formatDate(r.payment_date) },
                    { key: 'amount', header: 'المبلغ', render: (r) => <span dir="ltr" className="block font-bold">{formatMoney(r.amount)}</span> },
                    { key: 'method', header: 'طريقة الدفع', render: (r) => paymentMethodLabels[r.payment_method] ?? r.payment_method },
                    { key: 'invoice_id', header: 'الفاتورة', render: (r) => formatShortId(r.invoice_id) },
                    { key: 'context', header: 'السياق', render: (r) => formatReceiptContext(r) },
                    { key: 'status', header: 'الحالة', render: (r) => <StatusBadge tone={receiptStatusTone(r.status)}>{receiptStatusLabels[r.status] ?? r.status}</StatusBadge> },
                    { key: 'actions', header: 'الإجراءات', render: (r) => (
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" className="min-h-10 px-3" onClick={() => setSelectedReceiptId(r.id)}>عرض</Button>
                        <Button variant="secondary" className="min-h-10 px-3" asChild>
                          <a href={createReceiptPrintHref(r.id)}><Printer className="me-2 size-4" />طباعة</a>
                        </Button>
                        {canVoidReceipt && (
                          <Button variant="danger" className="min-h-10 px-3" onClick={() => openVoidDialog(r)} disabled={voidReceiptMutation.isPending}>
                            <Ban className="me-2 size-4" />إلغاء
                          </Button>
                        )}
                      </div>
                    )},
                  ] as ColumnDef<ReceiptRecord>[]}
                  keyOf={(r) => r.id}
                  emptyTitle="لا توجد إيصالات"
                  emptyDescription="لا توجد إيصالات تطابق معايير البحث الحالية."
                />
              </div>
            </>
          )}

          </AsyncContentState>

          <ReceiptDetailCard
            selectedReceiptId={selectedReceiptId}
            receiptDetail={selectedDetailQuery.data}
            isLoading={selectedDetailQuery.isLoading}
            isError={selectedDetailQuery.isError}
            error={selectedDetailQuery.error}
          />
        </CardContent>
      </Card>

      {/* Void confirmation dialog */}
      <VoidReceiptDialog
        state={voidDialog}
        isLoading={voidReceiptMutation.isPending}
        onClose={closeVoidDialog}
        onConfirm={handleConfirmVoid}
        onReasonChange={(reason) => setVoidDialog((v) => ({ ...v, reason }))}
      />
    </div>
  );
}

export function ReceiptsPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptIdFromSearch = getReceiptIdFromSearch(searchParams);
  return receiptIdFromSearch ? <ReceiptDetailPage /> : <ReceiptsHistoryContent />;
}
