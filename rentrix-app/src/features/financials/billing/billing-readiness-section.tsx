import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, FileCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useActiveCompanyId } from '@/hooks/use-company';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import {
  getBillingReadiness,
  type BillingObligation,
  type BillingStatus,
} from './billing-readiness-service';
import {
  billingIssueMessage,
  billingStatusLabel,
  paymentCycleLabel,
} from './billing-readiness-presentation';

function toneForStatus(status: BillingStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'GENERATED':
      return 'success';
    case 'DUE':
      return 'warning';
    case 'BLOCKED':
    case 'CHECK_FAILED':
      return 'danger';
    case 'NOT_DUE':
      return 'info';
    default:
      return 'neutral';
  }
}

export function BillingReadinessSection() {
  const companyId = useActiveCompanyId();
  const companySettings = useCompanySettingsContract();
  const [showDetails, setShowDetails] = useState(false);
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);

  const readinessQuery = useQuery({
    queryKey: ['billing-readiness', companyId],
    enabled: Boolean(companyId),
    queryFn: () => getBillingReadiness(companyId!),
  });

  const obligations = readinessQuery.data ?? [];
  const filtered = showOnlyActionable
    ? obligations.filter((obligation) => ['BLOCKED', 'DUE', 'CHECK_FAILED'].includes(obligation.status))
    : obligations;

  const totalDue = obligations.filter((obligation) => obligation.status === 'DUE').length;
  const totalGenerated = obligations.filter((obligation) => obligation.status === 'GENERATED').length;
  const totalBlocked = obligations.filter((obligation) => obligation.status === 'BLOCKED').length;
  const totalNotDue = obligations.filter((obligation) => obligation.status === 'NOT_DUE').length;
  const totalCheckFailed = obligations.filter((obligation) => obligation.status === 'CHECK_FAILED').length;
  const needsAttention = totalBlocked + totalCheckFailed;
  const actionableCount = needsAttention + totalDue;

  const columns = useMemo((): ColumnDef<BillingObligation>[] => [
    {
      key: 'contract',
      header: 'العقد',
      priority: 'identity',
      render: (obligation) => (
        <div className="min-w-0">
          <p className="font-bold tabular-nums">{obligation.contract_id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">
            {paymentCycleLabel(obligation.payment_cycle)} · يوم {obligation.billing_day} · سماح {obligation.grace_days} يوم
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'القيمة',
      priority: 'primary',
      render: (obligation) => (
        <span dir="ltr" className="font-bold tabular-nums">
          {formatCompanyMoney(companySettings, obligation.rent_amount)}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'الموعد',
      priority: 'detail',
      render: (obligation) => (
        <div className="min-w-0 text-xs">
          <p dir="ltr" className="tabular-nums">{obligation.period_start} → {obligation.period_end}</p>
          <p className="text-muted-foreground">إصدار {obligation.issue_date} · استحقاق {obligation.due_date}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'primary',
      render: (obligation) => {
        const issue = billingIssueMessage(obligation.blocked_reason, obligation.status);
        return (
          <div className="space-y-1.5" data-billing-status={obligation.status}>
            <StatusBadge tone={toneForStatus(obligation.status)}>{billingStatusLabel(obligation.status)}</StatusBadge>
            {issue ? <p className="max-w-md text-xs leading-5 text-destructive">{issue}</p> : null}
            {obligation.invoice_exists ? (
              <p className="text-xs text-success">فاتورة {obligation.invoice_id?.slice(0, 8)}</p>
            ) : null}
          </div>
        );
      },
    },
  ], []);

  const status = readinessQuery.isLoading
    ? ('loading' as const)
    : readinessQuery.isError
      ? ('error' as const)
      : obligations.length === 0
        ? ('empty' as const)
        : ('ready' as const);

  const openActionable = () => {
    setShowOnlyActionable(true);
    setShowDetails(true);
  };

  const toggleDetails = () => {
    setShowDetails((current) => {
      if (current) setShowOnlyActionable(false);
      return !current;
    });
  };

  return (
    <Card data-billing-readiness data-billing-details={showDetails ? 'open' : 'closed'}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-5" aria-hidden="true" />
            جاهزية الفوترة
          </CardTitle>
          <StatusBadge tone={needsAttention > 0 ? 'danger' : totalDue > 0 ? 'warning' : 'success'}>
            {needsAttention > 0 ? `${needsAttention} يحتاج إجراءً` : totalDue > 0 ? `${totalDue} جاهز للفوترة` : 'مستقر'}
          </StatusBadge>
        </div>
        <p className="text-xs font-medium leading-5 text-muted-foreground">
          ملخص سريع للعقود قبل إصدار الفواتير. افتح التفاصيل فقط عند الحاجة للمراجعة.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4" aria-label="ملخص جاهزية الفوترة">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2">
            <Clock className="size-3.5 text-warning" aria-hidden="true" />
            <span>جاهز <strong>{totalDue}</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2">
            <AlertTriangle className="size-3.5 text-destructive" aria-hidden="true" />
            <span>يحتاج إجراءً <strong>{needsAttention}</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2">
            <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
            <span>تم الإصدار <strong>{totalGenerated}</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2">
            <FileCheck className="size-3.5 text-info" aria-hidden="true" />
            <span>لاحقًا <strong>{totalNotDue}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={toggleDetails}>
            {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </Button>
          {actionableCount > 0 ? (
            <Button type="button" size="sm" variant={showOnlyActionable ? 'default' : 'outline'} className="min-h-11" onClick={openActionable}>
              تحتاج إجراءً ({actionableCount})
            </Button>
          ) : null}
        </div>

        {(showDetails || status !== 'ready') ? (
          <AsyncContentState
            status={status}
            error={readinessQuery.error as Error}
            errorTitle="تعذر تحميل جاهزية الفوترة"
            errorAction={<Button onClick={() => readinessQuery.refetch()}>إعادة المحاولة</Button>}
            emptyTitle="لا توجد التزامات فوترة حاليًا"
            emptyDescription="ستظهر هنا العقود النشطة عندما تصبح لها دفعات قابلة للمتابعة."
          >
            <EntityTable aria-label="التزامات الفوترة" rows={filtered} columns={columns} keyOf={(obligation) => obligation.contract_id} />
          </AsyncContentState>
        ) : null}
      </CardContent>
    </Card>
  );
}
