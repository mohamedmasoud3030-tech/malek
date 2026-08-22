import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { APP_BRAND_FILE_SLUG } from '@/lib/brand';
import { Controller } from 'react-hook-form';
import { Building2, Download, Edit, Eye, Plus, Printer, ReceiptText, Tags, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable } from '@/components/ui/entity-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { EntityForm } from '@/components/ui/entity-form';
import { FilterBar } from '@/components/ui/filter-bar';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { escapeCsvValue } from '@/lib/csvExport';
import type { Expense, Property } from '@/types/domain';
import { formatDate, formatMoney } from './financials-formatters';
import { EXPENSE_CHARGED_TO_LABELS, EXPENSE_CHARGED_TO_VALUES, buildExpenseCategoryOptions, buildExpensePropertyLabel, getExpenseChargedTo, getExpenseChargedToLabel, normalizeExpenseChargedTo, summarizeOperationalExpenses, OPERATIONAL_EXPENSE_CATEGORIES, type ExpenseChargedTo, type OperationalExpenseCategory, type OperationalExpenseFilterValues } from '../expenses/operational-expenses';
import { downloadExpenseCsv, exportExpenseVoucher as exportExpenseVoucherPdf, printExpenseVoucher as printExpenseVoucherDocument } from '../expenses/expense-actions';
import { getTodayLocalDateString } from '../financials-date-utils';
import { MONEY_MIN_POSITIVE, MONEY_STEP } from '@/lib/money';

