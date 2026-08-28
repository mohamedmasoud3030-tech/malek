import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
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

function Fact({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

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
          <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="المبلغ"><span dir="ltr">{money(bill.amount)}</span></Fact>
            <Fact label="المسدد"><span dir="ltr" className="text-success">{money(bill.paid_amount)}</span></Fact>
            <Fact label="المتبقي">
              <span dir="ltr" className={(obligation?.remainingAmount ?? 0) > 0 ? 'text-danger' : 'text-muted-foreground'}>
                {money(obligation?.remainingAmount ?? 0)}
              </span>
            </Fact>
            <Fact label="حالة السداد">
              <StatusBadge tone={bill.status === 'paid' ? 'success' : bill.status === 'partially_paid' ? 'warning' : 'neutral'}>
                {utilityBillStatusLabels[bill.status]}
              </StatusBadge>
            </Fact>
            <Fact label="الاستحقاق التشغيلي">
              {obligation ? (
                <StatusBadge tone={utilityObligationUrgencyTone[obligation.urgency]}>
                  {utilityObligationUrgencyLabels[obligation.urgency]}
                </StatusBadge>
              ) : '—'}
            </Fact>
            <Fact label="تاريخ الاستحقاق"><span dir="ltr" className="tabular-nums">{bill.due_date || '—'}</span></Fact>
            <Fact label="المسؤول عن السداد">{responsiblePartyLabels[bill.responsible_party]}</Fact>
            <Fact label="من دفع فعليًا">{bill.actual_payer ? responsiblePartyLabels[bill.actual_payer] : 'غير مسجل'}</Fact>
            <Fact label="العداد">
              {meter ? <span dir="ltr" className="tabular-nums">{meter.meter_number}</span> : 'بدون عداد محدد'}
            </Fact>
            <Fact label="فترة الفاتورة">
              <span dir="ltr" className="tabular-nums">
                {bill.billing_period_start || '—'} → {bill.billing_period_end || '—'}
              </span>
            </Fact>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-3">
            <Fact label="القراءة السابقة">
              {bill.previous_reading != null ? <span dir="ltr" className="tabular-nums">{formatLatinNumber(Number(bill.previous_reading), 'ar')}</span> : 'غير مسجلة'}
            </Fact>
            <Fact label="القراءة الحالية">
              {bill.current_reading != null ? <span dir="ltr" className="tabular-nums">{formatLatinNumber(Number(bill.current_reading), 'ar')}</span> : 'غير مسجلة'}
            </Fact>
            <Fact label="الاستهلاك">
              {consumption != null ? <span dir="ltr" className="tabular-nums">{formatLatinNumber(Number(consumption), 'ar')}</span> : 'غير محسوب — لم تُسجَّل القراءتان'}
            </Fact>
          </div>

          {bill.notes ? (
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
              <span className="text-xs font-medium text-muted-foreground">ملاحظات</span>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{bill.notes}</p>
            </div>
          ) : null}

          <ContextualDocumentsSection entityType="utility_bill" entityId={bill.id} entityLabel="فاتورة المرافق" />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
