import type { Expense, Property } from '@/types/domain';
import { downloadTextFile, printCurrentView } from '@/services/action-service';
import { exportExpenseToPdf } from '@/services/pdfService';
import { withUtf8Bom } from '@/lib/csvExport';

export function downloadExpenseCsv(filename: string, csv: string) {
  downloadTextFile(filename, withUtf8Bom(csv), 'text/csv;charset=utf-8');
}

export function printExpenses() {
  printCurrentView();
}

export function exportExpenseVoucher(expense: Expense, property: Property | undefined, companyName: string, currency: string) {
  exportExpenseToPdf(expense, {
    settings: {
      general: { company: { name: companyName } },
      operational: { currency },
    },
    contracts: [],
    tenants: [],
    units: [],
    properties: property ? [property] : [],
  });
}