export type ExpenseFormValues = {
  property_id: string;
  category: OperationalExpenseCategory;
  cost_center_id?: string;
  charged_to: ExpenseChargedTo;
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
  const categoryOptions = buildExpenseCategoryOptions(expenses);
  const hasFilters = Boolean(filters.propertyId || filters.category || filters.costCenterId || filters.from || filters.to);
  const documentSettings = useDocumentSettings();
  const clearFilters = () => onFiltersChange({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const exportVisibleExpenses = () => downloadExpenseCsv(`${APP_BRAND_FILE_SLUG}-expenses-${getTodayLocalDateString()}.csv`, buildExpensesCsv(expenses, propertyRows));
  // Guards run inside the async boundary so a reachable handler fails closed
  // with a visible Arabic reason rather than silently doing nothing.
  const exportExpenseVoucher = (expense: Expense) => {
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => exportExpenseVoucherPdf(expense, propertyById.get(expense.property_id), documentSettings.companySettings),
      fallbackMessage: 'تعذر تنزيل سند المصروف كملف PDF.',
    });
  };
  const printExpenseVoucher = (expense: Expense) => {
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => printExpenseVoucherDocument(expense, propertyById.get(expense.property_id), documentSettings.companySettings),
      fallbackMessage: 'تعذرت طباعة سند المصروف.',
    });
  };

  useEffect(() => {
    if (isCreateExpenseSuccess || isUpdateExpenseSuccess) {
      setFormOpen(false);
      setEditingExpense(null);
    }
  }, [isCreateExpenseSuccess, isUpdateExpenseSuccess]);

  const openCreateForm = () => {
    setEditingExpense(null);
    expenseForm.reset({ property_id: '', category: 'صيانة', cost_center_id: '', charged_to: 'COMPANY', amount: 0, expense_date: getTodayLocalDateString(), description: '', attachment_url: null });
    setFormOpen(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    expenseForm.reset({
      property_id: expense.property_id,
      category: expense.category as OperationalExpenseCategory,
      cost_center_id: expense.cost_center_id ?? '',
      charged_to: normalizeExpenseChargedTo(getExpenseChargedTo(expense)),
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
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="gap-4 border-b border-border/60 bg-muted/20 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>المصروفات التشغيلية</CardTitle>
          <CardDescription className="mt-1 leading-6">فلترة المصروفات وتصدير النتائج أو تسجيل مصروف جديد دون ازدحام الصفحة.</CardDescription>
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
        <RegisterMetricStrip
          aria-label="ملخص المصروفات"
          items={[
            { id: 'count', label: 'المصروفات', value: summary.visibleCount, icon: ReceiptText, hideWhenEmpty: true },
            { id: 'total', label: 'الإجمالي', value: formatMoney(summary.visibleAmount), icon: WalletCards },
            { id: 'properties', label: 'العقارات', value: summary.byPropertyCount, icon: Building2, hideWhenEmpty: true },
            { id: 'categories', label: 'التصنيفات', value: summary.byCategoryCount, icon: Tags, hideWhenEmpty: true },
          ]}
        />

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
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
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

        <EntityTable
          aria-label="جدول المصروفات"
          rows={expenses}
          keyOf={(expense) => expense.id}
          emptyTitle={hasFilters ? 'لا توجد مصروفات مطابقة' : 'لا توجد مصروفات بعد'}
          emptyDescription={hasFilters ? 'غيّر الفلاتر أو امسحها لعرض نتائج أخرى.' : 'اضغط إضافة مصروف لتسجيل أول مصروف تشغيلي.'}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          columns={[
            {
              key: 'expense_date',
              header: 'التاريخ',
              priority: 'secondary',
              render: (expense) => <span className="text-muted-foreground">{formatDate(expense.expense_date)}</span>,
            },
            {
              key: 'label',
              header: 'العقار والتصنيف',
              priority: 'identity',
              render: (expense) => {
                const label = buildExpensePropertyLabel(expense, propertyById);
                const costCenterLabel = expense.cost_center_id
                  ? costCenterById.get(expense.cost_center_id)?.name ?? 'مركز تكلفة غير معروف'
                  : null;
                const chargedToLabel = getExpenseChargedToLabel(getExpenseChargedTo(expense));
                return (
                  <span className="min-w-0 truncate">
                    {label} — {expense.category}
                    {costCenterLabel ? ` — ${costCenterLabel}` : ''}
                    {chargedToLabel !== 'الشركة' ? ` — يتحمّلها ${chargedToLabel}` : ''}
                  </span>
                );
              },
            },
            {
              key: 'amount',
              header: 'المبلغ',
              priority: 'primary',
              render: (expense) => <span className="font-bold tabular-nums">{formatMoney(expense.amount)}</span>,
            },
            {
              key: 'actions',
              header: 'إجراءات',
              priority: 'actions',
              render: (expense) => (
                <ActionMenu
                  label="إجراءات المصروف"
                  items={[
                    { id: 'details', label: 'التفاصيل', icon: Eye, onClick: () => setDetailsExpense(expense) },
                    { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => openEditForm(expense), disabled: !onUpdateExpense },
                    { id: 'pdf', label: 'تصدير PDF', icon: Download, onClick: () => exportExpenseVoucher(expense), disabled: !documentSettings.isReady },
                    { id: 'print', label: 'طباعة', icon: Printer, onClick: () => printExpenseVoucher(expense), disabled: !documentSettings.isReady },
                  ]}
                />
              ),
            },
          ]}

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

              <label className="space-y-1.5 text-sm font-bold sm:col-span-2">
                <span>يتحمّل المصروف</span>
                <Select {...expenseForm.register('charged_to')} aria-invalid={Boolean(expenseForm.formState.errors.charged_to)}>
                  {EXPENSE_CHARGED_TO_VALUES.map((value) => <option key={value} value={value}>{EXPENSE_CHARGED_TO_LABELS[value]}</option>)}
                </Select>
                <span className="text-xs font-normal text-muted-foreground">اختيار «المالك» يُظهر المصروف في كشف حساب المالك.</span>
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
                <Input type="number" min={MONEY_MIN_POSITIVE} inputMode="decimal" step={MONEY_STEP} placeholder="0.000" {...expenseForm.register('amount')} aria-invalid={Boolean(expenseForm.formState.errors.amount)} />
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
            <p className="rounded-2xl border p-3"><strong>يتحمّل المصروف:</strong> {getExpenseChargedToLabel(getExpenseChargedTo(detailsExpense))}</p>
            <p className="rounded-2xl border p-3"><strong>الوصف:</strong> {detailsExpense.description || '—'}</p>
            {detailsExpense.attachment_url ? <a className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold" href={detailsExpense.attachment_url}>فتح المرفق</a> : null}
          </div>
        ) : null}
      </EntityForm.Overlay>
    </Card>
  );
}
