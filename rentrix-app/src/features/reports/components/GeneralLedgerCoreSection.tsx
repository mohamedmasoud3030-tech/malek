import { BookOpenCheck, CalendarClock, ListChecks, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { useGeneralLedgerCore, type AccountType, type NormalBalance, type AccountingPeriodStatus, type JournalBatchStatus } from '../use-general-ledger-core';
import type { ChartAccount, AccountingPeriod, JournalBatch } from '@/features/accounting/accountingDomain';

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
  const companySettings = useCompanySettingsContract();
  const currencyCode = companySettings.defaultCurrency || 'OMR';

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
                  الحسابات المحاسبية الأساسية المؤمّنة في نظام الأستاذ العام بالعملة المعتمدة ({currencyCode}).
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone="info">{accounts.length} حساب</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <EntityTable<ChartAccount>
            aria-label="شجرة الحسابات الموحدة"
            rows={accounts}
            keyOf={(account) => account.id}
            columns={accountColumns(currencyCode)}
            emptyTitle="لا توجد حسابات مسجلة بعد"
            emptyDescription="لا توجد حسابات مسجلة بعد في شجرة الحسابات. تواصل مع مسؤول النظام لإعداد شجرة الحسابات."
          />
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
          <EntityTable<AccountingPeriod>
            aria-label="الفترات المحاسبية"
            rows={periods}
            keyOf={(period) => period.id}
            columns={periodColumns}
            emptyTitle="لا توجد فترات محاسبية"
            emptyDescription="لا توجد فترات محاسبية مسجلة. راجع مسؤول النظام لفتح الفترات المحاسبية."
          />
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
          <EntityTable<JournalBatch>
            aria-label="أحدث قيود اليومية"
            rows={batches}
            keyOf={(batch) => batch.id}
            columns={batchColumns}
            emptyTitle="لا توجد قيود يومية"
            emptyDescription="لا توجد قيود يومية مسجلة بعد. ستظهر القيود تلقائياً عند تسجيل المعاملات المالية."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function accountColumns(currencyCode: string): ColumnDef<ChartAccount>[] {
  return [
    {
      key: 'no',
      header: 'رقم الحساب',
      priority: 'identity',
      className: 'font-mono font-bold text-foreground',
      render: (account) => account.no || (account as Record<string, unknown>).account_no as string || '—',
    },
    {
      key: 'name',
      header: 'اسم الحساب',
      priority: 'primary',
      className: 'font-semibold',
      render: (account) => account.name,
    },
    {
      key: 'account_type',
      header: 'التصنيف المحاسبي',
      priority: 'secondary',
      render: (account) => (
        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
          {accountTypeLabel(account.account_type)}
        </span>
      ),
    },
    {
      key: 'normal_balance',
      header: 'الرصيد الطبيعي',
      priority: 'secondary',
      className: 'font-medium',
      render: (account) => normalBalanceLabel(account.normal_balance),
    },
    {
      key: 'currency_code',
      header: 'العملة',
      priority: 'detail',
      className: 'font-mono text-muted-foreground',
      render: (account) => account.currency_code || currencyCode,
    },
    {
      key: 'is_active',
      header: 'الحالة',
      priority: 'detail',
      render: (account) => (
        <StatusBadge tone={account.is_active ? 'green' : 'neutral'}>
          {account.is_active ? 'نشط' : 'غير نشط'}
        </StatusBadge>
      ),
    },
  ];
}

const periodColumns: ColumnDef<AccountingPeriod>[] = [
  {
    key: 'name',
    header: 'اسم الفترة',
    priority: 'identity',
    className: 'font-bold',
    render: (period) => period.name,
  },
  {
    key: 'start_date',
    header: 'من تاريخ',
    priority: 'primary',
    className: 'font-mono text-muted-foreground',
    render: (period) => period.start_date,
  },
  {
    key: 'end_date',
    header: 'إلى تاريخ',
    priority: 'secondary',
    className: 'font-mono text-muted-foreground',
    render: (period) => period.end_date,
  },
  {
    key: 'status',
    header: 'حالة الإغلاق',
    priority: 'secondary',
    render: (period) => periodStatusBadge(period.status),
  },
  {
    key: 'closed_at',
    header: 'تاريخ الإغلاق',
    priority: 'detail',
    className: 'font-mono text-muted-foreground',
    render: (period) => period.closed_at || '—',
  },
];

const batchColumns: ColumnDef<JournalBatch>[] = [
  {
    key: 'description',
    header: 'القيد',
    priority: 'identity',
    className: 'font-mono font-bold',
    render: (batch) => batch.description || 'قيد يومية',
  },
  {
    key: 'effective_date',
    header: 'تاريخ الترحيل',
    priority: 'primary',
    className: 'font-mono text-muted-foreground',
    render: (batch) => batch.effective_date,
  },
  {
    key: 'source_type',
    header: 'المصدر',
    priority: 'secondary',
    className: 'font-semibold',
    render: (batch) => batch.source_type || '—',
  },
  {
    key: 'statement',
    header: 'البيان',
    priority: 'detail',
    className: 'font-mono text-xs text-muted-foreground',
    render: (batch) => batch.description || 'مصدر محاسبي مسجل',
  },
  {
    key: 'status',
    header: 'الحالة',
    priority: 'secondary',
    render: (batch) => batchStatusBadge(batch.status),
  },
];
