export type AiAssistantAction =
  | 'summarize_overdue_invoices'
  | 'summarize_contract_renewals'
  | 'summarize_vacancy'
  | 'summarize_month'
  | 'summarize_expenses'
  | 'draft_tenant_payment_reminder'
  | 'explain_property_financial_snapshot'
  | 'explain_current_surface'
  | 'identify_riskiest_overdue_tenants'
  | 'list_contracts_needing_action_this_week'
  | 'locate_dormant_funds'
  | 'list_vacant_units_needing_followup'
  | 'identify_lowest_performing_properties'
  | 'list_overdue_or_critical_maintenance'
  | 'prioritize_office_actions_top5'
  | 'generate_daily_brief'
  | 'draft_contract_renewal_followup'
  | 'draft_maintenance_followup'
  | 'draft_owner_summary'
  | 'draft_internal_note';

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
  tenantName: string | null;
  propertyName: string | null;
  daysOverdue: number;
};

export type AiAssistantContractRenewal = {
  contractId: string;
  propertyId: string;
  tenantId: string;
  unitId: string | null;
  endDate: string;
  rentAmount: number;
};

/**
 * Where the user is right now — a lightweight descriptor derived from the
 * current route. It never carries page objects, and it is the only entity
 * reference the assistant receives from the surface.
 */
export type AiAssistantSurfaceEntityType =
  | 'property'
  | 'unit'
  | 'contract'
  | 'tenant'
  | 'owner'
  | 'person'
  | null;

export type AiAssistantSurfaceContext = {
  route: string;
  entityType: AiAssistantSurfaceEntityType;
  entityId: string | null;
  entityLabel: string | null;
  section: string | null;
};

/**
 * Scoped snapshot of the entity the user is looking at. Structured fields
 * only — the same strict contract the Edge Function enforces.
 */
export type AiAssistantEntityContext = {
  type: NonNullable<AiAssistantSurfaceEntityType>;
  id: string;
  name: string | null;
  status?: string | null;
  propertyName?: string | null;
  unitName?: string | null;
  tenantName?: string | null;
  rentAmount?: number;
  monthlyRentAmount?: number;
  startDate?: string | null;
  endDate?: string | null;
  unitCount?: number;
  occupiedUnitCount?: number;
  activeContractCount?: number;
  propertyCount?: number;
  outstandingAmount: number;
  oldestOverdueDate?: string | null;
  nextDueDate?: string | null;
  openMaintenanceCount?: number;
  urgentMaintenanceCount?: number;
  stalledMaintenanceCount?: number;
  ownerCurrentPeriodNetPayable?: number;
  ownerRemainingPayable?: number;
  ownerHeldFunds?: number;
  ownerApprovedSettlements?: number;
};

export type AiAssistantMaintenanceRequest = {
  requestId: string;
  propertyName: string | null;
  issue: string | null;
  priority: string | null;
  status: string | null;
  openedDate: string | null;
  ageDays: number | null;
};

export type AiAssistantContext = {
  asOf: string;
  sampleLimit: number;
  overdueInvoices: {
    invoiceCount: number;
    totalOutstanding: number;
    oldestDueDate: string | null;
    topInvoices: AiAssistantOverdueInvoice[];
    dueTodayCount: number;
    dueTodayAmount: number;
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
    vacantUnitCount: number;
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
  surface?: AiAssistantSurfaceContext;
  entity?: AiAssistantEntityContext;
  maintenanceSnapshot?: {
    openCount: number;
    inProgressCount: number;
    urgentOpenCount: number;
    stalledCount: number;
    awaitingClosureCount: number;
    oldestOpenAgeDays: number;
    topRequests: AiAssistantMaintenanceRequest[];
  };
  vacancyDetail?: {
    topVacantUnits: Array<{
      unitId: string;
      propertyName: string | null;
      unitName: string | null;
    }>;
  };
  propertyPerformance?: {
    topOutstanding: Array<{
      propertyId: string;
      propertyName: string | null;
      outstandingAmount: number;
      openInvoiceCount: number;
    }>;
  };
  depositHeld?: {
    totalHeld: number;
    heldCount: number;
  };
};

export type AiAssistantRequest = {
  prompt: string;
  action?: AiAssistantAction;
  history: AiAssistantHistoryMessage[];
  surface?: AiAssistantSurfaceContext;
};

export type AiAssistantResponse = {
  reply: string;
  context: AiAssistantContext;
  grounded: boolean;
  caveats: string[];
  source: 'deterministic' | 'model' | 'fallback';
  /**
   * `advisory` marks a general business-knowledge answer (market rates,
   * rent estimation, management practice) that is NOT based on the
   * company's own data. Absent or `data` = the normal grounded path.
   */
  kind?: 'data' | 'advisory';
};
