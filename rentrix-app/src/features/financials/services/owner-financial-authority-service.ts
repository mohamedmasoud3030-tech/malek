import { supabase } from '@/lib/supabase';

export type OwnerFinancialPeriod = Readonly<{
  tenant_collections: number;
  management_fees: Readonly<{
    amount: number;
    breakdown?: Record<string, unknown>;
  }>;
  owner_expenses: number;
  fee_vat: number;
  authorized_adjustments: number;
  adjustments_note?: string | null;
  net_payable: number;
}>;

export type OwnerFinancialLifecycle = Readonly<{
  settled_pending_net: number;
  /** Settled entitlement, including amounts discharged by lawful offset. */
  paid_net: number;
  paid_cash: number | null;
  paid_cash_proven_total: number;
  paid_cash_evidence_missing_count: number;
  remaining_payable: number;
  draft_count: number;
  approved_count: number;
  paid_count: number;
  cancelled_count: number;
}>;

/**
 * Owner funds held, with the same evidence contract the settlement-cash block
 * already uses: `held` is present only when the append-only funds register
 * carries evidence for this owner. `null` means unproven, NOT zero — a sum of
 * zero over an empty register and a genuinely empty register are different
 * facts, and the report must not present the first as the second.
 */
type OwnerFundsHeld = Readonly<{
  held: number | null;
  held_proven_total: number;
  held_evidence_missing_count: number;
}>;

export type OwnerFinancialPosition = Readonly<{
  owner_id: string;
  basis?: string | null;
  operating_model?: string | null;
  period: OwnerFinancialPeriod;
  lifecycle_all_time: OwnerFinancialLifecycle;
  owner_funds: OwnerFundsHeld;
}>;

export type OwnerStatementSummary = Readonly<{
  total_gross: number;
  total_deductions: number;
  total_net: number | null;
}>;

export type OwnerFinancialAuthority = Readonly<{
  position: OwnerFinancialPosition;
  statement: OwnerStatementSummary;
}>;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`استجابة ${label} غير صالحة من الخادم`);
  }
  return value as Record<string, unknown>;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    throw new Error(`استجابة ${label} لا تحتوي قيمة مالية صالحة`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`استجابة ${label} لا تحتوي قيمة مالية صالحة`);
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`استجابة ${label} ناقصة المعرّف`);
  return value;
}

/**
 * Canonical owner identity of a position response.
 *
 * `rpt_owner_financial_position` returns the requested owner under
 * `meta.owner_id` (see the canonical baseline definition and its COMMENT).
 * An earlier client revision read a root-level `owner_id` that the database
 * has never emitted, so every real response failed identity validation before
 * any figure could render. The identity check itself is a genuine control —
 * it stops one owner's money being shown under another owner — so it is kept
 * and pointed at the field the server actually populates. A root-level
 * variant is still accepted for forward compatibility, and a response with
 * neither is rejected rather than rendered without a proven owner.
 */
function positionMeta(root: Record<string, unknown>): Record<string, unknown> {
  return root.meta && typeof root.meta === 'object' && !Array.isArray(root.meta)
    ? root.meta as Record<string, unknown>
    : {};
}

function positionOwnerId(root: Record<string, unknown>): string {
  const meta = positionMeta(root);
  const candidate = typeof meta.owner_id === 'string' && meta.owner_id.trim() !== ''
    ? meta.owner_id
    : root.owner_id;
  return requiredString(candidate, 'الموقف المالي للمالك');
}

