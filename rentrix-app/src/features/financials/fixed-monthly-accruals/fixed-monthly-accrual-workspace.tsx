import { Play, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { ActionMenu } from '@/components/ui/action-menu';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { formatCompactDate, getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import {
  executeFixedMonthlyAccruals,
  listFixedMonthlyAccruals,
  reverseFixedMonthlyAccrual,
  type FixedMonthlyAccrualList,
  type FixedMonthlyAccrualRow,
} from './fixed-monthly-accrual-service';

function currentMonthRange() {
  const now = new Date();
  return {
    from: getTodayLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: getTodayLocalDateString(now),
  };
}

function statusPresentation(row: FixedMonthlyAccrualRow) {
  if (row.status === 'REVERSED') return { label: 'تم العكس', variant: 'neutral' as const };
  if (row.status === 'ZERO_AMOUNT') return { label: 'بدون مبلغ', variant: 'info' as const };
  if (row.status === 'POSTED' && row.latePosting) return { label: 'سُجل لاحقًا', variant: 'warning' as const };
  if (row.status === 'POSTED') return { label: 'مسجل', variant: 'success' as const };
  return { label: 'يحتاج مراجعة', variant: 'danger' as const };
}

export type FixedMonthlyAccrualWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone: owns the page shell for compatibility deep links.
   */
  embedded?: boolean;
}>;

export function FixedMonthlyAccrualWorkspace({ embedded = false }: FixedMonthlyAccrualWorkspaceProps = {}) {
  const { authorization } = useAuth();
  const companySettings = useCompanySettingsContract();
  /** Canonical company-aware money rendering — never a hand-rolled currency string. */
  const formatOmr = useCallback((value: number) => formatCompanyMoney(companySettings, value), [companySettings]);
  const initialRange = useMemo(currentMonthRange, []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [data, setData] = useState<FixedMonthlyAccrualList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reversalAccrualId, setReversalAccrualId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const canExecute = canAccess(authorization, 'financial.fixed_monthly_accruals.execute');
  const canReverse = canAccess(authorization, 'financial.fixed_monthly_accruals.reverse');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await listFixedMonthlyAccruals(dateFrom, dateTo));
    } catch {
      setError('تعذر تحميل سجل الاستحقاقات. تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const validateRange = () => {
    if (!dateFrom || !dateTo) return 'حدد تاريخ البداية والنهاية.';
    if (dateFrom > dateTo) return 'تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.';
    const days = Math.floor((Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000) + 1;
    if (days > 92) return 'اختر فترة لا تتجاوز 92 يومًا في المرة الواحدة.';
    return null;
  };

  const handleExecute = async () => {
    const validationError = validateRange();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsExecuting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await executeFixedMonthlyAccruals(dateFrom, dateTo, crypto.randomUUID());
      setNotice(
        `اكتمل التنفيذ: ${result.createdDays} يوم جديد، و${result.idempotentDays} يوم موجود مسبقًا، بإجمالي ${formatOmr(result.grossAmount)}.`,
      );
      await load();
    } catch {
      setError('تعذر تنفيذ الاستحقاقات. راجع الإعدادات المطلوبة ثم أعد المحاولة.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReverse = async () => {
    if (!reversalAccrualId) return;
    if (reversalReason.trim().length < 3) {
      setError('اكتب سببًا واضحًا للعكس لا يقل عن ثلاثة أحرف.');
      return;
    }
    setIsReversing(true);
    setError(null);
    setNotice(null);
    try {
      await reverseFixedMonthlyAccrual(
        reversalAccrualId,
        reversalReason.trim(),
        crypto.randomUUID(),
      );
      setNotice('تم تسجيل العكس مع الاحتفاظ بالاستحقاق الأصلي للمراجعة.');
      setReversalAccrualId(null);
      setReversalReason('');
      await load();
    } catch {
      setError('تعذر عكس الاستحقاق. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.');
    } finally {
      setIsReversing(false);
    }
  };

  const accrualColumns = useMemo<ColumnDef<FixedMonthlyAccrualRow>[]>(() => [
    {
      key: 'date',
      header: 'تاريخ الاستحقاق',
      priority: 'identity',
      render: (row) => <span className="whitespace-nowrap font-bold" dir="ltr">{formatCompactDate(row.accrualDate)}</span>,
    },
    {
      key: 'propertyOwner',
      header: 'العقار / المالك',
      priority: 'primary',
      render: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-bold">{row.propertyName}</span>
          <span className="block truncate text-xs text-muted-foreground">{row.ownerName}</span>
        </span>
      ),
    },
    {
      key: 'monthly',
      header: 'المبلغ الشهري',
      priority: 'secondary',
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatOmr(row.monthlyAmountOmr)}</span>,
    },
    {
      key: 'net',
      header: 'الصافي',
      priority: 'secondary',
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatOmr(row.netAmount)}</span>,
    },
    {
      key: 'tax',
      header: 'الضريبة',
      priority: 'detail',
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatOmr(row.taxAmount)}</span>,
    },
    {
      key: 'gross',
      header: 'الإجمالي',
      priority: 'primary',
      render: (row) => <span className="whitespace-nowrap font-bold tabular-nums">{formatOmr(row.grossAmount)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'secondary',
      render: (row) => {
        const status = statusPresentation(row);
        return (
          <span className="block min-w-0">
            <Badge variant={status.variant}>{status.label}</Badge>
            {row.latePosting ? <span className="mt-1 block text-xs text-warning">تم التسجيل في فترة لاحقة</span> : null}
            {row.reversalReason ? <span className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">{row.reversalReason}</span> : null}
          </span>
        );
      },
    },
    {
      key: 'postingDate',
      header: 'تاريخ التسجيل',
      priority: 'detail',
      render: (row) => <span className="whitespace-nowrap" dir="ltr">{row.postingDate ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراء',
      priority: 'actions',
      render: (row) => canReverse && row.status !== 'REVERSED' ? (
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات استحقاق ${formatCompactDate(row.accrualDate)}`}
            items={[{
              id: 'reverse',
              label: 'عكس',
              icon: RotateCcw,
              danger: true,
              onClick: () => {
                setReversalAccrualId(row.id);
                setReversalReason('');
              },
            }]}
          />
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
  ], [canReverse, formatOmr]);

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="أتعاب الإدارة الشهرية"
      description="احسب استحقاقات أتعاب الإدارة للفترة المحددة وفق الاتفاقيات السارية."
      workspaceName="fixed-monthly-accruals"
    >
      <div className="min-w-0 space-y-2.5 sm:space-y-3">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="fixed-accrual-from">من</Label>
            <Input
              id="fixed-accrual-from"
              type="date"
              dir="ltr"
              lang="en-GB"
              className="text-start tabular-nums"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="fixed-accrual-to">إلى</Label>
            <Input
              id="fixed-accrual-to"
              type="date"
              dir="ltr"
              lang="en-GB"
              className="text-start tabular-nums"
              value={dateTo}
              max={initialRange.to}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-self-end">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void load()}
              loading={isLoading}
              leftIcon={<RefreshCw className="size-4" />}
            >
              تحديث
            </Button>
            {canExecute ? (
              <Button
                className="min-h-11"
                onClick={() => void handleExecute()}
                loading={isExecuting}
                leftIcon={<Play className="size-4" />}
              >
                احتساب الاستحقاقات
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/5 p-2.5 text-xs leading-5 text-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p><strong>الضريبة غير محتسبة حاليًا:</strong> إعداد الضريبة المطلوب لهذا الاستحقاق غير مكتمل. راجع جاهزية المالية والضريبة قبل التنفيذ.</p>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            {notice}
          </div>
        ) : null}

        {data ? (
          <RegisterMetricStrip
            aria-label="ملخص الاستحقاقات"
            items={[
              { id: 'days', label: 'عدد الأيام', value: data.totalCount },
              { id: 'net', label: 'الصافي', value: formatOmr(data.netAmount) },
              { id: 'tax', label: 'الضريبة', value: formatOmr(data.taxAmount) },
              { id: 'gross', label: 'الإجمالي', value: formatOmr(data.grossAmount) },
            ]}
          />
        ) : null}

      {reversalAccrualId ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>عكس الاستحقاق</CardTitle>
            <CardDescription>اكتب سبب العكس. سيظل الاستحقاق الأصلي محفوظًا للمراجعة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="fixed-accrual-reversal-reason">السبب</Label>
            <Input
              id="fixed-accrual-reversal-reason"
              value={reversalReason}
              maxLength={1000}
              placeholder="مثال: تصحيح تاريخ سريان الاتفاقية"
              onChange={(event) => setReversalReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" loading={isReversing} onClick={() => void handleReverse()}>
                تأكيد العكس
              </Button>
              <Button
                variant="outline"
                disabled={isReversing}
                onClick={() => { setReversalAccrualId(null); setReversalReason(''); }}
              >
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

        <div className="min-w-0 space-y-2">
          {data?.truncated ? (
          <p className="px-0.5 text-xs font-bold text-warning">أول 500 سجل فقط · قلّل نطاق التاريخ</p>
        ) : null}

        <EntityTable
          rows={data?.accruals ?? []}
          columns={accrualColumns}
          keyOf={(row) => row.id}
          isLoading={isLoading}
          error={error && !data ? error : undefined}
          onRetry={() => void load()}
          emptyTitle="لا توجد استحقاقات"
          emptyDescription="لا توجد استحقاقات في النطاق المحدد. غيّر نطاق التاريخ أو احتسب الاستحقاقات."
          aria-label="سجل استحقاقات أتعاب الإدارة الشهرية"
        />
      </div>
      </div>
    </EmbeddableWorkspace>
  );
}

export default FixedMonthlyAccrualWorkspace;
