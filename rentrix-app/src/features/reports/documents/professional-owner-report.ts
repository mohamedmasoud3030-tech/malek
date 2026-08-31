/**
 * Owner Report (كشف المالك التفصيلي) — professional Owner Financial Report
 * Pack built on canonical read authorities.
 *
 * The document answers, with evidence tables: what money came in, what was
 * deducted and why, what happened operationally, what was paid to the owner
 * and what remains — then closes with the canonical final account on the
 * LAST page.
 *
 * Financial truth rules enforced here:
 *  - No figure is recomputed: every number comes from
 *    `rpt_owner_statement` (OwnerStatementReport), `rpt_owner_financial_position`
 *    (OwnerFinancialPosition) or the owner settlements lifecycle.
 *  - "معتمد" (approved) is never shown as "مدفوع" (paid); settlement status
 *    wording comes from the document registry's truthful labels.
 *  - Maintenance cost is NOT automatically an owner deduction: the details
 *    table explains activity; the accounting authority (expense records on
 *    the owner statement) determines the posted deduction. Never double count.
 *  - Opening running balance / closing running balance are NOT available
 *    from an authoritative read source today → recorded as a DATA AUTHORITY
 *    GAP and never invented.
 *  - Empty operational sections are omitted (no fixed empty pages).
 */
import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';
import { getOwnerFinancialAuthority, type OwnerFinancialPosition } from '@/features/owners/services/owner-financial-service';
import { listOwnerSettlements, type OwnerSettlementRecord } from '@/features/owners/services/owner-settlements-service';
import { listOwnerProperties } from '@/features/owners/services/owner-service';
import { listMaintenance, type Maintenance } from '@/features/maintenance/maintenance-service';
import { listUtilityBills, type UtilityBill } from '@/features/utilities/utilities-service';
import { responsiblePartyLabels } from '@/features/utilities/utilities-service';
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getDocumentTemplateEntry, truthfulStatusLabel } from '@/services/documents/documentRegistry';
import type { OwnerReportPayload, ProfessionalReportGroup, ReportCellFormat } from '@/services/documents/documentPayloads';
import { getTodayLocalDateString } from '../reports-page.helpers';

/* ------------------------------------------------------------------ */
/* Truthful label maps (mirroring the operational UI labels)           */
/* ------------------------------------------------------------------ */

const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم التنفيذ',
  closed: 'مغلق',
  cancelled: 'ملغى',
};

const CHARGED_TO_LABELS: Record<string, string> = {
  owner: 'المالك',
  landlord: 'المالك',
  company: 'المكتب',
  tenant: 'المستأجر',
};

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  RATE: 'نسبة مئوية',
  PERCENTAGE: 'نسبة مئوية',
  FLAT: 'مبلغ ثابت',
  FIXED: 'مبلغ ثابت',
  percentage: 'نسبة مئوية',
  fixed: 'مبلغ ثابت',
};

const settlementStatusLabel = (status: string): string => {
  const entry = getDocumentTemplateEntry('owner_settlement');
  return entry ? (truthfulStatusLabel(entry, status.toLowerCase()) ?? status) : status;
};

/* ------------------------------------------------------------------ */
/* Context types                                                       */
/* ------------------------------------------------------------------ */

export type OwnerReportContext = {
  ownerName: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  /** Property scope label: a specific property when filtered, else "all managed". */
  scopeLabel?: string | null;
  generatedAt?: string | null;
  /** Canonical owner statement (rpt_owner_statement). */
  statement?: OwnerStatementReport | null;
  /** Canonical financial position (rpt_owner_financial_position). */
  position?: OwnerFinancialPosition | null;
  /** Settlements lifecycle records for this owner (already owner-filtered). */
  settlements?: readonly OwnerSettlementRecord[] | null;
  /** Maintenance rows scoped to the owner's properties (period-filtered). */
  maintenanceRows?: readonly Maintenance[] | null;
  /** Utility bills scoped to the owner's properties. */
  utilityBills?: readonly UtilityBill[] | null;
  /** propertyId → title for label enrichment. */
  propertyTitles?: ReadonlyMap<string, string> | null;
};

