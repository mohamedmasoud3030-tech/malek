export interface ContractDocumentData {
  contractId: string;
  contractNumber: string;
  contractStatus?: 'draft' | 'active' | 'expired' | 'terminated';
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  tenantNationalId: string;
  propertyName: string;
  unitNumber: string;
  unitFloor?: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: string;
  vatRate?: number;
  notes?: string;
}

export interface InvoiceDocumentData {
  invoiceNumber: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  description: string;
  amount: number;
  vatAmount?: number;
  paidAmount?: number;
  totalAmount?: number;
  dueDate: string;
  issueDate: string;
}

export interface ReceiptDocumentData {
  receiptNumber: string;
  paymentDate: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  collectedBy?: string;
  notes?: string;
}

export interface OwnerStatementData {
  ownerName: string;
  ownerPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
}

export interface TenantStatementData {
  tenantName: string;
  tenantPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  unitNumber: string;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  lines: Array<{
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

export interface ReportDocumentData {
  reportTitle: string;
  reportType: string;
  periodFrom: string;
  periodTo: string;
  sections: Array<{
    title: string;
    columns?: string[];
    rows: Array<Array<string | number>> | Array<{ label: string; value: string | number }>;
    totals?: string[];
  }>;
  totalSummary?: string;
}

export interface TrialBalanceDocumentData {
  asOf: string;
  accounts: Array<{
    code: string;
    name: string;
    balanceType: 'debit' | 'credit';
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface IncomeStatementDocumentData {
  periodFrom: string;
  periodTo: string;
  revenue: Array<{ label: string; amount: number }>;
  expenses: Array<{ label: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetDocumentData {
  asOf: string;
  assets: Array<{ name: string; amount: number }>;
  liabilities: Array<{ name: string; amount: number }>;
  equity: Array<{ name: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CompanyInfo {
  name: string;
  legalName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  vatRegistrationNumber?: string;
}

export interface DocumentSettings {
  company: CompanyInfo;
  currency: string;
  currencySymbol?: string;
  locale?: string;
  invoicePrefix?: string;
  contractPrefix?: string;
  receiptPrefix?: string;
}
