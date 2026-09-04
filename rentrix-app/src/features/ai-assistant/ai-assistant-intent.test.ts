import { describe, expect, it } from 'vitest';
import { inferAiAssistantAction } from './ai-assistant-intent';
import type { AiAssistantSurfaceContext } from './types';

function surface(
  entityType: AiAssistantSurfaceContext['entityType'] = null,
  entityId: string | null = null,
  section: string | null = null,
): AiAssistantSurfaceContext {
  return {
    route: entityType && entityId ? `/${entityType}s/${entityId}` : '/dashboard',
    entityType,
    entityId,
    entityLabel: null,
    section,
  };
}

describe('inferAiAssistantAction', () => {
  it('routes what-matters-now language to the deterministic daily brief', () => {
    expect(inferAiAssistantAction('إيه المهم دلوقتي؟', surface())).toBe('generate_daily_brief');
    expect(inferAiAssistantAction('What should I care about today?', surface())).toBe('generate_daily_brief');
  });

  it('uses the verified current entity for explain, balance, attention, and navigation questions', () => {
    const property = surface('property', 'prop-1', 'properties');
    expect(inferAiAssistantAction('اشرح السجل ده', property)).toBe('explain_current_surface');
    expect(inferAiAssistantAction('أروح فين بعد كده؟', property)).toBe('explain_current_surface');
    expect(inferAiAssistantAction('ليه محتاج اهتمام؟', surface('contract', 'contract-1', 'contracts'))).toBe('explain_current_surface');
    expect(inferAiAssistantAction('رصيد المالك ده كام؟', surface('owner', 'owner-1', 'owners'))).toBe('explain_current_surface');
  });

  it('maps preparation language only to existing reviewable draft actions', () => {
    expect(inferAiAssistantAction('حضّر لي ملخص للمالك', surface('owner', 'owner-1', 'owners'))).toBe('draft_owner_summary');
    expect(inferAiAssistantAction('جهز لي تذكير دفع', surface('tenant', 'tenant-1', 'tenants'))).toBe('draft_tenant_payment_reminder');
    expect(inferAiAssistantAction('جهز متابعة للصيانة', surface(null, null, 'maintenance'))).toBe('draft_maintenance_followup');
  });

  it('recognizes the main operational signals without inventing new actions', () => {
    expect(inferAiAssistantAction('مين متأخر في التحصيل؟', surface())).toBe('summarize_overdue_invoices');
    expect(inferAiAssistantAction('إيه العقود اللي هتخلص قريب؟', surface())).toBe('summarize_contract_renewals');
    expect(inferAiAssistantAction('عندي كام وحدة فاضية؟', surface())).toBe('summarize_vacancy');
    expect(inferAiAssistantAction('إيه طلبات الصيانة المفتوحة؟', surface())).toBe('list_overdue_or_critical_maintenance');
    expect(inferAiAssistantAction('إيه المصروفات في آخر 30 يوم؟', surface())).toBe('summarize_expenses');
    expect(inferAiAssistantAction('كام صرفنا الشهر ده؟', surface())).toBe('summarize_expenses');
  });

  it('keeps the monthly summary distinct from the expense summary', () => {
    expect(inferAiAssistantAction('اعمل لي ملخص الشهر ده', surface())).toBe('summarize_month');
    expect(inferAiAssistantAction('ملخص الشهر من دفعات ومصروفات', surface())).toBe('summarize_month');
    expect(inferAiAssistantAction('مصروفات الشهر ده كام؟', surface())).toBe('summarize_expenses');
  });

  it('leaves unrelated prompts on the existing free-form path', () => {
    expect(inferAiAssistantAction('قارن لي النتيجة دي بالتقرير السابق', surface())).toBeUndefined();
  });
});
