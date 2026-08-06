import { AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useInvoiceWorkspaceController } from '../invoices/useInvoiceWorkspaceController';
import { InvoiceDetailSection } from './invoice-detail-section';
import { InvoiceListSection } from './invoice-list-section';
import { ReceiptsSection } from './receipts-section';

type GenerateInvoicesDialogProps = {
  open: boolean;
  isGenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function GenerateInvoicesDialog({ open, isGenerating, onOpenChange, onConfirm }: GenerateInvoicesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isGenerating) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <DialogTitle>توليد فواتير العقود النشطة</DialogTitle>
              <DialogDescription>
                سيبحث النظام عن العقود النشطة التي تحتاج فواتير دورية وينشئ الفواتير الناقصة فقط.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-black">قبل المتابعة</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>راجع العقود النشطة وتواريخ الاستحقاق قبل تشغيل التوليد.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>لن يتم تسجيل أي دفعات أو إيصالات من هذه الخطوة.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>بعد التوليد سيتم تحديث الفواتير ولوحات الملخص تلقائياً.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-warning">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>هذه عملية مالية جماعية. استخدمها عند جاهزية العقود النشطة للمراجعة الشهرية.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              إلغاء
            </Button>
            <Button className="min-h-12" onClick={onConfirm} disabled={isGenerating}>
              {isGenerating ? 'جارٍ توليد الفواتير...' : 'تأكيد توليد الفواتير'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceWorkspaceSection() {
  const ctrl = useInvoiceWorkspaceController();

  return (
    <>
      {!ctrl.isDocumentSettingsReady && <DocumentReadinessNotice />}
      <InvoiceListSection
        summary={ctrl.summary}
        status={ctrl.status}
        invoiceSearch={ctrl.invoiceSearch}
        invoices={ctrl.invoices}
        selectedInvoiceId={ctrl.selectedInvoiceId}
        isLoading={ctrl.invoicesQuery.isLoading}
        isError={ctrl.invoicesQuery.isError}
        error={ctrl.invoicesQuery.error}
        isGenerating={ctrl.generate.isPending}
        canGenerateInvoices={ctrl.canGenerateInvoices}
        hasInvoiceFilter={ctrl.status !== 'all' || ctrl.invoiceSearch.trim().length > 0 || Boolean(ctrl.dateFrom) || Boolean(ctrl.dateTo) || Boolean(ctrl.tenantId) || Boolean(ctrl.propertyId)}
        dateFrom={ctrl.dateFrom}
        dateTo={ctrl.dateTo}
        tenantId={ctrl.tenantId}
        propertyId={ctrl.propertyId}
        tenantOptions={ctrl.tenantOptions}
        propertyOptions={ctrl.propertyOptions}
        page={ctrl.page}
        pageSize={ctrl.INVOICE_PAGE_SIZE}
        total={ctrl.invoicesQuery.data?.total ?? 0}
        onStatusChange={ctrl.changeStatus}
        onInvoiceSearchChange={ctrl.changeSearch}
        onGenerateInvoices={() => {
          if (ctrl.canGenerateInvoices) ctrl.setGenerateDialogOpen(true);
        }}
        onSelectInvoice={ctrl.onSelectInvoiceRow}
        canCollectPayments={ctrl.canCreatePayment}
        onCollectInvoice={ctrl.onCollectInvoice}
        onPrintInvoice={ctrl.canExportInvoiceDocuments ? ctrl.onPrintInvoice : undefined}
        onExportInvoice={ctrl.canExportInvoiceDocuments ? ctrl.onExportInvoiceList : undefined}
        onDateFromChange={ctrl.changeDateFrom}
        onDateToChange={ctrl.changeDateTo}
        onTenantChange={ctrl.changeTenant}
        onPropertyChange={ctrl.changeProperty}
        onPageChange={ctrl.setPage}
      />

      <GenerateInvoicesDialog
        open={ctrl.isGenerateDialogOpen}
        isGenerating={ctrl.generate.isPending}
        onOpenChange={ctrl.setGenerateDialogOpen}
        onConfirm={ctrl.onConfirmGenerateInvoices}
      />

      <InvoiceDetailSection
        selectedInvoiceId={ctrl.selectedInvoiceId}
        invoiceDetail={ctrl.invoiceDetail}
        remaining={ctrl.remaining}
        isLoading={ctrl.invoiceQuery.isLoading}
        isError={ctrl.invoiceQuery.isError}
        error={ctrl.invoiceQuery.error}
        amount={ctrl.amount}
        method={ctrl.paymentMethod}
        paymentDate={ctrl.paymentDate}
        reference={ctrl.paymentReference}
        amountValidationMessage={ctrl.canCreatePayment ? ctrl.amountValidationMessage : 'ليس لديك صلاحية تسجيل دفعة مالية.'}
        isPaymentPending={ctrl.postPayment.isPending}
        isPaymentDisabled={ctrl.isPaymentDisabled}
        collectionSuccess={ctrl.collectionSuccess}
        hasNextCollectibleInvoice={Boolean(ctrl.nextCollectibleInvoiceId)}
        collectionFocusKey={ctrl.collectionFocusKey}
        onCollectNextInvoice={ctrl.onCollectNextInvoice}
        onPrintCollectionReceipt={ctrl.onPrintCollectionReceipt}
        onDismissCollection={ctrl.dismissCollectionSuccess}
        onAmountChange={ctrl.setAmount}
        onMethodChange={ctrl.setPaymentMethod}
        onPaymentDateChange={ctrl.setPaymentDate}
        onReferenceChange={ctrl.setPaymentReference}
        onPostPayment={ctrl.onPostPayment}
        onExportPdf={ctrl.canExportInvoiceDocument ? ctrl.onExportInvoicePdf : undefined}
      />

      <ReceiptsSection
        receipts={ctrl.receiptsQuery.data ?? []}
        selectedReceiptId={ctrl.selectedReceiptId}
        receiptDetail={ctrl.receiptQuery.data}
        isReceiptsLoading={ctrl.receiptsQuery.isLoading}
        isReceiptsError={ctrl.receiptsQuery.isError}
        receiptsError={ctrl.receiptsQuery.error}
        isReceiptDetailLoading={ctrl.receiptQuery.isLoading}
        isReceiptDetailError={ctrl.receiptQuery.isError}
        receiptDetailError={ctrl.receiptQuery.error}
        onSelectReceipt={ctrl.setSelectedReceiptId}
      />
    </>
  );
}
