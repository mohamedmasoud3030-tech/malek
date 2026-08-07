import { BookOpenCheck, CalendarClock, ListChecks, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useGeneralLedgerCore, type AccountType, type NormalBalance, type AccountingPeriodStatus, type JournalBatchStatus } from '../use-general-ledger-core';

function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'asset':
      return 'أصل';
    case 'liability':
      return 'التزام';
    case 'revenue':
      return 'إيراد';
    case 'expense':
      return 'مصروف';
    case 'equity':
      return 'حقوق ملكية';
    default:
      return 'أخرى';
  }
}

function normalBalanceLabel(balance: NormalBalance): string {
  return balance === 'debit' ? 'مدين (Dr)' : 'دائن (Cr)';
}

function periodStatusBadge(status: AccountingPeriodStatus) {
  switch (status) {
    case 'HARD_CLOSED':
      return <StatusBadge tone="danger">إغلاق نهائي</StatusBadge>;
    case 'SOFT_CLOSED':
      return <StatusBadge tone="gold">إغلاق مرن</StatusBadge>;
    case 'OPEN':
    default:
      return <StatusBadge tone="green">مفتوحة</StatusBadge>;
  }
}

function batchStatusBadge(status: JournalBatchStatus) {
  switch (status) {
    case 'POSTED':
      return <StatusBadge tone="green">مرحّل</StatusBadge>;
    case 'REVERSED':
      return <StatusBadge tone="danger">معكوس</StatusBadge>;
    case 'DRAFT':
    default:
      return <StatusBadge tone="gold">مسودة</StatusBadge>;
  }
}

export function GeneralLedgerCoreSection() {
  const { accounts, periods, batches, isLoading, isError, refetchAll } = useGeneralLedgerCore();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">تعذر تحميل بيانات دفتر الأستاذ العام</CardTitle>
          <CardDescription>حدث خطأ أثناء الاتصال بخدمات المحاسبة والشجرة المالية.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCcw className="me-2 size-4" />
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart of Accounts Card */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-card">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <BookOpenCheck className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-extrabold">شجرة الحسابات الموحدة (Chart of Accounts)</CardTitle>
                <CardDescription className="text-xs">
                  الحسابات المحاسبية الأساسية المؤمّنة في نظام الأستاذ العام بالريال العماني (OMR).
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone="info">{accounts.length} حساب</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد حسابات مسجلة بعد في شجرة الحسابات.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start font-bold">رقم الحساب</th>
                    <th className="p-3 text-start font-bold">اسم الحساب</th>
                    <th className="p-3 text-start font-bold">التصنيف المحاسبي</th>
                    <th className="p-3 text-start font-bold">الرصيد الطبيعي</th>
                    <th className="p-3 text-start font-bold">العملة</th>
                    <th className="p-3 text-start font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-muted/15">
                      <td className="p-3 font-mono font-bold text-foreground">{account.no || (account as Record<string, unknown>).account_no as string || '—'}</td>
                      <td className="p-3 font-semibold">{account.name}</td>
                      <td className="p-3">
                        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                          {accountTypeLabel(account.account_type)}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{normalBalanceLabel(account.normal_balance)}</td>
                      <td className="p-3 font-mono text-muted-foreground">{account.currency_code || 'OMR'}</td>
                      <td className="p-3">
                        <StatusBadge tone={account.is_active ? 'green' : 'neutral'}>
                          {account.is_active ? 'نشط' : 'غير نشط'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounting Periods Card */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-card">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-extrabold">الفترات المحاسبية وإغلاق الأشهر (Accounting Periods)</CardTitle>
                <CardDescription className="text-xs">
                  حالة الفترات المحاسبية الشهرية: مفتوحة (OPEN)، إغلاق مرن (SOFT_CLOSED)، أو إغلاق نهائي (HARD_CLOSED).
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone="info">{periods.length} فترات</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد فترات محاسبية مسجلة.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start font-bold">اسم الفترة</th>
                    <th className="p-3 text-start font-bold">من تاريخ</th>
                    <th className="p-3 text-start font-bold">إلى تاريخ</th>
                    <th className="p-3 text-start font-bold">حالة الإغلاق</th>
                    <th className="p-3 text-start font-bold">تاريخ الإغلاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {periods.map((period) => (
                    <tr key={period.id} className="hover:bg-muted/15">
                      <td className="p-3 font-bold">{period.name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{period.start_date}</td>
                      <td className="p-3 font-mono text-muted-foreground">{period.end_date}</td>
                      <td className="p-3">{periodStatusBadge(period.status)}</td>
                      <td className="p-3 font-mono text-muted-foreground">{period.closed_at || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal Batches Card */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-card">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <ListChecks className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-extrabold">أحدث قيود اليومية (Journal Batches)</CardTitle>
                <CardDescription className="text-xs">
                  سجل الدفعات المحاسبية المرحّلة تلقائياً عبر محرك القيود المزدوجة في النظام.
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone="neutral">أحدث {batches.length} قيد</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد قيود يومية مسجلة بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start font-bold">رقم القيد</th>
                    <th className="p-3 text-start font-bold">تاريخ الترحيل</th>
                    <th className="p-3 text-start font-bold">المصدر</th>
                    <th className="p-3 text-start font-bold">المعرّف</th>
                    <th className="p-3 text-start font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted/15">
                      <td className="p-3 font-mono font-bold">{batch.id ? batch.id.slice(0, 8) : '—'}</td>
                      <td className="p-3 font-mono text-muted-foreground">{batch.effective_date}</td>
                      <td className="p-3 font-semibold">{batch.source_type || '—'}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{batch.description || batch.source_id || '—'}</td>
                      <td className="p-3">{batchStatusBadge(batch.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