function parsePosition(value: unknown): OwnerFinancialPosition {
  const root = asRecord(value, 'الموقف المالي للمالك');
  const period = asRecord(root.period, 'فترة الموقف المالي');
  const managementFees = asRecord(period.management_fees, 'رسوم الإدارة');
  const lifecycle = asRecord(root.lifecycle_all_time, 'دورة تسويات المالك');
  const ownerFunds = asRecord(root.owner_funds, 'أموال المالك');
  const missingCash = requiredNumber(lifecycle.paid_cash_evidence_missing_count, 'عدد التسويات غير المثبتة نقدياً');
  const provenCash = requiredNumber(lifecycle.paid_cash_proven_total, 'الصرف النقدي المثبت');
  const paidCash = lifecycle.paid_cash === null ? null : requiredNumber(lifecycle.paid_cash, 'إجمالي الصرف النقدي');
  if (!Number.isInteger(missingCash) || missingCash < 0 || provenCash < 0
    || missingCash > requiredNumber(lifecycle.paid_count, 'عدد التسويات المسواة')
    || (missingCash === 0) !== (paidCash !== null) || (paidCash !== null && paidCash !== provenCash)) {
    throw new Error('استجابة إثبات الصرف النقدي غير متسقة؛ لا يمكن عرض إجمالي غير مثبت.');
  }


  const meta = positionMeta(root);

  return {
    owner_id: positionOwnerId(root),
    // `basis`/`operating_model` are optional descriptive labels. The canonical
    // function exposes its derivation authority under `meta`; it does not emit
    // a `basis` field. Read both locations and keep null when the server said
    // nothing, so the UI badge stays absent instead of asserting a basis the
    // server never declared.
    basis: typeof root.basis === 'string' ? root.basis
      : typeof meta.derivation_authority === 'string' ? meta.derivation_authority : null,
    operating_model: typeof root.operating_model === 'string' ? root.operating_model
      : typeof meta.operating_model === 'string' ? meta.operating_model : null,
    period: {
      tenant_collections: requiredNumber(period.tenant_collections, 'تحصيلات الفترة'),
      management_fees: {
        amount: requiredNumber(managementFees.amount, 'رسوم الإدارة'),
        breakdown: managementFees.breakdown && typeof managementFees.breakdown === 'object' && !Array.isArray(managementFees.breakdown)
          ? managementFees.breakdown as Record<string, unknown>
          : undefined,
      },
      owner_expenses: requiredNumber(period.owner_expenses, 'مصروفات المالك'),
      fee_vat: requiredNumber(period.fee_vat, 'ضريبة رسوم الإدارة'),
      authorized_adjustments: requiredNumber(period.authorized_adjustments, 'التعديلات المعتمدة'),
      adjustments_note: typeof period.adjustments_note === 'string' ? period.adjustments_note : null,
      net_payable: requiredNumber(period.net_payable, 'صافي مستحق الفترة'),
    },
    lifecycle_all_time: {
      settled_pending_net: requiredNumber(lifecycle.settled_pending_net, 'التسويات المعلقة'),
      paid_net: requiredNumber(lifecycle.paid_net, 'استحقاقات التسويات المسواة'),
      paid_cash: paidCash,
      paid_cash_proven_total: provenCash,
      paid_cash_evidence_missing_count: missingCash,
      remaining_payable: requiredNumber(lifecycle.remaining_payable, 'المتبقي المستحق'),
      draft_count: requiredNumber(lifecycle.draft_count, 'عدد المسودات'),
      approved_count: requiredNumber(lifecycle.approved_count, 'عدد التسويات المعتمدة'),
      paid_count: requiredNumber(lifecycle.paid_count, 'عدد التسويات المدفوعة'),
      cancelled_count: requiredNumber(lifecycle.cancelled_count, 'عدد التسويات الملغاة'),
    },
    owner_funds: parseOwnerFunds(ownerFunds),
  };
}

/**
 * Validates the held-funds block against its own evidence contract.
 *
 * The three fields must tell one consistent story, so an internally
 * contradictory response is rejected rather than rendered:
 *   * `held_evidence_missing_count` is 0 or 1 (one owner, one register);
 *   * `held` is non-null exactly when evidence exists, and equals the proven
 *     total when it is.
 *
 * A server that has not yet been migrated emits only `held` as a number. That
 * shape is still accepted, and is reported as *proven* because that legacy
 * field was only ever produced from the same register sum — never fabricated.
 */
function parseOwnerFunds(ownerFunds: Record<string, unknown>): OwnerFundsHeld {
  const hasEvidenceContract = ownerFunds.held_proven_total !== undefined
    || ownerFunds.held_evidence_missing_count !== undefined;

  if (!hasEvidenceContract) {
    const legacyHeld = requiredNumber(ownerFunds.held, 'أموال المالك المحتجزة');
    return { held: legacyHeld, held_proven_total: legacyHeld, held_evidence_missing_count: 0 };
  }

  const missing = requiredNumber(ownerFunds.held_evidence_missing_count, 'عدد سجلات أموال المالك غير المثبتة');
  const provenTotal = requiredNumber(ownerFunds.held_proven_total, 'إجمالي أموال المالك المثبت');
  const held = ownerFunds.held === null ? null : requiredNumber(ownerFunds.held, 'أموال المالك المحتجزة');

  if (!Number.isInteger(missing) || (missing !== 0 && missing !== 1)
    || provenTotal < 0
    || (missing === 0) !== (held !== null)
    || (held !== null && held !== provenTotal)) {
    throw new Error('استجابة أموال المالك غير متسقة؛ لا يمكن عرض رصيد غير مثبت.');
  }

  return { held, held_proven_total: provenTotal, held_evidence_missing_count: missing };
}

function parseStatement(value: unknown): OwnerStatementSummary {
  const root = asRecord(value, 'كشف حساب المالك');
  return {
    total_gross: requiredNumber(root.total_gross, 'إجمالي كشف المالك'),
    total_deductions: requiredNumber(root.total_deductions, 'إجمالي استقطاعات كشف المالك'),
    // Some deployed statement versions expose an explicit net and some do not.
    // Never derive it client-side: surface it only when the server supplied it.
    total_net: optionalNumber(root.total_net ?? root.net_total ?? root.net_payable),
  };
}

export async function getOwnerFinancialAuthority(
  ownerId: string,
  from: string,
  to: string,
): Promise<OwnerFinancialAuthority> {
  const args = { p_owner_id: ownerId, p_from: from, p_to: to };
  const [positionResult, statementResult] = await Promise.all([
    supabase.rpc('rpt_owner_financial_position', args),
    supabase.rpc('rpt_owner_statement', args),
  ]);

  if (positionResult.error) throw positionResult.error;
  if (statementResult.error) throw statementResult.error;

  const position = parsePosition(positionResult.data);
  if (position.owner_id !== ownerId) throw new Error('الموقف المالي المسترجع لا يخص المالك المطلوب');

  return {
    position,
    statement: parseStatement(statementResult.data),
  };
}