/* ------------------------------------------------------------------ */
/* Cell helpers                                                        */
/* ------------------------------------------------------------------ */

const text = (value: string | null | undefined): ReportCellFormat => ({ kind: 'text', value: value?.trim() || '—' });
const amount = (value: number | null | undefined): ReportCellFormat => ({ kind: 'amount', value: value ?? 0 });
const signCell = (value: number | null | undefined): ReportCellFormat => ({ kind: 'amount', value: value ?? 0 });

/* ------------------------------------------------------------------ */
/* Payload builder (pure & deterministic — the print action feeds it)  */
/* ------------------------------------------------------------------ */

const dateLabel = (value: string | null | undefined): string => {
  if (!value) return '—';
  return value.slice(0, 10);
};

export function buildOwnerReportPayload(context: OwnerReportContext): OwnerReportPayload {
  const { ownerName, periodFrom, periodTo, scopeLabel, generatedAt, statement, position, settlements, maintenanceRows, utilityBills, propertyTitles } = context;

  const groups: ProfessionalReportGroup[] = [];

  /* --- Group 1 — compact owner summary (canonical period economics) --- */
  const summaryKpis: Array<{ label: string; value: ReportCellFormat }> = [];
  let summaryAuthority: string;
  if (position) {
    summaryKpis.push(
      { label: 'التحصيلات العائدة للمالك', value: amount(position.period.tenant_collections) },
      { label: 'أتعاب إدارة الأملاك', value: amount(position.period.management_fees.amount) },
      { label: 'ضريبة الأتعاب (VAT)', value: amount(position.period.fee_vat) },
      { label: 'المصروفات المحملة على المالك', value: amount(position.period.owner_expenses) },
      { label: 'صافي المستحق للفترة', value: amount(position.period.net_payable) },
      { label: 'تسويات معتمدة/معلقة غير مدفوعة', value: amount(position.lifecycle_all_time.settled_pending_net) },
      { label: 'إجمالي المسدد للمالك', value: amount(position.lifecycle_all_time.paid_net) },
      { label: 'أموال مالك محتجزة لدى المكتب', value: amount(position.owner_funds.held) },
    );
    summaryAuthority = 'الملخص من الموقف المالي المعتمد للفترة (rpt_owner_financial_position) ودورة تسويات المالك.';
  } else if (statement) {
    summaryKpis.push(
      { label: 'إجمالي الإيجارات المحصلة', value: amount(statement.totalGross) },
      { label: 'إجمالي الاستقطاعات', value: amount(statement.totalDeductions) },
      { label: 'صافي المستحق', value: amount(statement.totalNet) },
    );
    summaryAuthority = 'الملخص من كشف المالك المعتمد (rpt_owner_statement) — لا يتوفر الموقف المالي المعتمد للفترة.';
  } else {
    summaryAuthority = 'لا توجد بيانات مالية معتمدة للفترة.';
  }

  const summaryGroup: ProfessionalReportGroup = {
    keepTogether: true,
    blocks: [
      { kind: 'kpis', kpis: summaryKpis },
      { kind: 'note', note: { text: summaryAuthority, tone: 'neutral' } },
    ],
  };
  groups.push(summaryGroup);

  /* --- Group 2 — detailed daily financial movement (all transactions) --- */
  const allTransactions = statement?.transactions ?? [];
  const movementRows: ReportCellFormat[][] = allTransactions.map((tx) => {
    const typeLabel = tx.type === 'payment' ? 'تحصيل إيجار'
      : tx.type === 'receipt' ? 'تحصيل'
      : tx.type === 'expense' ? 'مصروف مُحمَّل على المالك'
      : tx.type === 'settlement' ? 'تسوية / صرف'
      : 'حركة مالية';
    return [
      text(dateLabel(tx.date)),
      text(typeLabel),
      text(tx.propertyName),
      text(tx.details),
      amount(tx.gross),
      amount(tx.deduction),
      amount(tx.net),
    ];
  });
  const movementTotals = movementRows.length > 0
    ? [
        text('إجمالي حركات الفترة'),
        text(''),
        text(''),
        text(''),
        amount(allTransactions.reduce((sum, tx) => sum + tx.gross, 0)),
        amount(allTransactions.reduce((sum, tx) => sum + tx.deduction, 0)),
        amount(allTransactions.reduce((sum, tx) => sum + tx.net, 0)),
      ]
    : undefined;

  groups.push({
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'الحركة المالية اليومية التفصيلية',
          columns: ['التاريخ', 'نوع الحركة', 'العقار', 'البيان والمرجع', 'الإجمالي', 'الاستقطاع', 'صافي الحركة'],
          rows: movementRows,
          totals: movementTotals,
          emptyNote: 'لا توجد حركات مالية مسجلة للفترة ضمن كشف المالك المعتمد.',
        },
      },
      {
        kind: 'note',
        note: {
          text: 'جميع الأرقام من كشف المالك المعتمد (rpt_owner_statement). رصيد أول المدة ورصيد آخر المدة الدائر غير متاحين من سلطة قراءة معتمدة حاليًا. «مصروف مُحمَّل على المالك» يعني أن المصروف مسجل كاستقطاع في الكشف ولا يُحتسب مرتين مع الصيانة.',
          tone: 'info',
        },
      },
    ],
  });

  /* --- Group 3 — operational cost page (share ONE page when they fit) --- */
  const operationalBlocks: ProfessionalReportGroup['blocks'] = [];

  const maintenance = maintenanceRows ?? [];
  if (maintenance.length > 0) {
    operationalBlocks.push({
      kind: 'table',
      table: {
        title: 'تفاصيل الصيانة',
        columns: ['التاريخ', 'العقار / الوحدة', 'الطلبية / البيان', 'الحالة', 'المنفذ', 'جهة التحمل', 'تكلفة السجل', 'مرتبط بمصروف'],
        rows: maintenance.map((request) => [
          text(dateLabel(request.request_date ?? request.created_at)),
          text(request.property_id ? propertyTitles?.get(request.property_id) ?? '—' : '—'),
          text(request.title || request.no || request.reference || '—'),
          text(request.status ? MAINTENANCE_STATUS_LABELS[request.status] ?? request.status : '—'),
          text(request.technician_name),
          text(CHARGED_TO_LABELS[String(request.charged_to ?? '').toLowerCase()] ?? request.charged_to ?? '—'),
          request.cost != null ? amount(request.cost) : text('—'),
          text(request.expense_id ? 'نعم' : '—'),
        ]),
        emptyNote: 'لا توجد طلبات صيانة مسجلة للفترة.',
      },
    });
  }

  const expenseTransactions = (statement?.transactions ?? []).filter((tx) => tx.type === 'expense');
  if (expenseTransactions.length > 0) {
    operationalBlocks.push({
      kind: 'table',
      table: {
        title: 'تفاصيل المصروفات المسجلة',
        columns: ['التاريخ', 'العقار', 'البيان والمرجع', 'القيمة المسجلة'],
        rows: expenseTransactions.map((tx) => [text(dateLabel(tx.date)), text(tx.propertyName), text(tx.details), signCell(tx.gross)]),
        totals: [
          text('إجمالي المصروفات المسجلة'),
          text(''),
          text(''),
          amount(expenseTransactions.reduce((sum, tx) => sum + tx.gross, 0)),
        ],
        emptyNote: 'لا توجد مصروفات مسجلة للفترة ضمن كشف المالك المعتمد.',
      },
    });
  }

  const utilities = utilityBills ?? [];
  if (utilities.length > 0) {
    operationalBlocks.push({
      kind: 'table',
      table: {
        title: 'الخدمات والمرافق',
        columns: ['الفاتورة / المرجع', 'العقار', 'الفترة', 'إجمالي الفاتورة', 'المدفوع', 'المتبقي', 'جهة التحمل', 'الحالة'],
        rows: utilities.map((bill) => [
          text(bill.bill_number ?? bill.id),
          text(propertyTitles?.get(bill.property_id) ?? '—'),
          text(bill.billing_period_start && bill.billing_period_end ? `${bill.billing_period_start.slice(0, 10)} → ${bill.billing_period_end.slice(0, 10)}` : dateLabel(bill.due_date)),
          amount(bill.amount),
          amount(bill.paid_amount),
          amount(bill.amount - bill.paid_amount),
          text(responsiblePartyLabels[bill.responsible_party] ?? bill.responsible_party),
          text(UTILITY_STATUS_LABELS[bill.status] ?? bill.status),
        ]),
        totals: [
          text('إجمالي فواتير المرافق'),
          text(''),
          text(''),
          amount(utilities.reduce((sum, bill) => sum + bill.amount, 0)),
          amount(utilities.reduce((sum, bill) => sum + bill.paid_amount, 0)),
          amount(utilities.reduce((sum, bill) => sum + (bill.amount - bill.paid_amount), 0)),
          text(''),
          text(''),
        ],
        emptyNote: 'لا توجد فواتير خدمات ومرافق مسجلة.',
      },
    });
  }

  // Maintenance / expenses / utilities deliberately share ONE page when they
  // fit: they are a single operational-cost block, not one page per section.
  if (operationalBlocks.length > 0) {
    operationalBlocks.push({
      kind: 'note',
      note: {
        text: 'تكلفة طلب الصيانة لا تُخصم تلقائياً من المالك؛ الاستقطاع المالي يظهر فقط عبر المصروف المعتمد (المصروفات المسجلة أعلاه). لا ازدواج في الاحتساب.',
        tone: 'info',
      },
    });
    groups.push({ keepTogether: true, blocks: operationalBlocks });
  }

  /* --- Group 4 — management fees & owner settlements (approved ≠ paid) --- */
  const feeBlocks: ProfessionalReportGroup['blocks'] = [];
  if (statement || position) {
    const feeRows: ReportCellFormat[][] = [];
    if (statement?.commissionType) {
      feeRows.push([
        text('أساس عمولة الإدارة المسجل'),
        text(`${COMMISSION_TYPE_LABELS[statement.commissionType] ?? statement.commissionType} ${statement.commissionValue != null ? (statement.commissionType?.toUpperCase() === 'RATE' || statement.commissionType?.toUpperCase() === 'PERCENTAGE' ? `(${statement.commissionValue}%)` : `(${statement.commissionValue})`) : ''}`),
      ]);
    }
    if (position) {
      feeRows.push([text('أتعاب إدارة الأملاك للفترة'), amount(position.period.management_fees.amount)]);
      feeRows.push([text('ضريبة القيمة المضافة على الأتعاب'), amount(position.period.fee_vat)]);
    }
    if (feeRows.length > 0) {
      feeBlocks.push({
        kind: 'table',
        table: {
          title: 'أتعاب إدارة الأملاك (رسوم المكتب)',
          columns: ['البند', 'القيمة'],
          rows: feeRows,
        },
      });
      feeBlocks.push({
        kind: 'note',
        note: {
          text: 'أتعاب الإدارة رسوم مكتبية معتمدة منفصلة عن مصروفات العقار التشغيلية؛ الضريبة تظهر فقط إذا كانت مسجلة في السلطة المعتمدة.',
          tone: 'neutral',
        },
      });
    }
  }

  const activeSettlements = (settlements ?? []).filter((settlement) => settlement.status !== 'cancelled');
  if (activeSettlements.length > 0) {
    feeBlocks.push({
      kind: 'table',
      table: {
        title: 'تسويات مستحقات المالك',
        columns: ['الفترة', 'العقار', 'حالة التسوية', 'صافي المبلغ', 'مرجع الدفع'],
        rows: activeSettlements.map((settlement) => [
          text(settlement.period_start && settlement.period_end ? `${dateLabel(settlement.period_start)} → ${dateLabel(settlement.period_end)}` : '—'),
          text(settlement.property_title),
          text(settlementStatusLabel(settlement.status)),
          amount(settlement.net_payable_amount),
          text(settlement.payout_reference ?? '—'),
        ]),
        emptyNote: 'لا توجد تسويات مسجلة.',
      },
    });
    feeBlocks.push({
      kind: 'note',
      note: {
        text: 'التسوية المعتمدة ليست مبلغاً مدفوعاً فعلاً للمالك: تظهر حالة كل تسوية كما هي، ومرجع الدفع يُعرض فقط عند تسجيل صرف فعلي.',
        tone: 'risk',
      },
    });
  }

  if (feeBlocks.length > 0) {
    groups.push({ keepTogether: true, blocks: feeBlocks });
  }

  /* --- Group 5 (LAST) — final owner account reconciliation --- */
  const finalRows: ReportCellFormat[][] = [];
  if (position) {
    finalRows.push(
      [text('+ التحصيلات العائدة للمالك'), amount(position.period.tenant_collections)],
      [text('− أتعاب إدارة الأملاك'), amount(position.period.management_fees.amount)],
      [text('− ضريبة الأتعاب (VAT)'), amount(position.period.fee_vat)],
      [text('− المصروفات المحملة على المالك'), amount(position.period.owner_expenses)],
      [text('= المستحق قبل الصرف (من سلطة التسوية)'), amount(position.period.net_payable)],
      [text('− إجمالي المسدد للمالك (دورة التسويات)'), amount(position.lifecycle_all_time.paid_net)],
      [text('= صافي المتبقي غير المسدد'), amount(position.lifecycle_all_time.remaining_payable)],
    );
  } else if (statement) {
    finalRows.push(
      [text('+ إجمالي المحصل العائد للمالك'), amount(statement.totalGross)],
      [text('− إجمالي الاستقطاعات'), amount(statement.totalDeductions)],
      [text('= صافي المستحق (من كشف المالك)'), amount(statement.totalNet)],
    );
  }

  groups.push({
    keepTogether: true,
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'الحساب الختامي — تسوية حساب المالك',
          columns: ['البند', 'المبلغ'],
          rows: finalRows,
          emptyNote: 'لا توجد بيانات تسوية معتمدة لإصدار الحساب الختامي.',
        },
      },
      {
        kind: 'note',
        note: {
          text: 'رصيد أول المدة ورصيد آخر المدة الدائر غير متاحين من سلطة قراءة معتمدة حالياً — DATA AUTHORITY GAP يُسجَّل ولا يُختلق. الإقفال أعلاه يُعرض حصراً من الموقف المالي المعتمد للفترة ودورة تسويات المالك، ولا يعيد المحرك احتساب أي سطر.',
          tone: 'info',
        },
      },
    ],
  });

  return {
    reportTitle: 'كشف المالك التفصيلي',
    reportType: 'Owner_Financial_Report_Pack',
    periodFrom: periodFrom ?? null,
    periodTo: periodTo ?? null,
    generatedAt: generatedAt ?? getTodayLocalDateString(),
    scopeLabel: scopeLabel ?? null,
    ownerName,
    propertyTitle: scopeLabel ?? null,
    identity: [
      { label: 'اسم المالك', value: ownerName },
      { label: 'نطاق العقارات', value: scopeLabel ?? 'جميع العقارات المُدارة' },
      { label: 'فترة التقرير', value: `${dateLabel(periodFrom)} إلى ${dateLabel(periodTo)}` },
      { label: 'تاريخ الإصدار', value: dateLabel(generatedAt ?? getTodayLocalDateString()) },
    ],
    groups,
  };
}

