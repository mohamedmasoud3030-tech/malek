import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Printer, Download, MessageCircle, Share2, Copy, ExternalLink } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { useReceipt } from './useReceipts';
import { formatDate, formatMoney, getErrorMessage } from '../components/financials-formatters';
import { formatReceiptContext, paymentMethodLabels, receiptStatusLabels } from '../components/receipt-formatters';
import { toast } from 'sonner';
import { openWhatsApp, shareOrCopy } from '@/services/action-service';
import { DocumentTemplates } from '@/services/documents/DocumentTemplates';

export function ReceiptDetailPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptId = typeof searchParams.receiptId === 'string' ? searchParams.receiptId : '';
  const receiptQuery = useReceipt(receiptId);
  const companySettings = useCompanySettingsContract();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const receipt = receiptQuery.data;

  const handlePrint = useCallback(() => {
    if (!receipt) return;
    setIsPrinting(true);
    DocumentTemplates.printReceipt(
      {
        receiptNumber: receipt.receipt_number,
        paymentDate: receipt.payment_date,
        tenantName: receipt.tenant_name ?? '—',
        propertyName: receipt.property_title ?? '—',
        unitNumber: receipt.unit_number ?? '—',
        invoiceNumber: receipt.invoice_id?.slice(0, 8) ?? '—',
        amount: receipt.amount,
        paymentMethod: paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method,
        reference: receipt.reference_number ?? undefined,
        notes: receipt.reference_number ? `مرجع السداد: ${receipt.reference_number}` : undefined,
      },
      {
        company: {
          name: companySettings.companyName || 'رينتريكس لإدارة العقارات',
          phone: '+968 24000000',
          address: 'سلطنة عمان - مسقط',
        },
        currency: companySettings.defaultCurrency || 'OMR',
        currencySymbol: 'ر.ع',
      },
    );
    window.setTimeout(() => setIsPrinting(false), 1000);
  }, [receipt, companySettings]);

  const handleDownloadPdf = useCallback(async () => {
    if (!receipt) return;
    setIsDownloading(true);
    const loadingToast = toast.loading('جارٍ إنشاء وتحميل ملف الـ PDF...');
    try {
      await DocumentTemplates.downloadReceiptPdf(
        {
          receiptNumber: receipt.receipt_number,
          paymentDate: receipt.payment_date,
          tenantName: receipt.tenant_name ?? '—',
          propertyName: receipt.property_title ?? '—',
          unitNumber: receipt.unit_number ?? '—',
          invoiceNumber: receipt.invoice_id?.slice(0, 8) ?? '—',
          amount: receipt.amount,
          paymentMethod: paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method,
          reference: receipt.reference_number ?? undefined,
          notes: receipt.reference_number ? `مرجع السداد: ${receipt.reference_number}` : undefined,
        },
        {
          company: {
            name: companySettings.companyName || 'رينتريكس لإدارة العقارات',
            phone: '+968 24000000',
            address: 'سلطنة عمان - مسقط',
          },
          currency: companySettings.defaultCurrency || 'OMR',
          currencySymbol: 'ر.ع',
        },
      );
      toast.success('تم تنزيل الإيصال المعتمد بصيغة PDF بنجاح', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('فشل تنزيل ملف الـ PDF. تحقق من المتصفح وحاول مرة أخرى.', { id: loadingToast });
    } finally {
      setIsDownloading(false);
    }
  }, [receipt, companySettings]);

  const handleWhatsApp = useCallback(() => {
    if (!receipt) return;
    const message = `إيصال استلام\nرقم: ${receipt.receipt_number}\nالتاريخ: ${formatDate(receipt.payment_date)}\nالمبلغ: ${formatMoney(receipt.amount)}\nطريقة الدفع: ${paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}`;
    openWhatsApp(null, message);
  }, [receipt]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const result = await shareOrCopy({
        title: `إيصال ${receipt?.receipt_number ?? ''}`,
        text: `إيصال استلام رقم ${receipt?.receipt_number}`,
        url: window.location.href,
      });
      if (result === 'copied') toast.success('تم نسخ رابط الإيصال');
      if (result === 'unavailable') toast.error('تعذر مشاركة الإيصال من هذا المتصفح');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('تعذر مشاركة الإيصال');
    } finally {
      setIsSharing(false);
    }
  }, [receipt]);

  const handleCopyReceiptNumber = useCallback(() => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt.receipt_number).then(() => {
      toast.success(`تم نسخ رقم الإيصال: ${receipt.receipt_number}`);
    });
  }, [receipt]);

  if (receiptQuery.isLoading) {
    return (
      <div className="space-y-4 p-4" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (receiptQuery.isError || !receipt) {
    return (
      <div className="space-y-4 p-4" dir="rtl">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Printer className="size-6" />
            </div>
            <div>
              <p className="font-bold text-destructive">تعذر تحميل الإيصال</p>
              <p className="text-sm text-muted-foreground">
                {getErrorMessage(receiptQuery.error, 'حدث خطأ أثناء تحميل بيانات الإيصال.')}
              </p>
            </div>
            <Button asChild variant="secondary" className="mr-auto">
              <Link to="/receipts">
                <ArrowRight className="me-2 size-4" />
                العودة لقائمة الإيصالات
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusTone = receipt.status === 'posted' ? 'green' : receipt.status === 'void' ? 'red' : 'gold';

  return (
    <div className="space-y-4 p-4 print:space-y-0 print:p-0 md:p-6" dir="rtl">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="primary" onClick={handlePrint} disabled={isPrinting} className="min-h-11">
          <Printer className="me-2 size-4" />
          {isPrinting ? 'جارٍ تهيئة الطباعة...' : 'طباعة الإيصال A4'}
        </Button>
        <Button variant="secondary" onClick={handleDownloadPdf} disabled={isDownloading} className="min-h-11">
          <Download className="me-2 size-4" />
          {isDownloading ? 'جارٍ تنزيل الـ PDF...' : 'تنزيل PDF'}
        </Button>
        <Button variant="secondary" onClick={handleWhatsApp} className="min-h-11">
          <MessageCircle className="me-2 size-4" />
          إرسال واتساب
        </Button>
        <Button variant="secondary" onClick={handleShare} disabled={isSharing} className="min-h-11">
          <Share2 className="me-2 size-4" />
          {isSharing ? 'جارٍ المشاركة...' : 'مشاركة'}
        </Button>
        <Button variant="secondary" onClick={handleCopyReceiptNumber} className="min-h-11">
          <Copy className="me-2 size-4" />
          نسخ الرقم
        </Button>
        <Button asChild variant="secondary" className="mr-auto min-h-11">
          <Link to="/receipts">
            <ArrowRight className="me-2 size-4" />
            العودة
          </Link>
        </Button>
      </div>

      {/* Receipt Card */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-black">إيصال استلام نقدية</CardTitle>
            <CardDescription className="mt-1">
              رقم الإيصال:{' '}
              <button
                onClick={handleCopyReceiptNumber}
                className="font-bold text-primary hover:underline"
                title="انقر للنسخ"
              >
                {receipt.receipt_number}
              </button>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={statusTone}>{receiptStatusLabels[receipt.status]}</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Info Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">المستأجر</p>
              <p className="mt-1 text-lg font-black">{receipt.tenant_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">يمكن تجهيز مشاركة الإيصال عبر واتساب من شريط الإجراءات.</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">العقار / الوحدة</p>
              <p className="mt-1 text-lg font-black">{receipt.property_title ?? '—'}</p>
              {receipt.unit_number && (
                <p className="text-sm text-muted-foreground">وحدة {receipt.unit_number}</p>
              )}
            </div>
          </div>

          {/* Financial Info */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-bold text-muted-foreground">المبلغ المدفوع</p>
            <p className="mt-1 text-3xl font-black text-emerald-600" dir="ltr">
              {formatMoney(receipt.amount)}
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">طريقة الدفع:</span>
                <span className="font-bold">
                  {paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تاريخ الدفع:</span>
                <span className="font-bold">{formatDate(receipt.payment_date)}</span>
              </div>
              {receipt.reference_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المرجع:</span>
                  <span className="font-bold" dir="ltr">
                    {receipt.reference_number}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Link */}
          {receipt.invoice_id && (
            <div className="rounded-2xl border border-dashed p-4">
              <p className="text-xs font-bold text-muted-foreground">الفاتورة المرتبطة</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold">#{receipt.invoice_id?.slice(0, 8)}...</span>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/invoices">
                    عرض الفاتورة
                    <ExternalLink className="me-1 size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Context */}
          {receipt.reference_number ? (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-bold text-muted-foreground">السياق</p>
              <p className="mt-1">{formatReceiptContext(receipt)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Mobile Action */}
      <div className="fixed bottom-20 left-4 right-4 print:hidden md:hidden">
        <Button
          className="w-full min-h-14 bg-primary text-white"
          onClick={handlePrint}
        >
          <Printer className="me-2 size-5" />
          طباعة الإيصال المعتمد A4
        </Button>
      </div>
    </div>
  );
}
