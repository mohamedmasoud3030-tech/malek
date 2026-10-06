import { useMemo, useState, type FormEvent } from 'react';
import { CalendarPlus, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { StatusBadge, type SemanticTone } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useAccountingPeriods, useCreateAccountingPeriod, useUpdateAccountingPeriodStatus } from '@/features/accounting/useAccountingPeriods';
import type { AccountingPeriod, AccountingPeriodStatus } from '@/features/accounting/accountingDomain';

/**
 * Accounting-period management surface (Settings → Finance Readiness).
 *
 * Wires the EXISTING Stage-3 service boundary (`accountingPeriodsService` →
 * audited `create_accounting_period` / `update_accounting_period_status`
 * RPCs) into the UI. Before this surface existed, the financial write path
 * failed closed with NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD whenever the company
 * needed a new period, and the app told the user to "open a period" while
 * providing no way to do it.
 *
 * Business rules stay server-owned: overlap detection, final-close
 * immutability, and the mandatory reopen reason are all enforced by the RPCs.
 * The client only pre-validates the obviously-invalid (empty/inverted ranges,
 * overlaps detectable from the loaded list) so routine mistakes get an
 * immediate Arabic message instead of a raw SQLSTATE.
 *
 * Editors render in EntityForm.Overlay dialogs (Radix portals at body level):
 * the settings workspace wraps every section in one shared company-settings
 * HTML form, and an inline nested HTML form is invalid HTML — the browser
 * performs a native GET submission and React's onSubmit never runs. The
 * dialog portal is the same pattern the property/contract/approval editors
 * already use.
 */

const periodStatusLabels: Readonly<Record<AccountingPeriodStatus, string>> = {
  OPEN: 'مفتوحة',
  SOFT_CLOSED: 'مقفلة مؤقتاً',
  HARD_CLOSED: 'مقفلة نهائياً',
};

const periodStatusTones: Readonly<Record<AccountingPeriodStatus, SemanticTone>> = {
  OPEN: 'success',
  SOFT_CLOSED: 'warning',
  HARD_CLOSED: 'danger',
};

