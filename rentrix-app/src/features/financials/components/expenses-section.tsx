import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Building2, Download, Edit, Eye, Plus, Printer, ReceiptText, Tags, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { ActionMenu } from '@/components/ui/action-menu';
import { EntityForm } from '@/components/ui/entity-form';
import { FilterBar } from '@/components/ui/filter-bar';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { escapeCsvValue } from '@/lib/csvExport';
import type { Expense, Property } from '@/types/domain';
import { formatDate, formatMoney } from './financials-formatters';
import {
  buildExpensePropertyLabel,
  OPERATIONAL_EXPENSE_CATEGORIES,
  summarizeOperationalExpenses,
  type OperationalExpenseCategory,
  type OperationalExpenseFilterValues,
} from '../expenses/operational-expenses';
import { downloadExpenseCsv, exportExpenseVoucher as exportExpenseVoucherPdf, printExpenses } from '../expenses/expense-actions';
import { getTodayLocalDateString } from '../financials-date-utils';

export type ExpenseFormValues = {
  property_id: string;
  category: OperationalExpenseCategory;
  cost_center_id?: string;
  amount: number;
  expense_date: string;
  description?: string;
  attachment_url?: string | null;
};

type ExpensesSectionProps = Readonly<{
  expenses: Expense[];
  propertyRows: Property[];
  costCenterRows: CostCenterRecord[];
  filters: OperationalExpenseFilterValues;
  onFiltersChange: (nextFilters: OperationalExpenseFilterValues) => void;
  expenseForm: UseFormReturn<ExpenseFormValues>;
  isCreateExpensePending: boolean;
  isCreateExpenseSuccess?: boolean;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onCreateExpense: (values: ExpenseFormValues) => void;
  onUpdateExpense?: (expenseId: string, values: ExpenseFormValues) => void;
  isUpdateExpensePending?: boolean;
  isUpdateExpenseSuccess?: boolean;
}>;

function escapeCsvCell(value: string | number | null | undefined) {
  return escapeCsvValue(value);
}

