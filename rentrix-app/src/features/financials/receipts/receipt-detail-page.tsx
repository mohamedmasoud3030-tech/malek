import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Printer, Share2, Copy, ExternalLink, Download } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { DataErrorScreen } from '@/components/data-error-screen';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { shareOrCopy } from '@/services/action-service';
import { documentService } from '@/services/documents/DocumentService';
import { toReceiptDocumentPayload } from '@/services/documents/documentPayloadAdapters';
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { formatDate, formatMoney } from '../components/financials-formatters';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from '../components/receipt-formatters';
import { toFinancialNumber } from '../financialMath';
import { useReceipt } from './useReceipts';

/** A receipt cannot be issued before its authoritative row is loaded. */
const MISSING_RECEIPT_MESSAGE = 'تعذر إصدار الإيصال: لم يتم تحميل بيانات الإيصال بعد. يرجى الانتظار حتى اكتمال التحميل ثم إعادة المحاولة.';

function receiptDetailStatusTone(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'posted') return 'success';
  if (status === 'void') return 'danger';
  return 'warning';
}

function ReceiptPageHeader({ description = 'جارٍ تحميل بيانات الإيصال...' }: Readonly<{ description?: string }>) {
  return (
    <PageHeader
      title="إيصال استلام نقدية"
      description={description}
      backTo="/financials"
      backLabel="المالية"
    />
  );
}