const isoDate = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** First/last day of the month following the given ISO date (or the current month when absent). */
function nextMonthRange(afterIso: string | null): { start_date: string; end_date: string; name: string } {
  const base = afterIso ? new Date(`${afterIso}T00:00:00`) : new Date();
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const end = new Date(next.getFullYear(), next.getMonth() + 1, 0);
  const name = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  return { start_date: isoDate(next), end_date: isoDate(end), name };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

export function AccountingPeriodsManagement() {
  const { canAccess } = useAuth();
  const canManage = canAccess('company.settings.manage');
  const periodsQuery = useAccountingPeriods();
  const createPeriod = useCreateAccountingPeriod();
  const updateStatus = useUpdateAccountingPeriodStatus();

  const periods = useMemo(
    () => [...(periodsQuery.data ?? [])].sort((a: AccountingPeriod, b: AccountingPeriod) => a.start_date.localeCompare(b.start_date)),
    [periodsQuery.data],
  );

  const latestEnd = periods.length > 0 ? periods[periods.length - 1].end_date : null;
  const defaults = useMemo(() => nextMonthRange(latestEnd), [latestEnd]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaults.start_date);
  const [endDate, setEndDate] = useState(defaults.end_date);
  const [formError, setFormError] = useState<string | null>(null);
  const [reopenPeriod, setReopenPeriod] = useState<AccountingPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  const openCreateDialog = () => {
    // Re-default every time: the next required period follows the latest known period.
    const next = nextMonthRange(latestEnd);
    setStartDate(next.start_date);
    setEndDate(next.end_date);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createPeriod.isPending) return;
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError('تاريخا البداية والنهاية مطلوبان.');
      return;
    }
    if (startDate > endDate) {
      setFormError('تاريخ بداية الفترة يجب أن يكون قبل تاريخ نهايتها أو مساوياً له.');
      return;
    }
    const overlapping = periods.find((period) => rangesOverlap(startDate, endDate, period.start_date, period.end_date));
    if (overlapping) {
      setFormError(`المدخل يتداخل مع الفترة ${overlapping.name} (${overlapping.start_date} ← ${overlapping.end_date}). عدّل النطاق ثم أعد المحاولة.`);
      return;
    }
    const name = startDate.slice(0, 7);
    createPeriod.mutate({ name, start_date: startDate, end_date: endDate, status: 'OPEN' }, { onSuccess: () => setIsCreateOpen(false) });
  };

  const submitReopen = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reopenPeriod || updateStatus.isPending) return;
    const reason = reopenReason.trim();
    setReopenError(null);
    if (!reason) {
      setReopenError('سبب إعادة الفتح مطلوب.');
      return;
    }
    updateStatus.mutate(
      { period_id: reopenPeriod.id, status: 'OPEN', reason },
      {
        onSuccess: () => {
          setReopenPeriod(null);
          setReopenReason('');
        },
      },
    );
  };

  return (
    <div className="space-y-2.5 border-t border-border/60 pt-2.5" data-accounting-periods-management>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black">الفترات المحاسبية</p>
        {canManage ? (
          <Button type="button" size="sm" onClick={openCreateDialog} disabled={periodsQuery.isLoading}>
            <CalendarPlus className="size-4 sm:me-1.5" aria-hidden="true" />
            إنشاء فترة محاسبية
          </Button>
        ) : null}
      </div>

      {periodsQuery.isLoading ? (
        <p className="text-[11px] font-bold text-muted-foreground">جارٍ تحميل الفترات…</p>
      ) : periodsQuery.isError ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-danger">تعذر تحميل الفترات المحاسبية.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => periodsQuery.refetch()}>إعادة المحاولة</Button>
        </div>
      ) : periods.length === 0 ? (
        <p className="text-[11px] font-bold text-muted-foreground">لا توجد فترات محاسبية بعد. أنشئ أول فترة لتمكين القيود المالية.</p>
      ) : (
        <ul className="space-y-1.5">
          {periods.map((period) => (
            <li key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                <span className="font-black">{period.name}</span>
                <span className="text-muted-foreground" dir="ltr">{period.start_date} ← {period.end_date}</span>
                <StatusBadge tone={periodStatusTones[period.status]}>{periodStatusLabels[period.status]}</StatusBadge>
              </div>
              {canManage && period.status === 'SOFT_CLOSED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setReopenPeriod(period); setReopenReason(''); setReopenError(null); }}
                >
                  <LockOpen className="size-4 sm:me-1.5" aria-hidden="true" />
                  إعادة الفتح
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <EntityForm.Overlay
        open={isCreateOpen}
        onOpenChange={(nextOpen) => { if (!nextOpen) setIsCreateOpen(false); }}
        title="إنشاء فترة محاسبية"
        description={`تُنشأ الفترة بحالة «مفتوحة» ويُسجل الاسم تلقائياً بصيغة YYYY-MM. الفترة المقترحة تالية لآخر فترة قائمة (${defaults.name}).`}
        className="max-w-xl"
      >
        <EntityForm.Root className="gap-3" onSubmit={submitCreate} aria-busy={createPeriod.isPending}>
          <EntityForm.ErrorSummary message={formError ?? undefined} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <EntityForm.Field label="تاريخ بداية الفترة">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </EntityForm.Field>
            <EntityForm.Field label="تاريخ نهاية الفترة">
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </EntityForm.Field>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground">
            يرفض الخادم أي مدى يتداخل مع فترة قائمة، ولا يمكن تعديل الفترات المقفلة نهائياً.
          </p>
          <EntityForm.Actions
            submitLabel="حفظ الفترة"
            isSubmitting={createPeriod.isPending}
            submitDisabled={createPeriod.isPending || !startDate || !endDate}
            onCancel={() => setIsCreateOpen(false)}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={reopenPeriod !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) { setReopenPeriod(null); setReopenReason(''); setReopenError(null); } }}
        title={reopenPeriod ? `إعادة فتح الفترة ${reopenPeriod.name}` : 'إعادة فتح الفترة'}
        description="إعادة الفتح إجراء مُدقَّق: سجّل سبباً واضحاً. الفترات المقفلة نهائياً لا يمكن إعادة فتحها."
        className="max-w-xl"
      >
        <EntityForm.Root className="gap-3" onSubmit={submitReopen} aria-busy={updateStatus.isPending}>
          <EntityForm.ErrorSummary message={reopenError ?? undefined} />
          <EntityForm.Field label="سبب إعادة الفتح (إلزامي)">
            <Textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              placeholder="اذكر سبب إعادة فتح الفترة…"
              required
              rows={3}
            />
          </EntityForm.Field>
          <EntityForm.Actions
            submitLabel="تأكيد إعادة الفتح"
            isSubmitting={updateStatus.isPending}
            submitDisabled={updateStatus.isPending || !reopenReason.trim()}
            onCancel={() => { setReopenPeriod(null); setReopenReason(''); setReopenError(null); }}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
