import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Banknote, CalendarDays, ReceiptText, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { useProperties } from '@/features/properties/use-properties';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { ExpensesSection, type ExpenseFormValues } from '../components/expenses-section';
import { getTodayLocalDateString } from '../financials-date-utils';
import { OPERATIONAL_EXPENSE_CATEGORIES, summarizeOperationalExpenses, type OperationalExpenseFilterValues } from './operational-expenses';
import { useCreateExpense, useExpenses } from './useExpenses';
import { PageHeader } from '@/components/layout/page-header';

const expenseSchema = z.object({
  property_id: z.string().uuid('اختر العقار'),
  category: z.enum(OPERATIONAL_EXPENSE_CATEGORIES, { message: 'اختر التصنيف' }),
  cost_center_id: z.string().optional(),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expense_date: z.string().min(1, 'اختر التاريخ'),
  description: z.string().optional(),
  attachment_url: z.string().nullable().optional(),
});



export function toLocalDateInputValue(date: Date = new Date()) {
  return getTodayLocalDateString(date);
}

export function ExpensesPage() {
  const [filters, setFilters] = useState<OperationalExpenseFilterValues>({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const propertiesQuery = useProperties({ page: 1, pageSize: 500, search: '', status: 'all' });
  const costCentersQuery = useCostCenters();
  const expensesQuery = useExpenses(filters);
  const createExpense = useCreateExpense();
  const propertyRows = propertiesQuery.data?.rows ?? [];
  const expenses = expensesQuery.data ?? [];
  const summary = summarizeOperationalExpenses(expenses);

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { property_id: '', category: 'صيانة', cost_center_id: '', expense_date: toLocalDateInputValue(), description: '', attachment_url: null },
  });

  const onCreateExpense = (values: ExpenseFormValues) => {
    createExpense.mutate(
      {
        property_id: values.property_id,
        category: values.category,
        amount: values.amount,
        expense_date: values.expense_date,
        cost_center_id: values.cost_center_id?.trim() || null,
        description: values.description?.trim() ? values.description.trim() : null,
        attachment_url: values.attachment_url ?? null,
      },
      { onSuccess: () => expenseForm.reset({ property_id: '', category: 'صيانة', cost_center_id: '', expense_date: toLocalDateInputValue(), description: '', attachment_url: null }) },
    );
  };

  return (
    <PageLayout dir="rtl">
      <PageHeader
        title="المصاريف"
        description="تسجيل ومراجعة مصاريف العقارات من مصدر البيانات الحالي مع فلاتر للعقار والتصنيف والتاريخ."
        secondaryActions={(
          <>
            <Button variant="secondary" asChild><Link to="/financials"><ArrowLeft className="me-2 size-4" />المالية</Link></Button>
            <Button variant="secondary" asChild><Link to="/reports"><ReceiptText className="me-2 size-4" />التقارير</Link></Button>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد المصاريف" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.visibleCount)} sub="ضمن الفلاتر الحالية" icon={ReceiptText} accent="primary" />
        <KpiCard label="إجمالي المبلغ" value={formatCompanyMoney(defaultCompanyLocalSettings, summary.visibleAmount)} sub="للمصاريف المعروضة" icon={Banknote} accent="primary" />
        <KpiCard label="العقارات المتأثرة" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.byPropertyCount)} sub="عقارات لديها مصاريف" icon={WalletCards} accent="primary" />
        <KpiCard label="التصنيفات" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.byCategoryCount)} sub="تصنيفات مستخدمة" icon={CalendarDays} accent="primary" />
      </div>

      {propertiesQuery.isError ? <EmptyState title="تعذر تحميل العقارات" description="يمكنك إعادة المحاولة بعد لحظات قبل تسجيل مصروف جديد." role="alert" ariaLive="assertive" /> : null}
      {expensesQuery.isError ? <EmptyState title="تعذر تحميل المصاريف" description="أعد المحاولة أو غيّر عوامل التصفية الحالية." role="alert" ariaLive="assertive" /> : null}

      <ExpensesSection
        expenses={expenses}
        propertyRows={propertyRows}
        costCenterRows={costCentersQuery.data ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        expenseForm={expenseForm}
        isCreateExpensePending={createExpense.isPending || propertiesQuery.isLoading}
        isLoading={expensesQuery.isLoading || propertiesQuery.isLoading}
        error={expensesQuery.error ?? propertiesQuery.error}
        onRetry={() => { void Promise.all([expensesQuery.refetch(), propertiesQuery.refetch()]); }}
        onCreateExpense={onCreateExpense}
      />
    </PageLayout>
  );
}
