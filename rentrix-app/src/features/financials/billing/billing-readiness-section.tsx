import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileCheck, CalendarDays, ShieldAlert, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { AsyncContentState } from '@/components/async-content-state';
import { useActiveCompanyId } from '@/hooks/use-company';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getBillingReadiness, generateInvoicesFromActiveContracts, type BillingObligation, type BillingStatus } from './billing-readiness-service';

function toneForStatus(status: BillingStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'GENERATED':
      return 'success';
    case 'DUE':
      return 'warning';
    case 'BLOCKED':
      return 'danger';
    case 'NOT_DUE':
      return 'info';
    case 'CHECK_FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function labelForStatus(status: BillingStatus): string {
  switch (status) {
    case 'NOT_DUE':
      return 'غير مستحق بعد (قبل يوم الفوترة)';
    case 'DUE':
      return 'مستحق';
    case 'GENERATED':
      return 'تم إنشاؤه';
    case 'BLOCKED':
      return 'محظور';
    case 'CHECK_FAILED':
      return 'فشل التحقق — مغلق';
    default:
      return status;
  }
}

export function BillingReadinessSection() {
  const companyId = useActiveCompanyId();
  const queryClient = useQueryClient();
  const [showOnlyBlocked, setShowOnlyBlocked] = useState(false);

  const readinessQuery = useQuery({
    queryKey: ['billing-readiness', companyId],
    enabled: Boolean(companyId),
    queryFn: () => getBillingReadiness(companyId!),
  });

  const generateMut = useMutation({
    mutationFn: generateInvoicesFromActiveContracts,
    onSuccess: (count) => {
      toast.success(`تم توليد ${count} فاتورة من العقود النشطة`);
      void queryClient.invalidateQueries({ queryKey: ['billing-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'تعذر توليد الفواتير'),
  });

  const obligations = readinessQuery.data ?? [];
  const filtered = showOnlyBlocked ? obligations.filter((o) => o.status === 'BLOCKED' || o.status === 'DUE' || o.status === 'CHECK_FAILED') : obligations;

  const totalDue = obligations.filter((o) => o.status === 'DUE').length;
  const totalGenerated = obligations.filter((o) => o.status === 'GENERATED').length;
  const totalBlocked = obligations.filter((o) => o.status === 'BLOCKED').length;
  const totalNotDue = obligations.filter((o) => o.status === 'NOT_DUE').length;
  const totalCheckFailed = obligations.filter((o) => o.status === 'CHECK_FAILED').length;

  const columns: ColumnDef<BillingObligation>[] = [
    {
      key: 'contract',
      header: 'العقد',
      priority: 'identity',
      render: (o) => (
        <div className="min-w-0">
          <p className="font-bold tabular-nums">{o.contract_id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{o.payment_cycle} — يوم {o.billing_day} + سماح {o.grace_days}</p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'فترة الاستحقاق',
      priority: 'detail',
      render: (o) => (
        <div className="min-w-0">
          <p dir="ltr" className="tabular-nums text-xs">
            {o.period_start} → {o.period_end}
          </p>
          <p dir="ltr" className="tabular-nums text-xs text-muted-foreground">
            إصدار: {o.issue_date} — استحقاق: {o.due_date}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'قيمة الدفعة التعاقدية',
      priority: 'detail',
      render: (o) => <span dir="ltr" className="font-bold tabular-nums">{o.rent_amount.toFixed(3)} OMR</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'primary',
      render: (o) => (
        <div className="space-y-1">
          <StatusBadge tone={toneForStatus(o.status)}>{labelForStatus(o.status)}</StatusBadge>
          {o.blocked_reason ? <p className="text-xs text-destructive">{o.blocked_reason}</p> : null}
          {o.invoice_exists ? <p className="text-xs text-success">فاتورة: {o.invoice_id?.slice(0, 8)}</p> : null}
        </div>
      ),
    },
    {
      key: 'meta',
      header: 'المرجع',
      priority: 'secondary',
      render: (o) => (
        <div className="text-xs">
          <p>اتفاقية: {o.agreement_id ? o.agreement_id.slice(0, 8) : '—'}</p>
          <p>دور: {o.collection_role ?? '—'}</p>
          <p>شرط سداد: {o.payment_terms_id ? o.payment_terms_id.slice(0, 8) + ' (مرجع فقط)' : '—'}</p>
        </div>
      ),
    },
  ];

  const isLoading = readinessQuery.isLoading;
  const isError = readinessQuery.isError;
  const isEmpty = obligations.length === 0;

  const status = isLoading ? ('loading' as const) : isError ? ('error' as const) : isEmpty ? ('empty' as const) : ('ready' as const);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-5" />
          جاهزية الفوترة والالتزامات
          <StatusBadge tone={totalBlocked > 0 || totalCheckFailed > 0 ? 'danger' : totalDue > 0 ? 'warning' : 'success'}>
            {totalBlocked > 0 ? `محظور ${totalBlocked}` : totalCheckFailed > 0 ? `فشل تحقق ${totalCheckFailed}` : totalDue > 0 ? `مستحق ${totalDue}` : 'جاهز'}
          </StatusBadge>
        </CardTitle>
        <CardDescription className="space-y-1">
          <p>
            كل عقد نشط OWNER_AGENCY له سياسة فوترة صريحة: يوم الفوترة (1–28) يثبت تاريخ الإصدار داخل الفترة، وتاريخ الاستحقاق = نهاية الفترة + أيام السماح. payment_terms_id هو مرجع فقط، لا يحدد الجدولة حاليًا. الحالة تُحسب من تاريخ الإصدار: قبل يوم الفوترة → غير مستحق، يوم/بعد يوم الفوترة وبدون فاتورة → مستحق، فاتورة موجودة → تم إنشاؤه.
          </p>
          <p>
            الفوترة تتم عبر RPC الذري <code>generate_invoices_from_active_contracts</code> وهو idempotent (نفس الفترة لا تُفوتر مرتين بفضل الفهرس الفريد ux_invoices_billing_obligation). المشغل يرى حالة كل التزام: غير مستحق، مستحق، تم إنشاؤه، محظور، فشل تحقق — لا يستنتج الصحة من زر التوليد فقط. حالات FAILED/RECOVERED أُزيلت لعدم وجود سجل تاريخي محكوم للفشل اليوم؛ تُوثق كتحسين مستقبلي.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> مستحق: {totalDue}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-success" /> تم إنشاؤه: {totalGenerated}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3.5 text-destructive" /> محظور: {totalBlocked}
            </span>
            <span className="flex items-center gap-1">
              <FileCheck className="size-3.5 text-info" /> غير مستحق (قبل يوم الفوترة): {totalNotDue}
            </span>
            {totalCheckFailed > 0 ? <span className="flex items-center gap-1 text-destructive">فشل تحقق: {totalCheckFailed}</span> : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={showOnlyBlocked ? 'default' : 'outline'} onClick={() => setShowOnlyBlocked((v) => !v)}>
              {showOnlyBlocked ? 'عرض الكل' : 'عرض المحظور/المستحق فقط'}
            </Button>
            <Button size="sm" variant="default" onClick={() => generateMut.mutate()} disabled={generateMut.isPending} className="gap-1">
              <RefreshCcw className="size-4" />
              {generateMut.isPending ? 'جارٍ التوليد...' : 'توليد فواتير العقود النشطة (استرداد)'}
            </Button>
          </div>
        </div>

        <AsyncContentState
          status={status}
          error={readinessQuery.error as Error}
          errorTitle="تعذر تحميل جاهزية الفوترة"
          errorAction={<Button onClick={() => readinessQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا توجد عقود نشطة"
          emptyDescription="لا توجد عقود بحالة active مع سياسة فوترة. أنشئ عقدًا نشطًا أولاً."
        >
          <EntityTable aria-label="التزامات الفوترة" rows={filtered} columns={columns} keyOf={(o) => o.contract_id} />
        </AsyncContentState>

        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5">
          <p className="font-bold flex items-center gap-1">
            <ShieldAlert className="size-4" />
            كيف يعمل الاسترداد المتكرر والتحقق الفاشل؟
          </p>
          <p>
            نفس الفترة لا تُفوتر مرتين بفضل الفهرس الفريد <code>ux_invoices_billing_obligation</code> على (company_id, contract_id, charge_type, billing_period_start). إذا كان العقد محظورًا سابقًا بسبب TAX_PROFILE_MISSING أو AGREEMENT_MISSING، فإن إصلاح السبب ثم ضغط توليد يعيد نفس الدفعة وينشئ الفاتورة الناقصة فقط — لا تكرار. حالات FAILED/RECOVERED غير موجودة اليوم لعدم وجود سجل محاولات فوترة محكوم؛ تُوثق كتحسين مستقبلي.
          </p>
          <p className="mt-1">فشل التحقق من السلطة الضريبية (شبكة/RLS/RPC) يظهر كـ CHECK_FAILED مغلق، لا كـ READY.</p>
          <p className="mt-1">payment_terms_id حاليًا مرجع فقط. الجدولة الفعلية تُحسم من حقول العقد الصريحة payment_cycle, billing_day, grace_days عبر خوارزمية واحدة موحدة في billing-schedule.ts مطابقة للخادم.</p>
        </div>
      </CardContent>
    </Card>
  );
}
