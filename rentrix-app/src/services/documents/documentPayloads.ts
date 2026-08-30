/**
 * Canonical document payload contract.
 *
 * `DocumentEngine.buildDocument(type, { settings, payload })` is the single
 * source of truth for building a `UnifiedDocumentModel`. Each document type
 * has one typed payload here; legacy request shapes are normalized into
 * these payloads by `legacyPayloadAdapters.ts`, and the compatibility
 * wrappers in `DocumentTemplates.tsx` map their historical data interfaces
 * onto them as well. No financial values are invented anywhere: every field
 * mirrors data the caller already holds.
 */
import type { DocumentCompanySettings } from './companyIdentity';

export type DocumentTypeId =
  | 'contract'
  | 'invoice'
  | 'receipt'
  | 'expense_voucher'
  | 'payment'
  | 'owner_statement'
  | 'tenant_statement'
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet'
  | 'generic_report'
  // --- dedicated types added for the 24 MALEK business documents ---
  | 'unit_inspection'
  | 'lease_notice'
  | 'deposit_voucher'
  | 'debt_rescheduling'
  | 'tenant_clearance'
  | 'owner_settlement'
  | 'management_exit'
  | 'unit_passport'
  | 'maintenance_work_order'
  | 'maintenance_completion'
  | 'legal_dossier'
  // --- professional report documents ---
  | 'owner_report'
  | 'property_report';

export type ContractDocumentPayload = {
  /** Real business reference when one exists. Never a UUID fragment. */
  reference?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  rentAmount: number;
  paymentCycle?: string | null;
  notes?: string | null;
  tenantName?: string | null;
  tenantNationalId?: string | null;
  tenantPhone?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
};

export type InvoiceDocumentPayload = {
  reference?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  description?: string | null;
  amount: number;
  /**
   * Authoritative paid amount from the data source; shown only when the
   * source actually tracks partial payments. Never derived.
   */
  paidAmount?: number | null;
  /** Authoritative VAT amount from the data source (shown verbatim). */
  vatAmount?: number | null;
  /**
   * Authoritative billed total supplied by the caller/domain contract.
   * The engine NEVER computes it: when absent and no VAT line exists, the
   * stored `amount` itself is the billed total (legacy invoices-table
   * contract); when a VAT amount exists without an explicit total, the
   * grand-total row is omitted rather than invented.
   */
  totalAmount?: number | null;
  /**
   * Authoritative remaining balance from the domain/query layer; rendered
   * only when explicitly supplied. The engine never derives balances.
   */
  remainingAmount?: number | null;
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
};

export type ReceiptDocumentPayload = {
  /** The real receipt number (e.g. REC-…). Absent when the source has none. */
  reference?: string | null;
  paymentDate?: string | null;
  amount: number;
  paymentMethod?: string | null;
  payerName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  invoiceReference?: string | null;
  collectorName?: string | null;
  /** Physical payment reference (cheque / transfer number), not the receipt no. */
  paymentReference?: string | null;
  notes?: string | null;
};

export type ExpenseVoucherPayload = {
  reference?: string | null;
  date?: string | null;
  category?: string | null;
  amount: number;
  description?: string | null;
  propertyTitle?: string | null;
  /**
   * `payment` stays a documented legacy alias: no live caller owns it, so it
   * renders as a neutral money-movement voucher rather than pretending to be
   * a dedicated payment design.
   */
  kind: 'expense' | 'payment';
};

export type StatementTransaction = {
  date: string;
  type: string;
  description: string;
  amount: number;
};

export type OwnerStatementPayload = {
  ownerName: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: StatementTransaction[];
};

