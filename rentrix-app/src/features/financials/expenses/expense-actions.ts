import type { Expense, Property } from '@/types/domain';
import { downloadTextFile } from '@/services/action-service';
import { documentService } from '@/services/documents/DocumentService';
import { withUtf8Bom } from '@/lib/csvExport';

export function downloadExpenseCsv(filename: string, csv: string) {
  downloadTextFile(filename, withUtf8Bom(csv), 'text/csv;charset=utf-8');
}

function expenseDocumentRequest(expense: Expense, property: Property | undefined, companyName: string, currency: string) {
  return {
    type: 'expense_voucher' as const,
    payload: {
      expense,
      db: {
        settings: { company: { companyName, defaultCurrency: currency } },
        contracts: [],
        tenants: [],
        units: [],
        properties: property ? [property] : [],
      },
    },
  };
}

export function printExpenseVoucher(expense: Expense, property: Property | undefined, companyName: string, currency: string) {
  return documentService.print(expenseDocumentRequest(expense, property, companyName, currency));
}

export function exportExpenseVoucher(expense: Expense, property: Property | undefined, companyName: string, currency: string) {
  return documentService.downloadPdf(expenseDocumentRequest(expense, property, companyName, currency));
}