const UTILITY_STATUS_LABELS: Record<string, string> = {
  unpaid: 'مستحقة السداد',
  partially_paid: 'مدفوعة جزئياً',
  paid: 'مسددة بالكامل',
};

/* ------------------------------------------------------------------ */
/* Guarded print/PDF actions                                           */
/* ------------------------------------------------------------------ */

function runOwnerReportAction(params: {
  settings: DocumentCompanySettings;
  context: OwnerReportContext;
  mode: 'print' | 'pdf';
}): Promise<void> {
  const { settings, context, mode } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () => {
      const payload = buildOwnerReportPayload(context);
      if (mode === 'print') {
        return documentService.printDocument('owner_report', { settings, payload });
      }
      return documentService.downloadDocumentPdf('owner_report', { settings, payload });
    },
    fallbackMessage: mode === 'print' ? 'تعذرت طباعة كشف المالك التفصيلي.' : 'تعذر تصدير كشف المالك التفصيلي كملف PDF.',
  });
}

export function printOwnerReport(params: { settings: DocumentCompanySettings; context: OwnerReportContext }): Promise<void> {
  return runOwnerReportAction({ settings: params.settings, context: params.context, mode: 'print' });
}

export function downloadOwnerReportPdf(params: { settings: DocumentCompanySettings; context: OwnerReportContext }): Promise<void> {
  return runOwnerReportAction({ settings: params.settings, context: params.context, mode: 'pdf' });
}

