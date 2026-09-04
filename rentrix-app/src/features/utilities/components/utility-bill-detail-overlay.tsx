import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts, type PreviewFactRow } from '@/components/ui/quick-preview';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatLatinNumber } from '@/lib/formatters';
import {
  utilityObligationUrgencyLabels,
  utilityObligationUrgencyTone,
  type UtilityObligation,
} from '../utility-obligations';
import {
  responsiblePartyLabels,
  utilityBillStatusLabels,
  utilityTypeLabels,
  type UtilityBill,
  type UtilityMeter,
} from '../utilities-service';

type UtilityBillDetailOverlayProps = Readonly<{
  bill: UtilityBill | null;
  meter: UtilityMeter | null;
  propertyTitle: string;
  obligation: UtilityObligation | undefined;
  money: (value: number) => string;
  onOpenChange: (open: boolean) => void;
}>;

/**
 * P3 — the utility claim in one place.
 *
 * Two operational facts had nowhere to live: the readings the office captured
 * when recording the bill (previous, current, consumption) were write-only,
 * and the provider's own bill document had no contextual home, forcing it into
 * the general vault where nobody looking at the claim would find it (UX-006,
 * contextual-first documents).
 *
 * Read-only over the canonical rows: no amount, remaining balance or status is
 * recomputed here — the shared obligation derivation supplies them.
 */
export function UtilityBillDetailOverlay({
  bill,
  meter,
  propertyTitle,
  obligation,
  money,
  onOpenChange,
}: UtilityBillDetailOverlayProps) {
  const reference = bill?.bill_number || 'فاتورة مرافق بلا مرجع';
  const consumption = bill?.consumption_units
    ?? (bill && bill.current_reading != null && bill.previous_reading != null
      ? Number(bill.current_reading) - Number(bill.previous_reading)
      : null);

  return (
    <EntityPreviewDialog
      open={Boolean(bill)}
      onOpenChange={onOpenChange}
      title={reference}
      description={bill ? `${meter ? utilityTypeLabels[meter.utility_type] : 'مرفق غير محدد'} · ${propertyTitle}` : undefined}
    >
      {bill ? (
        <div className="space-y-4" data-utility-bill-detail>
          <PreviewFacts
            rows={[
              { label: 'المبلغ', value: <span dir="ltr">{money(bill.amount)}</span> },
              { label: 'المسدد', value: <span dir="ltr" className="text-success">{money(bill.paid_amount)}</span> },
              {
                label: 'المتبقي',
                value: (
                  <span dir="ltr" className={(obligation?.remainingAmount ?? 0) > 0 ? 'text-danger' : 'text-muted-foreground'}>
                    {money(obligation?.remainingAmount ?? 0)}
                  </span>
                ),
              },
              {
                label: 'حالة السداد',
                value: (
                  <StatusBadge tone={bill.status === 'paid' ? 'success' : bill.status === 'partially_paid' ? 'warning' : 'neutral'}>
                    {utilityBillStatusLabels[bill.status]}
                  </StatusBadge>
                ),
              },
              {
                label: 'الاستحقاق التشغيلي',
                value: obligation ? (
                  <StatusBadge tone={utilityObligationUrgencyTone[obligation.urgency]}>
                    {utilityObligationUrgencyLabels[obligation.urgency]}
                  </StatusBadge>
                ) : '—',
              },
              { label: 'تاريخ الاستحقاق', value: <span dir="ltr" className="tabular-nums">{bill.due_date || '—'}</span> },
              { label: 'المسؤول عن السداد', value: responsiblePartyLabels[bill.responsible_party] },
              { label: 'من دفع فعليًا', value: bill.actual_payer ? responsiblePartyLabels[bill.actual_payer] : 'غير مسجل' },
              { label: 'العداد', value: meter ? <span dir="ltr" className="tabular-nums">{meter.meter_number}</span> : 'بدون عداد محدد' },
              {
                label: 'فترة الفاتورة',
                value: <span dir="ltr" className="tabular-nums">{bill.billing_period_start || '—'} → {bill.billing_period_end || '—'}</span>,
              },
              {
                label: 'قراءات العداد',
                wide: true,
                value: (
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><span className="text-muted-foreground">القراءة السابقة:</span> <span dir="ltr" className="tabular-nums">{bill.previous_reading != null ? formatLatinNumber(Number(bill.previous_reading), 'ar') : 'غير مسجلة'}</span></span>
                    <span><span className="text-muted-foreground">القراءة الحالية:</span> <span dir="ltr" className="tabular-nums">{bill.current_reading != null ? formatLatinNumber(Number(bill.current_reading), 'ar') : 'غير مسجلة'}</span></span>
                    <span><span className="text-muted-foreground">الاستهلاك:</span> <span dir="ltr" className="tabular-nums">{consumption != null ? formatLatinNumber(Number(consumption), 'ar') : 'غير محسوب'}</span></span>
                  </span>
                ),
              },
            ] satisfies PreviewFactRow[]}
          />

          {bill.notes ? (
            <section className="rounded-xl border border-border/60 p-3" aria-label="ملاحظات الفاتورة">
              <p className="text-xs font-medium text-muted-foreground">ملاحظات</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{bill.notes}</p>
            </section>
          ) : null}

          <ContextualDocumentsSection entityType="utility_bill" entityId={bill.id} entityLabel="فاتورة المرافق" />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
