import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useInvoiceWorkspaceController } from '../invoices/useInvoiceWorkspaceController';
import { InvoiceDetailSection } from './invoice-detail-section';
import { InvoiceListSection } from './invoice-list-section';
import { BillingReadinessSection } from '../billing/billing-readiness-section';

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <DialogTitle>إنشاء الفواتير المستحقة</DialogTitle>
              <DialogDescription>
                راجع الجاهزية هنا فقط عند إصدار الفواتير؛ النظام ينشئ الفواتير الناقصة للعقود المؤهلة ولا يسجل أي دفعة تلقائيًا.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <BillingReadinessSection />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)} disabled={isGenerating}>إلغاء</Button>
            <Button className="min-h-12" onClick={onConfirm} disabled={isGenerating}>{isGenerating ? 'جارٍ إنشاء الفواتير...' : 'إنشاء الفواتير الجاهزة'}</Button>
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
        status={ctrl.status}
        invoiceSearch={ctrl.invoiceSearch}
        invoices={ctrl.invoices}
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
        onGenerateInvoices={() => { if (ctrl.canGenerateInvoices) ctrl.setGenerateDialogOpen(true); }}
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

      <EntityPreviewDialog
        open={Boolean(ctrl.selectedInvoiceId)}
        onOpenChange={(open) => { if (!open) ctrl.setSelectedInvoiceId(''); }}
        title="الفاتورة والتحصيل"
        description={ctrl.invoiceDetail
          ? `${ctrl.invoiceDetail.contracts?.people?.full_name ?? 'مستأجر غير محدد'} · ${ctrl.invoiceDetail.contracts?.properties?.title ?? 'عقار غير محدد'} · ${ctrl.invoiceDetail.reference ?? 'فاتورة بلا مرجع'}`
          : 'تحميل بيانات الفاتورة...'}
      >
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
          collectionReceiptDetail={ctrl.collectionReceiptQuery.data}
          isCollectionReceiptLoading={ctrl.collectionReceiptQuery.isLoading}
          isCollectionReceiptError={ctrl.collectionReceiptQuery.isError}
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
      </EntityPreviewDialog>
    </>
  );
}
