import type { Expense, Property } from '@/types/domain';
import { downloadTextFile } from '@/services/action-service';
import { documentService } from '@/services/documents/DocumentService';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { withUtf8Bom } from '@/lib/csvExport';

export function downloadExpenseCsv(filename: string, csv: string) {
  downloadTextFile(filename, withUtf8Bom(csv), 'text/csv;charset=utf-8');
}

function expenseDocumentPayload(expense: Expense, property: Property | undefined) {
  return {
    reference: null,
    date: expense.expense_date,
    category: expense.category,
    amount: Number(expense.amount ?? 0),
    description: expense.description,
    propertyTitle: property?.title ?? null,
    kind: 'expense' as const,
  };
}

export function printExpenseVoucher(expense: Expense, property: Property | undefined, settings: DocumentCompanySettings): Promise<void> {
  return documentService.printDocument('expense_voucher', {
    settings,
    payload: expenseDocumentPayload(expense, property),
  });
}

export function exportExpenseVoucher(expense: Expense, property: Property | undefined, settings: DocumentCompanySettings): Promise<void> {
  return documentService.downloadDocumentPdf('expense_voucher', {
    settings,
    payload: expenseDocumentPayload(expense, property),
  });
}
