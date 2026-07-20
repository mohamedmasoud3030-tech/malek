import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ClipboardList, FileCheck, FileText, Landmark, ReceiptText, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProperties } from '@/features/properties/use-properties';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { cn } from '@/lib/utils';
import { ArrearsWorkspaceSection } from './components/arrears-workspace-section';
import { ExpensesSection, type ExpenseFormValues } from './components/expenses-section';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { InvoiceWorkspaceSection } from './components/invoice-workspace-section';
import { DepositsWorkspace } from './deposits/deposits-workspace';
import { OPERATIONAL_EXPENSE_CATEGORIES, type OperationalExpenseFilterValues } from './expenses/operational-expenses';
import { useCreateExpenseAtomic, useExpenses } from './expenses/useExpenses';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';

const expenseSchema = z.object({
  property_id: z.string().trim().min(1, 'اختر العقار'),
  category: z.enum(OPERATIONAL_EXPENSE_CATEGORIES, { message: 'اختر التصنيف' }),
  cost_center_id: z.string().optional(),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expense_date: z.string().min(1, 'اختر التاريخ'),
  description: z.string().optional(),
  attachment_url: z.string().nullable().optional(),
});

function getCurrentMonthReportRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: getTodayLocalDateString(firstDay),
    dateTo: getTodayLocalDateString(lastDay),
    status: 'all' as const,
  };
}

type FinancialsTab = 'invoices' | 'receipts' | 'expenses' | 'arrears' | 'reconciliation' | 'deposits';

const financialTabs = [
  ['invoices', 'الفواتير والتحصيل', 'مراجعة وتسجيل دفعات الفواتير', FileText],
  ['receipts', 'السدادات والإيصالات', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText],
  ['expenses', 'المصروفات التشغيلية', 'تسجيل ومراجعة نفقات العقارات', WalletCards],
  ['arrears', 'جدول المتأخرات والديون', 'متابعة الذمم وأعمار الديون', ClipboardList],
  ['reconciliation', 'مطابقة كشف البنك', 'مطابقة السجلات مع الحسابات البنكية', Landmark],
  ['deposits', 'تأمين وأمانات المستأجرين', 'تتبع مبالغ أمانات وعقود التأمين', FileCheck],
] as const satisfies readonly [FinancialsTab, string, string, typeof FileText][];

export function FinancialsPage() {
  const { data: properties } = useProperties({ page: 1, pageSize: 100, search: '', status: 'all' });
  const [activeTab, setActiveTab] = useState<FinancialsTab>('invoices');
  const [filters, setFilters] = useState<OperationalExpenseFilterValues>({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const { data: expenses = [] } = useExpenses(filters);
  const { data: costCenterRows = [] } = useCostCenters();
  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  const createExpense = useCreateExpenseAtomic();
  const propertyRows = properties?.rows ?? [];

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: '',
      category: 'صيانة',
      cost_center_id: '',
      amount: 0,
      expense_date: getTodayLocalDateString(),
      description: '',
      attachment_url: null,
    },
  });

  const onCreateExpense = (values: ExpenseFormValues) => {
    createExpense.mutate(
      {
        requestId: crypto.randomUUID(),
        propertyId: values.property_id,
        category: values.category,
        costCenterId: values.cost_center_id?.trim() || null,
        amount: values.amount,
        expenseDate: values.expense_date,
        description: values.description?.trim() ? values.description.trim() : null,
        attachmentUrl: values.attachment_url ?? null,
      },
      {
        onSuccess: () => {
          expenseForm.reset({
            property_id: '',
            category: 'صيانة',
            cost_center_id: '',
            amount: 0,
            expense_date: getTodayLocalDateString(),
            description: '',
            attachment_url: null,
          });
        },
      },
    );
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="مركز إدارة الماليات والمحاسبة"
        description="منظومة موحدة لإدارة الفواتير المستحقة، التحصيلات، الإيصالات المعتمدة، المصروفات التشغيلية، ومطابقة البنك."
        secondaryActions={(
          <>
            <Button variant="secondary" asChild><Link to="/invoices">الفواتير</Link></Button>
            <Button variant="secondary" asChild><Link to="/receipts">الإيصالات</Link></Button>

            <Button variant="secondary" asChild><Link to="/expenses">المصاريف</Link></Button>
            <Button variant="secondary" asChild><Link to="/bank-reconciliation">مطابقة البنك</Link></Button>
          </>
        )}
      />

      <FinancialReportsPreviewSection
        reportFilters={reportFilters}
        collectionSummary={collectionReport.data}
        isLoading={collectionReport.isLoading}
        isError={collectionReport.isError}
        error={collectionReport.error}
      />

      <Card>
        <CardContent className="space-y-5 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label="أقسام المالية الموحدة">
            {financialTabs.map(([tab, label, description, Icon]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-right transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5',
                  activeTab === tab ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background',
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{label}</span>
                  <span className={cn('block truncate text-[11px] font-medium', activeTab === tab ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{description}</span>
                </span>
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {activeTab === 'invoices' ? <InvoiceWorkspaceSection /> : null}
            {activeTab === 'receipts' ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-bold">سجل الإيصالات وطباعة السندات A4</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">افتح مساحة الإيصالات الكاملة للبحث برقم الإيصال أو المستأجر، وطباعة السند المعتمد مع التفقيط المالي.</p>
                  </div>
                  <Button asChild><Link to="/receipts">فتح سجل الإيصالات بالكامل</Link></Button>
                </CardContent>
              </Card>
            ) : null}
            {activeTab === 'expenses' ? (
              <ExpensesSection
                expenses={expenses}
                propertyRows={propertyRows}
                costCenterRows={costCenterRows}
                filters={filters}
                onFiltersChange={setFilters}
                expenseForm={expenseForm}
                isCreateExpensePending={createExpense.isPending}
                isCreateExpenseSuccess={createExpense.isSuccess}
                onCreateExpense={onCreateExpense}
              />
            ) : null}
            {activeTab === 'arrears' ? <ArrearsWorkspaceSection /> : null}
            {activeTab === 'reconciliation' ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-bold">مطابقة كشف البنك</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">مساحة مستقلة لاستيراد كشف البنك ومطابقة الحركات مع التحصيلات والمصروفات.</p>
                  </div>
                  <Button asChild><Link to="/bank-reconciliation">فتح المطابقة البنكية</Link></Button>
                </CardContent>
              </Card>
            ) : null}
            {activeTab === 'deposits' ? <DepositsWorkspace /> : null}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
