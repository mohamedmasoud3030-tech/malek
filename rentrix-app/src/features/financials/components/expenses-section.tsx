import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Download } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { escapeCsvValue, withUtf8Bom } from '@/lib/csvExport';
import { exportExpenseToPdf } from '@/services/pdfService';
import type { Expense, Property } from '@/types/domain';
import { formatDate, formatMoney } from './financials-formatters';
import {
  buildExpensePropertyLabel,
  OPERATIONAL_EXPENSE_CATEGORIES,
  summarizeOperationalExpenses,
  type OperationalExpenseCategory,
  type OperationalExpenseFilterValues,
} from '../expenses/operational-expenses';
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
  onCreateExpense: (values: ExpenseFormValues) => void;
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

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([withUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExpensesSection({ expenses, propertyRows, costCenterRows, filters, onFiltersChange, expenseForm, isCreateExpensePending, onCreateExpense }: ExpensesSectionProps) {
  const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
  const costCenterById = new Map(costCenterRows.map((costCenter) => [costCenter.id, costCenter]));
  const summary = summarizeOperationalExpenses(expenses);
  const hasFilters = Boolean(filters.propertyId || filters.category || filters.costCenterId || filters.from || filters.to);
  const companySettings = useCompanySettingsContract();
  const clearFilters = () => onFiltersChange({ propertyId: '', category: '', costCenterId: '', from: '', to: '' });
  const exportVisibleExpenses = () => downloadCsv(`rentrix-expenses-${getTodayLocalDateString()}.csv`, buildExpensesCsv(expenses, propertyRows));
  const exportExpenseVoucher = (expense: Expense) => {
    const property = propertyById.get(expense.property_id);
    exportExpenseToPdf(expense, {
      settings: {
        general: { company: { name: companySettings.companyName } },
        operational: { currency: companySettings.defaultCurrency },
      },
      contracts: [],
      tenants: [],
      units: [],
      properties: property ? [property] : [],
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>المصاريف التشغيلية</CardTitle>
          <CardDescription>فلترة المصاريف وتصدير النتائج الظاهرة أو تسجيل مصروف جديد مرتبط بعقار.</CardDescription>
        </div>
        <Button variant="secondary" onClick={exportVisibleExpenses} disabled={expenses.length === 0}>تصدير CSV</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">تكلفة طلبات الصيانة في قسم الصيانة تبقى تقديرية ولا يتم تحويلها تلقائياً إلى مصروف.</p>

        <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>عدد المصاريف: <strong>{summary.visibleCount}</strong></p>
          <p>الإجمالي: <strong>{formatMoney(summary.visibleAmount)}</strong></p>
          <p>العقارات: <strong>{summary.byPropertyCount}</strong></p>
          <p>التصنيفات: <strong>{summary.byCategoryCount}</strong></p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-sm font-bold">
            <span>العقار</span>
            <Select
              value={filters.propertyId}
              onChange={(e) => onFiltersChange({ ...filters, propertyId: e.target.value })}
            >
              <option value="">كل العقارات</option>
              {propertyRows.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>التصنيف</span>
            <Select
              value={filters.category}
              onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
            >
              <option value="">كل التصنيفات</option>
              {OPERATIONAL_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>مركز التكلفة</span>
            <Select
              value={filters.costCenterId}
              onChange={(e) => onFiltersChange({ ...filters, costCenterId: e.target.value })}
            >
              <option value="">كل مراكز التكلفة</option>
              {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold"><span>من تاريخ</span><Input type="date" value={filters.from} onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })} /></label>
          <label className="space-y-1 text-sm font-bold"><span>إلى تاريخ</span><Input type="date" value={filters.to} onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })} /></label>
          {hasFilters ? <Button variant="secondary" className="sm:col-span-2 lg:col-span-5" onClick={clearFilters}>مسح الفلاتر</Button> : null}
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'لا توجد مصاريف مطابقة' : 'لا توجد مصاريف بعد'}
            description={hasFilters ? 'غيّر الفلاتر أو امسحها لعرض نتائج أخرى.' : 'سجّل أول مصروف تشغيلي من النموذج أدناه.'}
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {expenses.map((expense) => {
              const label = buildExpensePropertyLabel(expense, propertyById);
              const costCenterLabel = expense.cost_center_id
                ? costCenterById.get(expense.cost_center_id)?.name ?? 'مركز تكلفة غير معروف'
                : null;
              return (
                <div key={expense.id} className="px-4 py-3 text-sm">
                  {/* Mobile: stacked card */}
                  <div className="space-y-2 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold leading-tight">{label}</span>
                      <span className="font-bold tabular-nums shrink-0">{formatMoney(expense.amount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(expense.expense_date)}</span>
                      <span>·</span>
                      <span>{expense.category}</span>
                      {costCenterLabel ? (<><span>·</span><span>{costCenterLabel}</span></>) : null}
                    </div>
                    <Button type="button" variant="secondary" className="h-9 w-full px-3 text-xs" onClick={() => exportExpenseVoucher(expense)}>
                      <Download className="me-2 size-4" />PDF
                    </Button>
                  </div>

                  {/* Desktop: compact row */}
                  <div className="hidden sm:grid sm:grid-cols-[7rem_1fr_auto_auto] sm:items-center sm:gap-3">
                    <span className="text-muted-foreground">{formatDate(expense.expense_date)}</span>
                    <span className="min-w-0 truncate">
                      {label} — {expense.category}
                      {costCenterLabel ? ` — ${costCenterLabel}` : ''}
                    </span>
                    <span className="font-bold tabular-nums">{formatMoney(expense.amount)}</span>
                    <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => exportExpenseVoucher(expense)}>
                      <Download className="me-2 size-4" />PDF
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2" onSubmit={expenseForm.handleSubmit(onCreateExpense)}>
          <label className="space-y-1 text-sm font-bold">
            <span>العقار</span>
            <Select {...expenseForm.register('property_id')}>
              <option value="">اختر العقار</option>
              {propertyRows.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>التصنيف</span>
            <Select {...expenseForm.register('category')}>
              {OPERATIONAL_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>مركز التكلفة</span>
            <Select {...expenseForm.register('cost_center_id')}>
              <option value="">بدون مركز تكلفة</option>
              {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>المبلغ</span>
            <Input type="number" min="0.01" step="0.01" placeholder="المبلغ" {...expenseForm.register('amount')} />
          </label>
          <label className="space-y-1 text-sm font-bold">
            <span>التاريخ</span>
            <Input type="date" {...expenseForm.register('expense_date')} />
          </label>
          <div className="sm:col-span-2">
            <Textarea placeholder="الوصف (اختياري)" className="min-h-16" {...expenseForm.register('description')} />
          </div>
          <div className="sm:col-span-2">
            <Controller
              control={expenseForm.control}
              name="attachment_url"
              render={({ field }) => (
                <FileAttachmentField label="إيصال مرفق (اختياري)" value={field.value ?? null} onChange={field.onChange} />
              )}
            />
          </div>
          <Button type="submit" disabled={isCreateExpensePending} className="sm:col-span-2">
            {isCreateExpensePending ? 'جارٍ الحفظ...' : 'إضافة مصروف'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
