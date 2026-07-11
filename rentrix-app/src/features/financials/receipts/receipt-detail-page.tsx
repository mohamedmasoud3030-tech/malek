import { Link, useSearch } from '@tanstack/react-router';
import { ArrowRight, Printer, MessageCircle, Share2, Download, ExternalLink, Copy } from 'lucide-react';
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

export function ReceiptDetailPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const receiptId = typeof searchParams.receiptId === 'string' ? searchParams.receiptId : '';
  const receiptQuery = useReceipt(receiptId);
  const companySettings = useCompanySettingsContract();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const receipt = receiptQuery.data;

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 1000);
  }, []);

  const handleWhatsApp = useCallback(() => {
    if (!receipt) return;
    
    const phone = receipt.tenant_phone?.replace(/[^\d+]/g, '') ?? '';
    const digits = phone.startsWith('+') ? phone.slice(1) : phone;
    const message = `إيصال استلام\nرقم: ${receipt.receipt_number}\nالتاريخ: ${formatDate(receipt.payment_date)}\nالمبلغ: ${formatMoney(receipt.amount)}\nطريقة الدفع: ${paymentMethodLabels[receipt.payment_method] ?? receipt.payment_method}`;
    
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [receipt]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    const shareUrl = window.location.href;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `إيصال ${receipt?.receipt_number ?? ''}`,
          text: `إيصال استلام رقم ${receipt?.receipt_number}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('تم نسخ رابط الإيصال');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('تعذر مشاركة الإيصال');
      }
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

  const statusTone = receipt.status === 'posted' ? 'green' : receipt.status === 'voided' ? 'red' : 'gold';

  return (
    <div className="space-y-4 p-4 print:space-y-0 print:p-0 md:p-6" dir="rtl">
      {/* Print Header - Only visible on print */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{companySettings.companyName}</h1>
        <p className="text-muted-foreground">إيصال استلام</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="secondary" onClick={handlePrint} disabled={isPrinting}>
          <Printer className="me-2 size-4" />
          {isPrinting ? 'جارٍ الطباعة...' : 'طباعة'}
        </Button>
        <Button variant="secondary" onClick={handleWhatsApp}>
          <MessageCircle className="me-2 size-4" />
          إرسال واتساب
        </Button>
        <Button variant="secondary" onClick={handleShare} disabled={isSharing}>
          <Share2 className="me-2 size-4" />
          {isSharing ? 'جارٍ المشاركة...' : 'مشاركة'}
        </Button>
        <Button variant="secondary" onClick={handleCopyReceiptNumber}>
          <Copy className="me-2 size-4" />
          نسخ الرقم
        </Button>
        <Button asChild variant="secondary" className="mr-auto">
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
            <CardTitle className="text-2xl font-black">إيصال استلام</CardTitle>
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
              {receipt.tenant_phone && (
                <a
                  href={`tel:${receipt.tenant_phone}`}
                  className="text-sm text-primary hover:underline"
                  dir="ltr"
                >
                  {receipt.tenant_phone}
                </a>
              )}
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
          {receipt.context && (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-bold text-muted-foreground">السياق</p>
              <p className="mt-1">{formatReceiptContext(receipt)}</p>
            </div>
          )}

          {/* Print Footer - Only visible on print */}
          <div className="hidden print:block mt-8 pt-8 border-t">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-bold">توقيع المستلم:</p>
                <p className="mt-8 border-b border-black" />
              </div>
              <div>
                <p className="font-bold">توقيع المحاسب:</p>
                <p className="mt-8 border-b border-black" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile WhatsApp Action */}
      <div className="fixed bottom-20 left-4 right-4 print:hidden md:hidden">
        <Button
          className="w-full min-h-14 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="me-2 size-5" />
          إرسال إيصال واتساب
        </Button>
      </div>
    </div>
  );
}