export function ReceiptDetailPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptId = typeof searchParams.receiptId === 'string' ? searchParams.receiptId : '';
  const receiptQuery = useReceipt(receiptId);
  const documentSettings = useDocumentSettings();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const receipt = receiptQuery.data;
  // A stale receipt may have been voided since the cached read. Do not issue,
  // print, or download it until the authoritative refresh succeeds.
  const canUseReceiptDocument = documentSettings.isReady && !receiptQuery.isError;

  const buildReceiptDocument = useCallback(() => {
    if (!receipt) return null;
    return {
      data: {
        receiptNumber: receipt.receipt_number,
        paymentDate: receipt.payment_date,
        tenantName: receipt.tenant_name ?? '—',
        propertyName: receipt.property_title ?? '—',
        unitNumber: receipt.unit_number ?? '—',
        invoiceNumber: receipt.invoice_reference ?? 'فاتورة بلا مرجع',
        amount: toFinancialNumber(receipt.amount),
        paymentMethod: paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method,
        reference: receipt.reference_number ?? undefined,
        notes: receipt.reference_number ? `مرجع السداد: ${receipt.reference_number}` : undefined,
      },
      settings: documentSettings.companySettings,
    };
  }, [receipt, documentSettings]);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      await runGuardedDocumentAction({
        isReady: canUseReceiptDocument,
        operation: () => {
          const receiptDocument = buildReceiptDocument();
          if (!receiptDocument) throw new DocumentReadinessError(MISSING_RECEIPT_MESSAGE);
          return documentService.printDocument('receipt', { settings: receiptDocument.settings, payload: toReceiptDocumentPayload(receiptDocument.data) });
        },
        fallbackMessage: 'تعذرت طباعة الإيصال.',
      });
    } finally {
      window.setTimeout(() => setIsPrinting(false), 300);
    }
  }, [buildReceiptDocument, canUseReceiptDocument]);

  const handleDownloadPdf = useCallback(async () => {
    await runGuardedDocumentAction({
      isReady: canUseReceiptDocument,
      operation: () => {
        const receiptDocument = buildReceiptDocument();
        if (!receiptDocument) throw new DocumentReadinessError(MISSING_RECEIPT_MESSAGE);
        return documentService.downloadDocumentPdf('receipt', { settings: receiptDocument.settings, payload: toReceiptDocumentPayload(receiptDocument.data) });
      },
      fallbackMessage: 'تعذر تنزيل الإيصال كملف PDF.',
    });
  }, [buildReceiptDocument, canUseReceiptDocument]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const result = await shareOrCopy({
        title: 'تحديث حالة تحصيل',
        text: 'تم تحديث حالة تحصيل. يرجى مراجعة الإيصال من المسار المعتمد قبل اتخاذ أي إجراء.',
      });
      if (result === 'copied') toast.success('تم نسخ رسالة عامة دون بيانات الإيصال');
      if (result === 'unavailable') toast.error('تعذر مشاركة الإيصال من هذا المتصفح');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('تعذر مشاركة الإيصال');
    } finally {
      setIsSharing(false);
    }
  }, []);

  const handleCopyReceiptNumber = useCallback(() => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt.receipt_number).then(() => {
      toast.success(`تم نسخ رقم الإيصال: ${receipt.receipt_number}`);
    });
  }, [receipt]);

  if (!receipt && receiptQuery.isLoading) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <ReceiptPageHeader />
        <LoadingState variant="route" label="جارٍ تحميل بيانات الإيصال..." />
      </PageLayout>
    );
  }

  if (!receipt) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <ReceiptPageHeader description="تعذر تحميل بيانات الإيصال." />
        <DataErrorScreen
          title="تعذر تحميل الإيصال"
          fallbackMessage="حدث خطأ أثناء تحميل بيانات الإيصال."
          error={receiptQuery.error}
          action={(
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void receiptQuery.refetch()}>إعادة المحاولة</Button>
              <Button asChild variant="secondary">
                <Link to="/financials" search={{ section: "collections", view: "receipts" }}>
                  <ArrowRight className="me-2 size-4" />
                  العودة لقائمة الإيصالات
                </Link>
              </Button>
            </div>
          )}
        />
      </PageLayout>
    );
  }

  const statusTone = receiptDetailStatusTone(receipt.status);

  return (
    <PageLayout
      dir="rtl"
      lang="ar"
      size="wide"
      className="print:block"
      contentClassName="print:max-w-none print:space-y-0 print:p-0"
    >
      {receiptQuery.isError ? (
        <div className="print:hidden">
          <DataRefreshAlert onRetry={() => { void receiptQuery.refetch(); }} isRefreshing={receiptQuery.isFetching} />
        </div>
      ) : null}
      <div className="print:hidden">
        <PageHeader
          title="إيصال استلام نقدية"
          description={`رقم الإيصال: ${receipt.receipt_number}`}
          backTo="/financials"
          backLabel="المالية"
          primaryAction={(
            <Button variant="primary" onClick={handlePrint} disabled={isPrinting || !canUseReceiptDocument}>
              <Printer className="me-2 size-4" />
              {isPrinting ? 'جارٍ الطباعة...' : 'طباعة A4'}
            </Button>
          )}
          secondaryActions={(
            <>
              <Button variant="secondary" onClick={handleDownloadPdf} disabled={!canUseReceiptDocument}>
                <Download className="me-2 size-4" />
                تنزيل PDF
              </Button>
              <Button variant="secondary" onClick={handleShare} disabled={isSharing}>
                <Share2 className="me-2 size-4" />
                {isSharing ? 'جارٍ المشاركة...' : 'مشاركة'}
              </Button>
              <Button variant="secondary" onClick={handleCopyReceiptNumber}>
                <Copy className="me-2 size-4" />
                نسخ الرقم
              </Button>
            </>
          )}
        />
      </div>

      {!documentSettings.isReady && !documentSettings.isLoading ? (
        <div className="print:hidden">
          <DocumentReadinessNotice />
        </div>
      ) : null}

      <Card className="print-document mx-auto max-w-4xl overflow-hidden border-border/80 bg-card shadow-card print:max-w-none print:border-0 print:shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 bg-muted/20 px-6 py-5 sm:px-8 sm:py-6 print:bg-transparent print:px-0">
          <div className="min-w-0">
            <CardTitle className="break-words text-2xl font-black">إيصال استلام نقدية</CardTitle>
            <CardDescription className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
              <span>رقم الإيصال:</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleCopyReceiptNumber}
                className="min-w-0 max-w-full break-all px-1 font-bold print:min-h-0 print:min-w-0 print:p-0 print:text-foreground"
                title="انقر للنسخ"
              >
                {receipt.receipt_number}
              </Button>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={statusTone}>{receiptStatusLabels[receipt.status]}</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6 sm:p-8 print:p-0 print:pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-bold text-muted-foreground">المستأجر</p>
              <p className="mt-1 break-words text-lg font-black">{receipt.tenant_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">استخدم المستند المعتمد للمشاركة بعد التحقق من المستلم والقناة.</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-bold text-muted-foreground">العقار / الوحدة</p>
              <p className="mt-1 break-words text-lg font-black">{receipt.property_title ?? '—'}</p>
              {receipt.unit_number ? <p className="break-words text-sm text-muted-foreground">وحدة {receipt.unit_number}</p> : null}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
            <p className="text-xs font-bold text-muted-foreground">المبلغ المدفوع</p>
            <p className="mt-1 break-words text-3xl font-black text-success [overflow-wrap:anywhere]" dir="ltr">
              {formatMoney(receipt.amount)}
            </p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-6">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">طريقة الدفع:</span>
                <span className="font-bold">{paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">تاريخ الدفع:</span>
                <span className="font-bold">{formatDate(receipt.payment_date)}</span>
              </div>
              {receipt.reference_number ? (
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <span className="text-muted-foreground">المرجع:</span>
                  <span className="break-all font-bold" dir="ltr">{receipt.reference_number}</span>
                </div>
              ) : null}
            </div>
          </div>

          {receipt.invoice_id ? (
            <div className="min-w-0 rounded-2xl border border-dashed border-border/80 bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">الفاتورة المرتبطة</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-4">
                <span className="min-w-0 break-all font-bold" dir="ltr">{receipt.invoice_reference ?? 'فاتورة بلا مرجع'}</span>
                <Button variant="secondary" size="sm" className="print:hidden" asChild>
                  <Link to="/financials" search={{ section: "collections", view: "invoices" }}>
                    عرض الفاتورة
                    <ExternalLink className="me-1 size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {receipt.reference_number ? (
            <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-bold text-muted-foreground">السياق</p>
              <p className="mt-1 break-words [overflow-wrap:anywhere]">{formatReceiptContext(receipt)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="fixed inset-x-4 bottom-[var(--mobile-dock-clearance,5.25rem)] z-30 print:hidden md:hidden">
        <Button className="min-h-14 w-full" onClick={handlePrint} disabled={!canUseReceiptDocument}>
          <Printer className="me-2 size-5" />
          طباعة الإيصال المعتمد A4
        </Button>
      </div>
    </PageLayout>
  );
}
