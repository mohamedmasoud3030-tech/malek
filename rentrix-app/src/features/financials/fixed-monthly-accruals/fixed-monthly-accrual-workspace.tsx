import { CalendarRange, Play, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import {
  executeFixedMonthlyAccruals,
  listFixedMonthlyAccruals,
  reverseFixedMonthlyAccrual,
  type FixedMonthlyAccrualList,
  type FixedMonthlyAccrualRow,
} from './fixed-monthly-accrual-service';

const omrFormatter = new Intl.NumberFormat('ar-OM', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function formatOmr(value: number) {
  return `${omrFormatter.format(value)} ر.ع`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: getTodayLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: getTodayLocalDateString(now),
  };
}

function statusPresentation(row: FixedMonthlyAccrualRow) {
  if (row.status === 'REVERSED') return { label: 'معكوس', variant: 'neutral' as const };
  if (row.status === 'ZERO_AMOUNT') return { label: 'قيمة صفرية', variant: 'info' as const };
  if (row.status === 'POSTED' && row.latePosting) return { label: 'مرحّل متأخرًا', variant: 'warning' as const };
  if (row.status === 'POSTED') return { label: 'مرحّل', variant: 'success' as const };
  return { label: 'يحتاج مراجعة', variant: 'danger' as const };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function FixedMonthlyAccrualWorkspace() {
  const { authorization } = useAuth();
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
    } catch (loadError) {
      setError(errorMessage(loadError, 'تعذر تحميل سجل الاستحقاقات.'));
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
    if (days > 92) return 'الحد الأقصى للتنفيذ المتراكم هو 92 يومًا في الطلب الواحد.';
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
    } catch (executeError) {
      setError(errorMessage(executeError, 'تعذر تنفيذ الاستحقاقات.'));
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
      setNotice('تم إنشاء قيد عكسي متوازن مع الحفاظ على سجل الاستحقاق الأصلي.');
      setReversalAccrualId(null);
      setReversalReason('');
      await load();
    } catch (reverseError) {
      setError(errorMessage(reverseError, 'تعذر عكس الاستحقاق.'));
    } finally {
      setIsReversing(false);
    }
  };

  const accrualColumns = useMemo<ColumnDef<FixedMonthlyAccrualRow>[]>(() => [
    {
      key: 'date',
      header: 'التاريخ الاقتصادي',
      priority: 'identity',
      render: (row) => <span className="whitespace-nowrap font-bold" dir="ltr">{row.accrualDate}</span>,
    },
    {
      key: 'propertyOwner',
      header: 'العقار / المالك',
      priority: 'primary',
      render: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-bold">{row.propertyName}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{row.ownerName} · نسخة {row.versionNo}</span>
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
      header: 'حالة الترحيل',
      priority: 'secondary',
      render: (row) => {
        const status = statusPresentation(row);
        return (
          <span className="block min-w-0">
            <Badge variant={status.variant}>{status.label}</Badge>
            {row.latePosting ? <span className="mt-1 block text-[10px] text-warning">فترة لاحقة مفتوحة</span> : null}
            {row.reversalReason ? <span className="mt-1 block max-w-48 truncate text-[10px] text-muted-foreground">{row.reversalReason}</span> : null}
          </span>
        );
      },
    },
    {
      key: 'postingDate',
      header: 'تاريخ الترحيل',
      priority: 'detail',
      render: (row) => <span className="whitespace-nowrap" dir="ltr">{row.postingDate ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراء',
      priority: 'actions',
      render: (row) => canReverse && row.status !== 'REVERSED' ? (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RotateCcw className="size-3.5" />}
          onClick={() => {
            setReversalAccrualId(row.id);
            setReversalReason('');
          }}
        >
          عكس
        </Button>
      ) : <span className="text-muted-foreground">—</span>,
    },
  ], [canReverse]);

  return (
    <section className="space-y-4" aria-label="استحقاقات العمولة الشهرية الثابتة">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="size-5 text-primary" aria-hidden="true" />
                الاستحقاق اليومي للعمولة الشهرية
              </CardTitle>
              <CardDescription>
                تنفيذ آمن ومحدود لنسخ الاتفاقيات المجمدة من نوع FIXED_MONTHLY / DAILY_ACCRUAL.
              </CardDescription>
            </div>
            <Badge variant="outline">OMR · دقة 3 منازل</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="fixed-accrual-from">من تاريخ</Label>
              <Input
                id="fixed-accrual-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="fixed-accrual-to">إلى تاريخ</Label>
              <Input
                id="fixed-accrual-to"
                type="date"
                value={dateTo}
                max={initialRange.to}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="col-span-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void load()}
                loading={isLoading}
                leftIcon={<RefreshCw className="size-4" />}
              >
                تحديث
              </Button>
              {canExecute ? (
                <Button
                  onClick={() => void handleExecute()}
                  loading={isExecuting}
                  leftIcon={<Play className="size-4" />}
                >
                  تنفيذ الاستحقاق
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-6 text-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>
              الضريبة غير مطبقة في هذه المرحلة لعدم وجود إعداد ضريبي رسمي مُؤرّخ صالح لليوم الاقتصادي؛
              لا يقبل الخادم نسبة أو مبلغ ضريبة من المتصفح ولا ينشئ حركة على الحساب 2100.
            </p>
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
        </CardContent>
      </Card>

      {data ? (
        <ResponsiveCardGrid gap="sm">
          <Card variant="statistic"><p className="text-xs text-muted-foreground">عدد الأيام</p><p className="mt-1 text-xl font-black">{data.totalCount}</p></Card>
          <Card variant="statistic"><p className="text-xs text-muted-foreground">الصافي</p><p className="mt-1 text-xl font-black">{formatOmr(data.netAmount)}</p></Card>
          <Card variant="statistic"><p className="text-xs text-muted-foreground">الضريبة</p><p className="mt-1 text-xl font-black">{formatOmr(data.taxAmount)}</p></Card>
          <Card variant="statistic"><p className="text-xs text-muted-foreground">الإجمالي</p><p className="mt-1 text-xl font-black">{formatOmr(data.grossAmount)}</p></Card>
        </ResponsiveCardGrid>
      ) : null}

      {reversalAccrualId ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>سبب العكس المحاسبي</CardTitle>
            <CardDescription>سيبقى الاستحقاق الأصلي دون تعديل ويُنشأ قيد تعويضي منفصل.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="fixed-accrual-reversal-reason">السبب</Label>
            <Input
              id="fixed-accrual-reversal-reason"
              value={reversalReason}
              maxLength={1000}
              placeholder="مثال: تصحيح تاريخ سريان نسخة الاتفاقية"
              onChange={(event) => setReversalReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" loading={isReversing} onClick={() => void handleReverse()}>
                تأكيد إنشاء القيد العكسي
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

      <section className="space-y-2" aria-labelledby="fixed-accrual-register-title">
        <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
          <div>
            <h3 id="fixed-accrual-register-title" className="text-sm font-black">سجل الاستحقاقات</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              التاريخ الاقتصادي والمبالغ والقيد الناتج وحالة الترحيل أو العكس في سجل موحد.
            </p>
          </div>
          {data?.truncated ? (
            <span className="text-xs font-bold text-warning">أول 500 سجل فقط · قلّل نطاق التاريخ</span>
          ) : null}
        </div>

        <EntityTable
          rows={data?.accruals ?? []}
          columns={accrualColumns}
          keyOf={(row) => row.id}
          isLoading={isLoading}
          error={error && !data ? error : undefined}
          onRetry={() => void load()}
          emptyTitle="لا توجد استحقاقات"
          emptyDescription="لا توجد استحقاقات في النطاق المحدد."
          mobileVisibleSecondaryKey="gross"
          aria-label="سجل الاستحقاقات الشهرية الثابتة"
        />
      </section>
    </section>
  );
}

export default FixedMonthlyAccrualWorkspace;