export type TenantStatementLine = {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TenantStatementPayload = {
  tenantName: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  lines: TenantStatementLine[];
};

export type TrialBalanceLine = {
  no: string;
  name: string;
  debit: number;
  credit: number;
};

export type TrialBalanceReportPayload = {
  asOf?: string | null;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
};

export type MoneyRow = { label: string; amount: number };

export type IncomeStatementReportPayload = {
  periodFrom?: string | null;
  periodTo?: string | null;
  /** Pre-formatted period label for legacy callers that already built one. */
  dateRangeLabel?: string | null;
  revenues: MoneyRow[];
  expenses: MoneyRow[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
};

export type BalanceSheetReportPayload = {
  asOf?: string | null;
  assets: MoneyRow[];
  liabilities: MoneyRow[];
  equity: MoneyRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

export type GenericReportSection = {
  title?: string;
  columns?: string[];
  rows: string[][];
  totals?: string[];
};

/**
 * Generic report is supported because real callers use it today (collections,
 * overdue, occupancy, expenses, maintenance, deferred revenue, property
 * analytics reports, deposits clearance, maintenance A4 list, utilities
 * report). It is not a speculative extension point.
 */
export type GenericReportPayload = {
  reportTitle: string;
  reportType?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  sections: GenericReportSection[];
  totalSummary?: string | null;
};

// ═══════════════════════════════════════════════════════════════════
// Professional report documents (owner_report / property_report)
//
// These payloads describe a *composition*, not a single table: page groups,
// KPI strips, deterministic print charts and insight notes. The adapters
// compose them from canonical read models; the engine formats money and
// percentages (company currency precision) and never recalculates financial
// values. Cells may only be `amount`/`percent`/`text` so formatting stays in
// one authoritative place.
// ═══════════════════════════════════════════════════════════════════

export type ReportCellFormat =
  | { kind: 'amount'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'text'; value: string };

export type ReportKpiValue = {
  label: string;
  value: ReportCellFormat;
  /** Signed change vs the comparable previous period; absent when not comparable. */
  comparison?: ReportCellFormat | null;
};

export type ReportChartSeries = { name: string; values: number[] };

export type ReportChartData = {
  chartType: 'bars' | 'hbar' | 'stacked-bars';
  title: string;
  caption?: string | null;
  categories: string[];
  series: ReportChartSeries[];
  note?: string | null;
};

export type ReportTableData = {
  title?: string | null;
  columns: string[];
  rows: ReportCellFormat[][];
  totals?: ReportCellFormat[];
  emptyNote?: string | null;
};

export type ProfessionalReportBlock =
  | { kind: 'kpis'; kpis: ReportKpiValue[] }
  | { kind: 'table'; table: ReportTableData }
  | { kind: 'chart'; chart: ReportChartData }
  | { kind: 'note'; note: { text: string; tone: 'info' | 'risk' | 'success' | 'neutral' } };

/**
 * A group of report blocks. `keepTogether` makes the WHOLE group one atomic
 * page block — use only when the combined content provably fits one A4 page
 * (the engine cannot split an oversized keep-together group).
 */
export type ProfessionalReportGroup = {
  keepTogether?: boolean;
  blocks: ProfessionalReportBlock[];
};

export type ProfessionalReportPayload = {
  reportTitle: string;
  reportType?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  /** Machine-generated-on date (today), kept distinct from the period. */
  generatedAt?: string | null;
  /** Property scope label (specific property or "all managed properties"). */
  scopeLabel?: string | null;
  /** Identity facts rendered under the header (never invented IDs/phones). */
  identity: Array<{ label: string; value: string }>;
  groups: ProfessionalReportGroup[];
};

/** كشف المالك التفصيلي — Owner Financial Report Pack. */
export type OwnerReportPayload = ProfessionalReportPayload & {
  /** Real owner display name from the owners read model. */
  ownerName: string;
  propertyTitle?: string | null;
};

/** تقرير أداء العقار — Property Performance Report. */
export type PropertyReportPayload = ProfessionalReportPayload & {
  propertyTitle?: string | null;
};

// ═══════════════════════════════════════════════════════════════════
// 11 dedicated payload types for MALEK business documents
// Each payload is a strict pass-through of caller-supplied data.
// NO financial calculations are performed in any of these types.
// ═══════════════════════════════════════════════════════════════════

/** D2 — #2 Move-In / Move-Out Snagging (unit_inspection) */
export type InspectionConditionRow = {
  areaOrItem: string;
  condition: string;
  note?: string | null;
};

export type UnitInspectionPayload = {
  /** Real work-order / inspection reference when one exists. Never a UUID fragment. */
  reference?: string | null;
  inspectionDate: string;
  /** move_in | move_out | inspection */
  inspectionMode: 'move_in' | 'move_out' | 'inspection';
  propertyTitle?: string | null;
  unitNumber?: string | null;
  tenantName?: string | null;
  conditionRows: InspectionConditionRow[];
  /** Meter readings supplied by the canonical data source when available. */
  meterReadings?: Array<{ meter: string; reading: string; unit?: string | null }> | null;
  /** Key/asset handover list supplied by canonical data source. */
  keyHandover?: Array<{ item: string; quantity: number; note?: string | null }> | null;
  /** Evidence/attachment references only — no binary data. */
  evidenceRefs?: string[] | null;
  notes?: string | null;
  /** Inspector name when supplied by canonical source — never invented. */
  inspectorName?: string | null;
};

/** D3 — #3 Lease Renewal / Vacate Notice (lease_notice) */
export type LeaseNoticePayload = {
  /** Real contract reference when one exists. */
  reference?: string | null;
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  currentEndDate?: string | null;
  noticeDate: string;
  /** renewal | vacate | non_renewal */
  noticeKind: 'renewal' | 'vacate' | 'non_renewal';
  effectiveDate?: string | null;
  /** Approved message / terms supplied by caller — never auto-generated. */
  approvedMessage?: string | null;
  notes?: string | null;
};

/** D6 — #6 Security Deposit Voucher (deposit_voucher) */
export type DepositVoucherPayload = {
  /** Transaction reference from the canonical deposit authority. */
  reference?: string | null;
  transactionDate: string;
  /** received | returned | deducted — only kinds the canonical domain supports. */
  transactionKind: 'received' | 'returned' | 'deducted';
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  /** Amount as supplied by the deposit authority. Never recalculated. */
  amount: number;
  /**
   * Canonical deposit balance/result only when supplied by the deposit
   * authority. The engine never derives it.
   */
  depositBalance?: number | null;
  reason?: string | null;
  notes?: string | null;
};

/** D8 — #8 Debt Rescheduling Agreement (debt_rescheduling) — DATA_AUTHORITY_MISSING; payload defined for type safety */
export type ReschedulingInstallmentRow = {
  dueDate: string;
  amount: number;
  description?: string | null;
};

export type DebtReschedulingPayload = {
  /** Agreement reference from canonical domain. */
  reference?: string | null;
  agreementDate: string;
  tenantName?: string | null;
  contractReference?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  /** Authoritative total debt amount AT the time of agreement. Never re-derived. */
  debtAmount: number;
  /** Approved installment schedule from the domain — never generated here. */
  installments: ReschedulingInstallmentRow[];
  effectiveDate?: string | null;
  status?: string | null;
  terms?: string | null;
  notes?: string | null;
};

/** D10 — #10 Tenant Final Clearance (tenant_clearance) */
export type TenantClearancePayload = {
  /** Contract reference. */
  reference?: string | null;
  clearanceDate: string;
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  /**
   * Canonical financial-clearance state from the domain.
   * The document refuses to say "براءة ذمة" unless this field proves it.
   */
  clearanceStatus: 'cleared' | 'outstanding' | 'pending';
  /**
   * Outstanding amount only when supplied by canonical authority.
   * The engine never calculates it.
   */
  outstandingAmount?: number | null;
  /**
   * Deposit disposition only when supplied by canonical deposit authority.
   */
  depositDisposition?: string | null;
  depositAmount?: number | null;
  maintenanceNotes?: string | null;
  utilityNotes?: string | null;
  notes?: string | null;
};

/** D11 — #11 Owner Settlement Statement (owner_settlement) */
export type OwnerSettlementLineRow = {
  description: string;
  amount: number;
  type: 'credit' | 'debit';
};

export type OwnerSettlementPayload = {
  /** Settlement reference from the owner-settlement lifecycle authority. */
  reference?: string | null;
  status: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  ownerName: string;
  propertyTitle?: string | null;
  /**
   * All amounts come DIRECTLY from the owner-settlement read authority.
   * The adapter MUST NOT compute net-due, management fee, or revenue.
   * Managed owner rent is NOT office revenue.
   */
  collectedOwnerFunds: number;
  managementFee: number;
  ownerExpenses: number;
  /**
   * Net due / payout as supplied by the settlement authority.
   * Never recalculated in the adapter or engine.
   */
  netDue: number;
  payoutReference?: string | null;
  payoutDate?: string | null;
  supportingRows: OwnerSettlementLineRow[];
  notes?: string | null;
};

/** D13 — #13 Management Exit Clearance (management_exit) */
export type ManagementExitHandoverItem = {
  item: string;
  quantity?: number | null;
  note?: string | null;
};

export type ManagementExitPayload = {
  /** Property / owner agreement reference. */
  reference?: string | null;
  propertyTitle?: string | null;
  ownerName?: string | null;
  agreementEndDate?: string | null;
  status?: string | null;
  exitDate: string;
  keysHandover?: ManagementExitHandoverItem[] | null;
  documentsHandover?: ManagementExitHandoverItem[] | null;
  /**
   * Outstanding owner settlement state only when canonical data supplies it.
   * Never derived by the adapter.
   */
  outstandingSettlementNote?: string | null;
  notes?: string | null;
};

/** D15 — #15 Unit Lifecycle Passport (unit_passport) */
export type UnitPassportLeaseRow = {
  tenantName: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  rentAmount?: number | null;
};

export type UnitPassportMaintenanceRow = {
  date: string;
  title: string;
  status: string;
  cost?: number | null;
};

export type UnitPassportPayload = {
  propertyTitle?: string | null;
  unitNumber?: string | null;
  unitType?: string | null;
  /** Canonical operational status — never invented. */
  currentStatus: string;
  /** Lease history from canonical read model. */
  leaseHistory: UnitPassportLeaseRow[];
  /** Maintenance history from canonical maintenance records. */
  maintenanceHistory: UnitPassportMaintenanceRow[];
  /** Utility / meter summary when canonical authority supplies it. */
  utilitySummary?: string | null;
  /**
   * Financial summary from existing read models only.
   * This payload is a read-only dossier, not a balance authority.
   */
  financialSummaryNote?: string | null;
  notes?: string | null;
};

/** D19 — #19 Maintenance Work Order (maintenance_work_order) */
export type MaintenanceWorkOrderPayload = {
  /** Real work-order reference from canonical maintenance record. */
  reference?: string | null;
  status: string;
  issueDate: string;
  scheduledDate?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  /** Assigned provider / technician name when canonical data supplies it. */
  assignedProvider?: string | null;
  technicianName?: string | null;
  /** Responsibility party when canonical domain supplies it. */
  responsibleParty?: string | null;
  /**
   * Approved cost estimate / limit when canonical data supplies it.
   * The document adapter must NEVER invent or compute this.
   */
  approvedEstimate?: number | null;
  instructions?: string | null;
  notes?: string | null;
};

/** D20 — #20 Maintenance Completion Certificate (maintenance_completion) */
export type MaintenanceCompletionPayload = {
  /** Work order / maintenance reference. */
  reference?: string | null;
  completionDate: string;
  status: string;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  title: string;
  workPerformed?: string | null;
  providerName?: string | null;
  /**
   * Approved FINAL cost from canonical resolve_maintenance_with_expense record.
   * Never computed in the adapter.
   */
  approvedFinalCost?: number | null;
  /** Evidence reference IDs/URLs — no binary data. */
  evidenceRefs?: string[] | null;
  /** Tenant acceptance fact when actually recorded. */
  tenantAccepted?: boolean | null;
  /** Manager acceptance fact when actually recorded. */
  managerAccepted?: boolean | null;
  notes?: string | null;
};

/** D24 — #24 Eviction / Rental Dispute Legal Dossier (legal_dossier) */
export type LegalDossierTimelineEvent = {
  date: string;
  eventType: string;
  description: string;
  source?: string | null;
};

export type LegalDossierPayload = {
  /** Case / dispute internal reference when one exists. */
  reference?: string | null;
  contractReference?: string | null;
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  /**
   * Timeline events supplied by domain/audit sources.
   * The document does not generate or infer events.
   */
  timelineEvents: LegalDossierTimelineEvent[];
  /**
   * Unpaid invoices/arrears evidence supplied by canonical invoice/arrears service.
   * Amounts are presented verbatim — never recalculated.
   */
  unpaidInvoiceRefs?: Array<{ reference: string; amount: number; dueDate?: string | null }> | null;
  totalArrearsAmount?: number | null;
  /**
   * Notice / document references already in the domain.
   */
  noticeRefs?: string[] | null;
  /**
   * Current case / internal status when the domain exposes one.
   * The document must not make legal determinations or invent an eviction order.
   */
  caseStatus?: string | null;
  notes?: string | null;
};

export type CanonicalDocumentPayloadMap = {
  contract: ContractDocumentPayload;
  invoice: InvoiceDocumentPayload;
  receipt: ReceiptDocumentPayload;
  expense_voucher: ExpenseVoucherPayload;
  payment: ExpenseVoucherPayload;
  owner_statement: OwnerStatementPayload;
  tenant_statement: TenantStatementPayload;
  trial_balance: TrialBalanceReportPayload;
  income_statement: IncomeStatementReportPayload;
  balance_sheet: BalanceSheetReportPayload;
  generic_report: GenericReportPayload;
  // --- 11 dedicated types ---
  unit_inspection: UnitInspectionPayload;
  lease_notice: LeaseNoticePayload;
  deposit_voucher: DepositVoucherPayload;
  debt_rescheduling: DebtReschedulingPayload;
  tenant_clearance: TenantClearancePayload;
  owner_settlement: OwnerSettlementPayload;
  management_exit: ManagementExitPayload;
  unit_passport: UnitPassportPayload;
  maintenance_work_order: MaintenanceWorkOrderPayload;
  maintenance_completion: MaintenanceCompletionPayload;
  legal_dossier: LegalDossierPayload;
  // --- professional report documents ---
  owner_report: OwnerReportPayload;
  property_report: PropertyReportPayload;
};

export type DocumentBuildInput<T extends DocumentTypeId> = {
  settings: DocumentCompanySettings;
  payload: CanonicalDocumentPayloadMap[T];
};
