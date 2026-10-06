import { getOwnerFinancialAuthority } from '@/features/financials/services/owner-financial-authority-service';
import { formatAssistantOmr } from '../assistant-formatters';
import type { AiAssistantRequest, AiAssistantResponse } from '../types';
import { requestAiAssistantResponse } from './ai-assistant-service';

function currentMonthStart(asOf: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(asOf);
  return match ? `${match[1]}-${match[2]}-01` : null;
}


type OwnerFinancialPosition = Readonly<{
  currentPeriodNet: number;
  remainingPayable: number;
  /** `null` when the funds register carries no evidence — never asserted as 0. */
  heldFunds: number | null;
  approvedSettlements: number;
}>;

/** Owner-dossier financial actions enriched by the canonical authority service. */
const OWNER_FINANCE_ACTIONS: ReadonlySet<string> = new Set([
  'explain_current_surface',
  'explain_owner_financial_position',
]);

/**
 * Reads the owner's financial position from the canonical authority service.
 * Any failure (RLS denial, missing report authority, transport) yields null —
 * the caller degrades to the already-grounded base explanation and never
 * translates failure into a fabricated zero balance.
 */
async function readOwnerFinancialPosition(
  entityId: string,
  from: string,
  asOf: string,
): Promise<OwnerFinancialPosition | null> {
  try {
    const authority = await getOwnerFinancialAuthority(entityId, from, asOf);
    const position = authority.position;
    return {
      currentPeriodNet: position.period.net_payable,
      remainingPayable: position.lifecycle_all_time.remaining_payable,
      heldFunds: position.owner_funds.held,
      approvedSettlements: position.lifecycle_all_time.approved_count,
    };
  } catch {
    return null;
  }
}

/**
 * Operating-layer orchestration around the canonical assistant request.
 *
 * The base assistant remains the single AI runtime. This wrapper adds only
 * deterministic, permission-filtered enrichment from an existing canonical
 * domain service when the current surface is an owner dossier. No AI output is
 * trusted as authority and no mutation path is introduced.
 */
export async function requestAiOperatingResponse(
  request: AiAssistantRequest,
): Promise<AiAssistantResponse> {
  const response = await requestAiAssistantResponse(request);
  const entity = response.context.entity;

  if (!OWNER_FINANCE_ACTIONS.has(request.action ?? '') || entity?.type !== 'owner') {
    return response;
  }

  const from = currentMonthStart(response.context.asOf);
  if (!from) return response;

  const position = await readOwnerFinancialPosition(entity.id, from, response.context.asOf);
  if (!position) return response;

  const name = entity.name ? `«${entity.name}»` : 'المالك الحالي';
  const portfolioLine = `${entity.propertyCount ?? 0} عقار ظاهر و${entity.activeContractCount ?? 0} عقد نشط`;
  const collectionLine = entity.outstandingAmount > 0
    ? `المتأخر على فواتير عقاراته ${formatAssistantOmr(entity.outstandingAmount)}`
    : 'لا توجد متأخرات ظاهرة على فواتير عقاراته';
  // Held funds are spoken as a figure only when the register proves one.
  const heldFundsPhrase = position.heldFunds === null
    ? 'والأموال المحتجزة غير مثبتة لعدم وجود سجلات في دفتر أموال المالك'
    : `والأموال المحتجزة ${formatAssistantOmr(position.heldFunds)}`;
  const financialLine = `الموقف المالي المعتمد من ${from} حتى ${response.context.asOf}: صافي مستحق الفترة ${formatAssistantOmr(position.currentPeriodNet)}، والمتبقي المستحق للمالك ${formatAssistantOmr(position.remainingPayable)}، ${heldFundsPhrase}، مع ${position.approvedSettlements} تسوية معتمدة ضمن دورة التسويات.`;

  const reply = request.action === 'explain_owner_financial_position'
    ? [
        `الموقف المالي لـ${name}: ${portfolioLine}. ${collectionLine}.`,
        financialLine,
        'راجع كشف المالك أو التسويات قبل أي اعتماد أو صرف.',
      ].join('\n')
    : [
        `وضع ${name}: ${portfolioLine}. ${collectionLine}.`,
        financialLine,
        'راجع كشف المالك أو التسويات قبل أي اعتماد أو صرف.',
      ].join('\n');

  return {
    ...response,
    reply,
    context: {
      ...response.context,
      entity: {
        ...entity,
        ownerCurrentPeriodNetPayable: position.currentPeriodNet,
        ownerRemainingPayable: position.remainingPayable,
        // Absent rather than 0: the consumer types this as an optional number,
        // and an unproven balance must not be delivered as a figure.
        ownerHeldFunds: position.heldFunds ?? undefined,
        ownerApprovedSettlements: position.approvedSettlements,
      },
    },
    caveats: [
      ...response.caveats,
      'أرقام الموقف المالي للمالك مسترجعة من الخدمة المالية المعتمدة ضمن صلاحية المستخدم؛ لم يُنفذ أي اعتماد أو صرف.',
    ].slice(0, 5),
    grounded: true,
    source: 'deterministic',
  };
}
