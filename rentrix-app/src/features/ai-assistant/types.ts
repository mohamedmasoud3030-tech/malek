export type AiAssistantAction =
  | 'summarize_overdue_invoices'
  | 'summarize_contract_renewals'
  | 'draft_tenant_payment_reminder'
  | 'explain_property_financial_snapshot';

export type AiAssistantMessageRole = 'user' | 'assistant';

export type AiAssistantMessage = {
  id: string;
  role: AiAssistantMessageRole;
  content: string;
  createdAt: string;
  action?: AiAssistantAction;
};

export type AiAssistantHistoryMessage = Pick<AiAssistantMessage, 'role' | 'content'>;

export type AiAssistantOverdueInvoice = {
  invoiceId: string;
  contractId: string;
  dueDate: string;
  remainingAmount: number;
  status: string;
};

export type AiAssistantContractRenewal = {
  contractId: string;
  propertyId: string;
  tenantId: string;
  unitId: string | null;
  endDate: string;
  rentAmount: number;
};

export type AiAssistantContext = {
  asOf: string;
  sampleLimit: number;
  overdueInvoices: {
    invoiceCount: number;
    totalOutstanding: number;
    oldestDueDate: string | null;
    topInvoices: AiAssistantOverdueInvoice[];
  };
  contractRenewals: {
    lookaheadDays: number;
    contractCount: number;
    totalRentAmount: number;
    upcomingContracts: AiAssistantContractRenewal[];
  };
  propertyFinancialSnapshot: {
    propertyCount: number;
    activePropertyCount: number;
    unitCount: number;
    occupiedUnitCount: number;
    occupancyRate: number;
    outstandingInvoiceAmount: number;
    expensesLast90Days: number;
  };
  reportSummary: {
    invoicesLast30Days: number;
    invoiceAmountLast30Days: number;
    paymentsLast30Days: number;
    paymentAmountLast30Days: number;
    expensesLast30Days: number;
    expenseAmountLast30Days: number;
  };
};

export type AiAssistantRequest = {
  prompt: string;
  action?: AiAssistantAction;
  history: AiAssistantHistoryMessage[];
};

export type AiAssistantResponse = {
  reply: string;
  context: AiAssistantContext;
};
