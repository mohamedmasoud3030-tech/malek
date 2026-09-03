import { getOwnerFinancialAuthority } from '@/features/financials/services/owner-financial-authority-service';
import type { AiAssistantRequest, AiAssistantResponse } from '../types';
import { requestAiAssistantResponse } from './ai-assistant-service';

function currentMonthStart(asOf: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(asOf);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

function formatOmr(value: number): string {
  return `${Number(value || 0).toFixed(3)} ر.ع.`;
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

  if (request.action !== 'explain_current_surface' || entity?.type !== 'owner') {
    return response;
  }

  const from = currentMonthStart(response.context.asOf);
  if (!from) return response;

  try {
    const authority = await getOwnerFinancialAuthority(entity.id, from, response.context.asOf);
    const position = authority.position;
    const currentPeriodNet = position.period.net_payable;
    const remainingPayable = position.lifecycle_all_time.remaining_payable;
    const heldFunds = position.owner_funds.held;
    const approvedSettlements = position.lifecycle_all_time.approved_count;
    const name = entity.name ? `«${entity.name}»` : 'المالك الحالي';
    const portfolioLine = `${entity.propertyCount ?? 0} عقار ظاهر و${entity.activeContractCount ?? 0} عقد نشط`;
    const collectionLine = entity.outstandingAmount > 0
      ? `المتأخر على فواتير عقاراته ${formatOmr(entity.outstandingAmount)}`
      : 'لا توجد متأخرات ظاهرة على فواتير عقاراته';

    return {
      ...response,
      reply: [
        `وضع ${name}: ${portfolioLine}. ${collectionLine}.`,
        `الموقف المالي المعتمد من ${from} حتى ${response.context.asOf}: صافي مستحق الفترة ${formatOmr(currentPeriodNet)}، والمتبقي المستحق للمالك ${formatOmr(remainingPayable)}، والأموال المحتجزة ${formatOmr(heldFunds)}، مع ${approvedSettlements} تسوية معتمدة ضمن دورة التسويات.`,
        'راجع كشف المالك أو التسويات قبل أي اعتماد أو صرف.',
      ].join('\n'),
      context: {
        ...response.context,
        entity: {
          ...entity,
          ownerCurrentPeriodNetPayable: currentPeriodNet,
          ownerRemainingPayable: remainingPayable,
          ownerHeldFunds: heldFunds,
          ownerApprovedSettlements: approvedSettlements,
        },
      },
      caveats: [
        ...response.caveats,
        'أرقام الموقف المالي للمالك مسترجعة من الخدمة المالية المعتمدة ضمن صلاحية المستخدم؛ لم يُنفذ أي اعتماد أو صرف.',
      ].slice(0, 5),
      grounded: true,
      source: 'deterministic',
    };
  } catch {
    // RLS denial, missing report authority, or any report failure must degrade
    // to the already-grounded base explanation. Never translate failure into
    // a fabricated zero balance.
    return response;
  }
}
