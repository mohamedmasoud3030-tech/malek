import type {
  AiAssistantAction,
  AiAssistantContext,
  AiAssistantResponse,
  AiAssistantSurfaceContext,
} from './types';

export type AiAssistantResponseMode = 'brief' | 'explanation' | 'draft' | 'analysis' | 'advisory';
export type AiAssistantAttentionTone = 'critical' | 'warning' | 'info';

export type AiAssistantAttentionItem = Readonly<{
  label: string;
  tone: AiAssistantAttentionTone;
}>;

export type AiAssistantSuggestedAction = Readonly<{
  action: AiAssistantAction;
  title: string;
  prompt: string;
}>;

export type AiAssistantResponsePresentation = Readonly<{
  mode: AiAssistantResponseMode;
  modeLabel: string;
  contextLabel: string | null;
  attention: readonly AiAssistantAttentionItem[];
  suggestedActions: readonly AiAssistantSuggestedAction[];
}>;

const DRAFT_ACTIONS = new Set<AiAssistantAction>([
  'draft_tenant_payment_reminder',
  'draft_contract_renewal_followup',
  'draft_maintenance_followup',
  'draft_owner_summary',
  'draft_internal_note',
]);

function formatOmr(value: number): string {
  return `${Number(value || 0).toFixed(3)} ر.ع.`;
}

function daysBetween(from: string, to: string): number | null {
  const left = Date.parse(`${from}T00:00:00Z`);
  const right = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.round((right - left) / 86_400_000);
}

function responseMode(kind: AiAssistantResponse['kind'], action?: AiAssistantAction): AiAssistantResponseMode {
  if (kind === 'advisory') return 'advisory';
  if (action && DRAFT_ACTIONS.has(action)) return 'draft';
  if (action === 'generate_daily_brief' || action === 'prioritize_office_actions_top5') return 'brief';
  if (action === 'explain_current_surface' || action === 'explain_property_financial_snapshot' || action === 'explain_owner_financial_position') return 'explanation';
  return 'analysis';
}

function modeLabel(mode: AiAssistantResponseMode): string {
  switch (mode) {
    case 'brief': return 'ملخص تشغيلي';
    case 'explanation': return 'شرح السياق';
    case 'draft': return 'مسودة للمراجعة';
    case 'advisory': return 'نصيحة إرشادية';
    default: return 'تحليل تشغيلي';
  }
}