/* ------------------------------------------------------------------ */
/* On-demand context loader (wires the canonical read authorities)     */
/* ------------------------------------------------------------------ */

export type OwnerReportLoaderParams = Readonly<{
  ownerId: string;
  from: string;
  to: string;
  /** Optional property scope; applied only when the property belongs to the owner. */
  propertyId?: string | null;
  /** Canonical owner statement already loaded by the workspace (transactions included). */
  statement?: OwnerStatementReport | null;
}>;

/**
 * Assembles the owner report context from canonical authorities, reusing the
 * workspace's already-loaded owner statement for transaction detail and
 * loading on demand only what the workspace does not carry: the official
 * financial position (`rpt_owner_financial_position`), the owner settlements
 * lifecycle, the owner's current properties (property_owners), and the
 * period-scoped maintenance/utility records of those properties.
 *
 * Read-only and deterministic — no posting logic, no recalculation.
 */
export async function loadOwnerReportContext(params: OwnerReportLoaderParams): Promise<OwnerReportContext> {
  const { ownerId, from, to, propertyId, statement } = params;

  const authority = await getOwnerFinancialAuthority(ownerId, from, to);

  /* Owner's current property scope (active property_owners links only). */
  const ownerPropertyRows = await listOwnerProperties(ownerId);
  const propertyTitles = new Map(ownerPropertyRows.map((property) => [property.id, property.title] as const));
  const ownerPropertyIds = ownerPropertyRows.map((property) => property.id);
  const propertyInScope = Boolean(propertyId && ownerPropertyIds.includes(propertyId));
  const scopePropertyIds = propertyInScope && propertyId ? [propertyId] : ownerPropertyIds;

  const scopePropertyTitles = new Map<string, string>();
  for (const id of scopePropertyIds) {
    const title = propertyTitles.get(id);
    if (title) scopePropertyTitles.set(id, title);
  }

  const [allSettlements, allMaintenance, allBills] = await Promise.all([
    listOwnerSettlements(),
    listMaintenance('all', ''),
    listUtilityBills(),
  ]);

  const settlements = allSettlements.filter((settlement) => settlement.owner_id === ownerId);
  const maintenanceRows = allMaintenance.filter((request) => {
    if (!request.property_id || !scopePropertyIds.includes(request.property_id)) return false;
    const date = (request.request_date ?? request.created_at)?.slice(0, 10) ?? '';
    return date >= from && date <= to;
  });
  const utilityBills = allBills.filter((bill) => {
    if (!scopePropertyIds.includes(bill.property_id)) return false;
    const date = (bill.billing_period_end ?? bill.due_date)?.slice(0, 10) ?? '';
    return date >= from && date <= to;
  });

  const scopeLabel = propertyInScope
    ? `العقار: ${propertyTitles.get(propertyId!) ?? 'العقار المحدد'}`
    : `عقارات المالك المُدارة (${scopePropertyIds.length})`;

  return {
    ownerName: statement?.ownerName ?? 'مالك غير محدد',
    periodFrom: from,
    periodTo: to,
    scopeLabel,
    generatedAt: getTodayLocalDateString(),
    statement: statement ?? null,
    position: authority.position,
    settlements,
    maintenanceRows,
    utilityBills,
    propertyTitles: scopePropertyTitles,
  };
}