export function buildExpensesCsv(expenses: readonly Expense[], propertyRows: readonly Property[]) {
  const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
  const rows = expenses.map((expense) => [
    expense.expense_date,
    buildExpensePropertyLabel(expense, propertyById),
    expense.category,
    expense.amount,
    expense.cost_center_id ?? '',
    expense.description ?? '',
  ]);

  return [
    'التاريخ,العقار,التصنيف,المبلغ,مركز التكلفة,الوصف',
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

export function ExpensesSection({
  expenses,
  propertyRows,
  costCenterRows,
  filters,
  onFiltersChange,
  expenseForm,
  isCreateExpensePending,
  isCreateExpenseSuccess = false,
  isLoading = false,
  error,
  onRetry,
  onCreateExpense,
  onUpdateExpense,
  isUpdateExpensePending = false,
  isUpdateExpenseSuccess = false,
}: ExpensesSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);
  const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
  const costCenterById = new Map(costCenterRows.map((costCenter) => [costCenter.id, costCenter]));
  const summary = summarizeOperationalExpenses(expenses);
  const hasFilters = Boolean(filters.propertyId || filters.category || filters.costCenterId || filters.from || filters.to);
  const companySettings = useCompanySettingsContract();
  const clearFilters = () => onFiltersChange({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const exportVisibleExpenses = () => downloadExpenseCsv(`rentrix-expenses-${getTodayLocalDateString()}.csv`, buildExpensesCsv(expenses, propertyRows));
  const exportExpenseVoucher = (expense: Expense) => {
    const property = propertyById.get(expense.property_id);
    exportExpenseVoucherPdf(expense, property, companySettings.companyName, companySettings.defaultCurrency);
  };

  useEffect(() => {
    if (isCreateExpenseSuccess || isUpdateExpenseSuccess) {
      setFormOpen(false);
      setEditingExpense(null);
    }
  }, [isCreateExpenseSuccess, isUpdateExpenseSuccess]);

  const openCreateForm = () => {
    setEditingExpense(null);
    expenseForm.reset({ property_id: '', category: 'صيانة', cost_center_id: '', amount: 0, expense_date: getTodayLocalDateString(), description: '', attachment_url: null });
    setFormOpen(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    expenseForm.reset({
      property_id: expense.property_id,
      category: expense.category as OperationalExpenseCategory,
      cost_center_id: expense.cost_center_id ?? '',
      amount: Number(expense.amount ?? 0),
      expense_date: expense.expense_date,
      description: expense.description ?? '',
      attachment_url: expense.attachment_url ?? null,
    });
    setFormOpen(true);
  };

  const submitExpenseForm = (values: ExpenseFormValues) => {
    if (editingExpense && onUpdateExpense) {
      onUpdateExpense(editingExpense.id, values);
      return;
    }
    onCreateExpense(values);
  };

  const isSavingExpense = isCreateExpensePending || isUpdateExpensePending;

  const firstFormError = Object.values(expenseForm.formState.errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === 'string' && message.length > 0);

  return (
    <Card className="overflow-hidden rounded-[1.4rem] sm:rounded-3xl">
      <CardHeader className="gap-4 border-b border-border/60 bg-muted/20 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>المصاريف التشغيلية</CardTitle>
          <CardDescription className="mt-1 leading-6">فلترة المصاريف وتصدير النتائج أو تسجيل مصروف جديد دون ازدحام الصفحة.</CardDescription>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:shrink-0">
          <Button variant="secondary" onClick={exportVisibleExpenses} disabled={expenses.length === 0}>
            <Download className="me-2 size-4" aria-hidden="true" />
            تصدير CSV
          </Button>
          <Button onClick={openCreateForm} disabled={propertyRows.length === 0}>
            <Plus className="me-2 size-4" aria-hidden="true" />
            إضافة مصروف
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-3 sm:p-5">
        <p className="rounded-2xl border border-border/60 bg-muted/25 p-3 text-xs font-medium leading-5 text-muted-foreground">
          تكلفة طلبات الصيانة في قسم الصيانة تقديرية ولا تتحول تلقائياً إلى مصروف.
        </p>

        <ResponsiveCardGrid gap="sm">
          <KpiCard label="عدد المصاريف" value={summary.visibleCount} icon={ReceiptText} accent="primary" compact />
          <KpiCard label="الإجمالي" value={formatMoney(summary.visibleAmount)} icon={WalletCards} accent="amber" compact />
          <KpiCard label="العقارات" value={summary.byPropertyCount} icon={Building2} accent="sky" compact />
          <KpiCard label="التصنيفات" value={summary.byCategoryCount} icon={Tags} accent="violet" compact />
        </ResponsiveCardGrid>

        <FilterBar
          filters={(
            <>
              <label className="min-w-0 space-y-1 text-sm font-bold">
                <span className="sr-only">العقار</span>
                <Select aria-label="العقار" value={filters.propertyId} onChange={(event) => onFiltersChange({ ...filters, propertyId: event.target.value })}>
                  <option value="">كل العقارات</option>
                  {propertyRows.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </Select>
              </label>
              <label className="min-w-0 space-y-1 text-sm font-bold">
                <span className="sr-only">التصنيف</span>
                <Select aria-label="التصنيف" value={filters.category} onChange={(event) => onFiltersChange({ ...filters, category: event.target.value })}>
                  <option value="">كل التصنيفات</option>
                  {OPERATIONAL_EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </Select>
              </label>
              <label className="min-w-0 space-y-1 text-sm font-bold">
                <span className="sr-only">مركز التكلفة</span>
                <Select aria-label="مركز التكلفة" value={filters.costCenterId} onChange={(event) => onFiltersChange({ ...filters, costCenterId: event.target.value })}>
                  <option value="">كل مراكز التكلفة</option>
                  {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
                </Select>
              </label>
              <label className="min-w-0 space-y-1 text-sm font-bold"><span className="sr-only">من تاريخ</span><Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })} /></label>
              <label className="min-w-0 space-y-1 text-sm font-bold"><span className="sr-only">إلى تاريخ</span><Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })} /></label>
            </>
          )}
          actions={hasFilters ? <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button> : undefined}
        />

        <DataTable
          aria-label="جدول المصاريف"
          rows={expenses}
          keyOf={(expense) => expense.id}
          emptyTitle={hasFilters ? 'لا توجد مصاريف مطابقة' : 'لا توجد مصاريف بعد'}
          emptyDescription={hasFilters ? 'غيّر الفلاتر أو امسحها لعرض نتائج أخرى.' : 'اضغط إضافة مصروف لتسجيل أول مصروف تشغيلي.'}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          columns={[
            { key: 'expense_date', header: 'التاريخ', render: (expense) => <span className="text-muted-foreground">{formatDate(expense.expense_date)}</span> },
            { key: 'label', header: 'العقار والتصنيف', render: (expense) => {
              const label = buildExpensePropertyLabel(expense, propertyById);
              const costCenterLabel = expense.cost_center_id ? costCenterById.get(expense.cost_center_id)?.name ?? 'مركز تكلفة غير معروف' : null;
              return <span className="min-w-0 truncate">{label} — {expense.category}{costCenterLabel ? ` — ${costCenterLabel}` : ''}</span>;
            } },
            { key: 'amount', header: 'المبلغ', render: (expense) => <span className="font-bold tabular-nums">{formatMoney(expense.amount)}</span> },
            { key: 'actions', header: 'إجراءات', render: (expense) => (
              <ActionMenu
                label="إجراءات المصروف"
                items={[
                  { id: 'details', label: 'التفاصيل', icon: Eye, onClick: () => setDetailsExpense(expense) },
                  { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => openEditForm(expense), disabled: !onUpdateExpense },
                  { id: 'pdf', label: 'تصدير PDF', icon: Download, onClick: () => exportExpenseVoucher(expense) },
                  { id: 'print', label: 'طباعة', icon: Printer, onClick: printExpenses },
                ]}
              />
            ) },
          ]}
          renderMobileCard={(expense) => {
            const label = buildExpensePropertyLabel(expense, propertyById);
            const costCenterLabel = expense.cost_center_id ? costCenterById.get(expense.cost_center_id)?.name ?? 'مركز تكلفة غير معروف' : null;
            return (
              <MobileCard
                title={label}
                subtitle={`${formatDate(expense.expense_date)} · ${expense.category}${costCenterLabel ? ` · ${costCenterLabel}` : ''}`}
                stats={<span className="text-base font-black tabular-nums" dir="ltr">{formatMoney(expense.amount)}</span>}
                actions={(
                  <Button type="button" variant="secondary" className="min-h-11 w-full px-3 text-xs" onClick={() => openEditForm(expense)}>
                    <Edit className="me-2 size-4" aria-hidden="true" />تعديل
                  </Button>
                )}
              />
            );
          }}
        />
      </CardContent>

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={(open) => { if (!isSavingExpense) setFormOpen(open); }}
        title={editingExpense ? 'تعديل مصروف' : 'إضافة مصروف'}
        description="سجّل المصروف وربطه بالعقار ومركز التكلفة. الحقول المطلوبة موضحة داخل النموذج."
      >
        <EntityForm.Root
          aria-busy={isSavingExpense}
          onSubmit={expenseForm.handleSubmit(submitExpenseForm)}
        >
          <EntityForm.ErrorSummary message={firstFormError} />

          <EntityForm.Section title="بيانات المصروف" description="اختر العقار والتصنيف ثم أدخل المبلغ والتاريخ.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-bold">
                <span>العقار</span>
                <Select {...expenseForm.register('property_id')} disabled={Boolean(editingExpense)} aria-invalid={Boolean(expenseForm.formState.errors.property_id)}>
                  <option value="">اختر العقار</option>
                  {propertyRows.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </Select>
                {expenseForm.formState.errors.property_id?.message ? <span className="text-xs text-destructive">{expenseForm.formState.errors.property_id.message}</span> : null}
              </label>

              <label className="space-y-1.5 text-sm font-bold">
                <span>التصنيف</span>
                <Select {...expenseForm.register('category')} aria-invalid={Boolean(expenseForm.formState.errors.category)}>
                  {OPERATIONAL_EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </Select>
              </label>

              <label className="space-y-1.5 text-sm font-bold">
                <span>مركز التكلفة</span>
                <Select {...expenseForm.register('cost_center_id')} disabled={Boolean(editingExpense)}>
                  <option value="">بدون مركز تكلفة</option>
                  {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
                </Select>
              </label>

              <label className="space-y-1.5 text-sm font-bold">
                <span>المبلغ</span>
                <Input type="number" min="0.01" inputMode="decimal" step="0.01" placeholder="0.000" {...expenseForm.register('amount')} aria-invalid={Boolean(expenseForm.formState.errors.amount)} />
                {expenseForm.formState.errors.amount?.message ? <span className="text-xs text-destructive">{expenseForm.formState.errors.amount.message}</span> : null}
              </label>

              <label className="space-y-1.5 text-sm font-bold sm:col-span-2">
                <span>التاريخ</span>
                <Input type="date" {...expenseForm.register('expense_date')} disabled={Boolean(editingExpense)} aria-invalid={Boolean(expenseForm.formState.errors.expense_date)} />
              </label>
            </div>
          </EntityForm.Section>

          <EntityForm.Section title="تفاصيل إضافية" description="أضف وصفاً أو إيصالاً عند الحاجة.">
            <Textarea placeholder="الوصف (اختياري)" className="min-h-24" {...expenseForm.register('description')} />
            <Controller
              control={expenseForm.control}
              name="attachment_url"
              render={({ field }) => (
                <FileAttachmentField label="إيصال مرفق (اختياري)" value={field.value ?? null} onChange={field.onChange} />
              )}
            />
          </EntityForm.Section>

          <EntityForm.Actions
            submitLabel={isSavingExpense ? 'جارٍ الحفظ...' : editingExpense ? 'حفظ التعديل' : 'حفظ المصروف'}
            onCancel={() => setFormOpen(false)}
            isSubmitting={isSavingExpense}
            submitDisabled={propertyRows.length === 0}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={detailsExpense != null}
        onOpenChange={(open) => { if (!open) setDetailsExpense(null); }}
        title="تفاصيل المصروف"
        description={detailsExpense ? `${formatDate(detailsExpense.expense_date)} · ${detailsExpense.category}` : undefined}
      >
        {detailsExpense ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-2xl border p-3"><strong>العقار:</strong> {buildExpensePropertyLabel(detailsExpense, propertyById)}</p>
            <p className="rounded-2xl border p-3"><strong>المبلغ:</strong> <span dir="ltr">{formatMoney(detailsExpense.amount)}</span></p>
            <p className="rounded-2xl border p-3"><strong>الوصف:</strong> {detailsExpense.description || '—'}</p>
            {detailsExpense.attachment_url ? <a className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold" href={detailsExpense.attachment_url}>فتح المرفق</a> : null}
          </div>
        ) : null}
      </EntityForm.Overlay>
    </Card>
  );
}
