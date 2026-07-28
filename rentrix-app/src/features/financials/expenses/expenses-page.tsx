import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Banknote, CalendarDays, ReceiptText, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { useProperties } from '@/features/properties/use-properties';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { ExpensesSection, type ExpenseFormValues } from '../components/expenses-section';
import { getTodayLocalDateString } from '../financials-date-utils';
import { EXPENSE_CHARGED_TO_VALUES, OPERATIONAL_EXPENSE_CATEGORIES, summarizeOperationalExpenses, type OperationalExpenseFilterValues } from './operational-expenses';
import { useCreateExpenseAtomic, useExpenses, useUpdateExpense } from './useExpenses';

const expenseSchema = z.object({
  property_id: z.string().trim().min(1, 'اختر العقار'),
  category: z.enum(OPERATIONAL_EXPENSE_CATEGORIES, { message: 'اختر التصنيف' }),
  cost_center_id: z.string().optional(),
  charged_to: z.enum(EXPENSE_CHARGED_TO_VALUES, { message: 'اختر من يتحمل المصروف' }),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expense_date: z.string().min(1, 'اختر التاريخ'),
  description: z.string().optional(),
  attachment_url: z.string().nullable().optional(),
});

export function toLocalDateInputValue(date: Date = new Date()) {
  return getTodayLocalDateString(date);
}

export type ExpensesWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /expenses, so it owns the page shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the expenses workspace body. Shared verbatim between the standalone
 * /expenses route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function ExpensesWorkspace({ embedded = false }: ExpensesWorkspaceProps) {
  const [filters, setFilters] = useState<OperationalExpenseFilterValues>({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const propertiesQuery = useProperties({ page: 1, pageSize: 500, search: '', status: 'all' });
  const costCentersQuery = useCostCenters();
  const expensesQuery = useExpenses(filters);
  const expensesTruncated = expensesQuery.data?.truncated ?? false;
  const createExpense = useCreateExpenseAtomic();
  const updateExpense = useUpdateExpense();
  const propertyRows = propertiesQuery.data?.rows ?? [];
  const expenses = expensesQuery.data?.rows ?? [];
  const summary = summarizeOperationalExpenses(expenses);

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: '',
      category: 'صيانة',
      cost_center_id: '',
      charged_to: 'COMPANY',
      amount: 0,
      expense_date: toLocalDateInputValue(),
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
        amount: values.amount,
        expenseDate: values.expense_date,
        costCenterId: values.cost_center_id?.trim() || null,
        chargedTo: values.charged_to,
        description: values.description?.trim() ? values.description.trim() : null,
        attachmentUrl: values.attachment_url ?? null,
      },
      {
        onSuccess: () => expenseForm.reset({
          property_id: '',
          category: 'صيانة',
          cost_center_id: '',
          charged_to: 'COMPANY',
          amount: 0,
          expense_date: toLocalDateInputValue(),
          description: '',
          attachment_url: null,
        }),
      },
    );
  };


  const onUpdateExpense = (expenseId: string, values: ExpenseFormValues) => {
    updateExpense.mutate({
      id: expenseId,
      payload: {
        property_id: values.property_id,
        category: values.category,
        amount: values.amount,
        expense_date: values.expense_date,
        cost_center_id: values.cost_center_id?.trim() || null,
        charged_to: values.charged_to,
        description: values.description?.trim() ? values.description.trim() : null,
        attachment_url: values.attachment_url ?? null,
      },
    });
  };

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      size="default"
      title="المصاريف"
      description="تسجيل ومراجعة مصاريف العقارات من مصدر البيانات الحالي مع فلاتر للعقار والتصنيف والتاريخ."
      secondaryActions={(
        <>
          <Button variant="secondary" asChild><Link to="/financials"><ArrowLeft className="me-2 size-4" />المالية</Link></Button>
          <Button variant="secondary" asChild><Link to="/reports"><ReceiptText className="me-2 size-4" />التقارير</Link></Button>
        </>
      )}
    >

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="عدد المصاريف" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.visibleCount)} sub="ضمن الفلاتر الحالية" icon={ReceiptText} accent="primary" />
        <KpiCard label="إجمالي المبلغ" value={formatCompanyMoney(defaultCompanyLocalSettings, summary.visibleAmount)} sub="للمصاريف المعروضة" icon={Banknote} accent="rose" />
        <KpiCard label="العقارات المتأثرة" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.byPropertyCount)} sub="عقارات لديها مصاريف" icon={WalletCards} accent="amber" />
        <KpiCard label="التصنيفات" value={formatCompanyNumber(defaultCompanyLocalSettings, summary.byCategoryCount)} sub="تصنيفات مستخدمة" icon={CalendarDays} accent="sky" />
      </ResponsiveCardGrid>

      {expensesTruncated ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning" role="status">
          يُعرض حتى 20,000 سجل حاليًا — ضيّق الفلاتر (العقار أو الفترة) لعرض باقي السجلات.
        </p>
      ) : null}

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
        isCreateExpenseSuccess={createExpense.isSuccess}
        isLoading={expensesQuery.isLoading || propertiesQuery.isLoading}
        error={expensesQuery.error ?? propertiesQuery.error}
        onRetry={() => { void Promise.all([expensesQuery.refetch(), propertiesQuery.refetch()]); }}
        onCreateExpense={onCreateExpense}
        onUpdateExpense={onUpdateExpense}
        isUpdateExpensePending={updateExpense.isPending}
        isUpdateExpenseSuccess={updateExpense.isSuccess}
      />
    </EmbeddableWorkspace>
  );
}

export function ExpensesPage() {
  return <ExpensesWorkspace />;
}