function buildAttention(context: AiAssistantContext): AiAssistantAttentionItem[] {
  const items: AiAssistantAttentionItem[] = [];
  if (context.overdueInvoices.dueTodayAmount > 0) {
    items.push({ label: `مستحق اليوم ${formatOmr(context.overdueInvoices.dueTodayAmount)}`, tone: 'warning' });
  }

  const maintenance = context.maintenanceSnapshot;
  if (maintenance && (maintenance.urgentOpenCount > 0 || maintenance.stalledCount > 0)) {
    const parts = [
      maintenance.urgentOpenCount > 0 ? `${maintenance.urgentOpenCount} حرجة` : '',
      maintenance.stalledCount > 0 ? `${maintenance.stalledCount} متوقفة` : '',
    ].filter(Boolean);
    items.push({ label: `صيانة: ${parts.join(' • ')}`, tone: maintenance.urgentOpenCount > 0 ? 'critical' : 'warning' });
  }

  if (context.overdueInvoices.totalOutstanding > 0) {
    // The canonical answer already carries the exact financial amount. Keep the
    // attention chip concise so it does not duplicate the same amount in the
    // message bubble or create two indistinguishable text matches for TTS/UI.
    items.push({ label: `متأخرات: ${context.overdueInvoices.invoiceCount} فاتورة`, tone: 'critical' });
  }

  const expiringThisWeek = context.contractRenewals.upcomingContracts.filter((contract) => {
    const days = daysBetween(context.asOf, contract.endDate);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  if (expiringThisWeek > 0) {
    items.push({ label: `${expiringThisWeek} عقد ينتهي خلال 7 أيام`, tone: 'warning' });
  }

  if (items.length < 3 && context.propertyFinancialSnapshot.vacantUnitCount > 0) {
    items.push({ label: `${context.propertyFinancialSnapshot.vacantUnitCount} وحدة شاغرة`, tone: 'info' });
  }

  return items.slice(0, 3);
}

function contextualLabel(context: AiAssistantContext, surface?: AiAssistantSurfaceContext): string | null {
  return context.entity?.name ?? context.surface?.entityLabel ?? surface?.entityLabel ?? null;
}

function buildSuggestedActions(
  context: AiAssistantContext,
  action?: AiAssistantAction,
  surface?: AiAssistantSurfaceContext,
): AiAssistantSuggestedAction[] {
  if (action && DRAFT_ACTIONS.has(action)) return [];

  const entity = context.entity;
  const section = context.surface?.section ?? surface?.section ?? null;
  const suggestions: AiAssistantSuggestedAction[] = [];

  if (entity?.type === 'owner') {
    suggestions.push({
      action: 'draft_owner_summary',
      title: 'حضّر ملخص للمالك',
      prompt: 'حضّر لي مسودة ملخص للمالك الحالي للمراجعة قبل الإرسال.',
    });
    if (action !== 'explain_owner_financial_position') {
      suggestions.push({
        action: 'explain_owner_financial_position',
        title: 'الموقف المالي للمالك',
        prompt: 'إيه الموقف المالي للمالك الحالي من التسويات؟',
      });
    }
  }

  if ((entity?.type === 'tenant' || entity?.type === 'person') && entity.outstandingAmount > 0) {
    suggestions.push({
      action: 'draft_tenant_payment_reminder',
      title: 'حضّر تذكير دفع',
      prompt: 'حضّر لي مسودة تذكير دفع للمستأجر الحالي للمراجعة فقط.',
    });
  }

  if (entity?.type === 'contract') {
    if (entity.outstandingAmount > 0) {
      suggestions.push({
        action: 'draft_tenant_payment_reminder',
        title: 'حضّر تذكير دفع',
        prompt: 'حضّر لي مسودة تذكير دفع مرتبطة بالعقد الحالي للمراجعة فقط.',
      });
    }
    if (entity.endDate) {
      const days = daysBetween(context.asOf, entity.endDate);
      if (days !== null && days >= 0 && days <= 30) {
        suggestions.push({
          action: 'draft_contract_renewal_followup',
          title: 'حضّر متابعة تجديد',
          prompt: 'حضّر لي مسودة متابعة تجديد للعقد الحالي للمراجعة فقط.',
        });
      }
    }
  }

  if (section === 'maintenance' && (context.maintenanceSnapshot?.openCount ?? 0) > 0) {
    suggestions.push({
      action: 'draft_maintenance_followup',
      title: 'حضّر متابعة صيانة',
      prompt: 'حضّر لي مسودة متابعة صيانة للمراجعة قبل أي إرسال.',
    });
  }

  return suggestions.slice(0, 2);
}

export function buildAiAssistantResponsePresentation(
  response: AiAssistantResponse,
  action?: AiAssistantAction,
  surface?: AiAssistantSurfaceContext,
): AiAssistantResponsePresentation {
  const mode = responseMode(response.kind, action);
  const advisory = mode === 'advisory';
  return {
    mode,
    modeLabel: modeLabel(mode),
    // Advisory replies are about the market, not about the open entity.
    contextLabel: advisory ? null : contextualLabel(response.context, surface),
    attention: mode === 'draft' || advisory ? [] : buildAttention(response.context),
    suggestedActions: advisory
      ? [
          // Pull the owner back from market talk to their own numbers.
          {
            action: 'generate_daily_brief',
            title: 'شوف الوضع الحالي',
            prompt: 'إيه المهم دلوقتي؟',
          },
        ]
      : buildSuggestedActions(response.context, action, surface),
  };
}
