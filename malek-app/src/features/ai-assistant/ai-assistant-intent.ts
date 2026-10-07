import type { AiAssistantAction, AiAssistantSurfaceContext } from './types';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

function normalizePrompt(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(prompt: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => prompt.includes(phrase));
}

const DRAFT_INTENT = [
  'جهز',
  'حضّر',
  'حضر',
  'اكتب مسوده',
  'اعمل مسوده',
  'مسوده',
  'صيغه',
  'prepare',
  'draft',
  'write a follow up',
] as const;

const EXPLAIN_INTENT = [
  'اشرح',
  'وضح',
  'فهمني',
  'السجل ده',
  'السجل هذا',
  'الصفحه دي',
  'الصفحه هذه',
  'وضعه ايه',
  'وضعها ايه',
  'عامل ايه',
  'ليه محتاج اهتمام',
  'ليه يحتاج اهتمام',
  'رصيده',
  'رصيد المالك',
  'مستحقات المالك',
  'what am i looking at',
  'explain this',
  'explain the record',
  'why does this need attention',
  'owner balance',
] as const;

const DAILY_BRIEF_INTENT = [
  'ايه المهم دلوقتي',
  'ايه المهم النهارده',
  'ايه المهم اليوم',
  'ما المهم الان',
  'ما المهم اليوم',
  'اهتم بايه',
  'اولوياتي اليوم',
  'اولويات اليوم',
  'اعمل ايه النهارده',
  'اعمل ايه اليوم',
  'what matters now',
  'what matters today',
  'what should i care about today',
  'my priorities today',
] as const;

const OVERDUE_INTENT = [
  'متاخر',
  'المتاخرات',
  'تحصيل',
  'مين عليه فلوس',
  'مين عليه',
  'overdue',
  'arrears',
  'collections',
] as const;

const RENEWAL_INTENT = [
  'عقد هينتهي',
  'عقد هتخلص',
  'عقود هتنتهي',
  'عقود هتخلص',
  'العقود اللي هتنتهي',
  'العقود اللي هتخلص',
  'تنتهي قريب',
  'تجديد العقود',
  'contract exp',
  'renewal',
] as const;

const VACANCY_INTENT = [
  'وحده فاضيه',
  'وحدات فاضيه',
  'وحده شاغره',
  'وحدات شاغره',
  'نسبه الاشغال',
  'الشواغر',
  'vacant',
  'vacancy',
  'occupancy',
] as const;

const MAINTENANCE_INTENT = [
  'الصيانه',
  'طلب صيانه',
  'طلبات صيانه',
  'maintenance',
  'repair',
] as const;

const DORMANT_FUNDS_INTENT = [
  'فلوس واقفه',
  'اموال واقفه',
  'تامينات محتجز',
  'تامينات محجوز',
  'dormant funds',
  'held deposit',
] as const;

const MONTH_INTENT = [
  'ملخص الشهر',
  'الشهر ده',
  'الشهر هذا',
  'last 30 days',
  'monthly summary',
] as const;

const EXPENSE_INTENT = [
  'مصروفات',
  'مصاريف',
  'النفقات',
  'صرفنا',
  'صرفت كام',
  'expenses',
  'expense',
] as const;

const OWNER_POSITION_INTENT = [
  'موقف المالك',
  'الموقف المالي للمالك',
  'مالية المالك',
  'رصيد المالك',
  'مستحقات المالك',
  'تسويات المالك',
  'owner balance',
  'owner financial',
  'owner position',
] as const;

const NAVIGATION_INTENT = [
  'اروح فين',
  'فين اروح',
  'افتح ايه',
  'فين الاقي',
  'وديني',
  'where do i go',
  'where should i go',
  'open the right',
] as const;

function inferDraftAction(prompt: string, surface?: AiAssistantSurfaceContext): AiAssistantAction {
  if (includesAny(prompt, MAINTENANCE_INTENT.map(normalizePrompt))) return 'draft_maintenance_followup';
  if (includesAny(prompt, RENEWAL_INTENT.map(normalizePrompt))) return 'draft_contract_renewal_followup';
  if (includesAny(prompt, ['مالك', 'owner'])) return 'draft_owner_summary';
  if (includesAny(prompt, [...OVERDUE_INTENT.map(normalizePrompt), 'مستاجر', 'tenant', 'تذكير دفع', 'payment reminder'])) {
    return 'draft_tenant_payment_reminder';
  }

  switch (surface?.entityType) {
    case 'owner':
      return 'draft_owner_summary';
    case 'contract':
      return 'draft_contract_renewal_followup';
    case 'tenant':
    case 'person':
      return 'draft_tenant_payment_reminder';
    default:
      return surface?.section === 'maintenance' ? 'draft_maintenance_followup' : 'draft_internal_note';
  }
}

/**
 * Converts a narrow set of high-value natural questions into the same closed
 * action union used by the deterministic assistant runtime.
 *
 * It does not create capabilities, infer permissions, inspect records, or
 * execute anything. Unknown prompts stay free-form and continue through the
 * existing model/fallback path.
 */
export function inferAiAssistantAction(
  rawPrompt: string,
  surface?: AiAssistantSurfaceContext,
): AiAssistantAction | undefined {
  const prompt = normalizePrompt(rawPrompt);
  if (!prompt) return undefined;

  if (includesAny(prompt, DRAFT_INTENT.map(normalizePrompt))) {
    return inferDraftAction(prompt, surface);
  }

  if (
    surface?.entityType === 'owner'
    && surface.entityId
    && includesAny(prompt, OWNER_POSITION_INTENT.map(normalizePrompt))
  ) {
    return 'explain_owner_financial_position';
  }

  if (surface?.entityType && surface.entityId && includesAny(prompt, EXPLAIN_INTENT.map(normalizePrompt))) {
    return 'explain_current_surface';
  }

  if (includesAny(prompt, DAILY_BRIEF_INTENT.map(normalizePrompt))) return 'generate_daily_brief';
  if (includesAny(prompt, MAINTENANCE_INTENT.map(normalizePrompt))) return 'list_overdue_or_critical_maintenance';
  if (includesAny(prompt, RENEWAL_INTENT.map(normalizePrompt))) return 'summarize_contract_renewals';
  if (includesAny(prompt, VACANCY_INTENT.map(normalizePrompt))) return 'summarize_vacancy';
  if (includesAny(prompt, OVERDUE_INTENT.map(normalizePrompt))) return 'summarize_overdue_invoices';
  if (includesAny(prompt, DORMANT_FUNDS_INTENT.map(normalizePrompt))) return 'locate_dormant_funds';
  // The explicit "monthly summary" ask keeps its own action even when the
  // prompt also mentions expenses; a bare expense ask wins the expense action.
  if (
    includesAny(prompt, EXPENSE_INTENT.map(normalizePrompt))
    && !includesAny(prompt, ['ملخص الشهر'].map(normalizePrompt))
  ) return 'summarize_expenses';
  if (includesAny(prompt, MONTH_INTENT.map(normalizePrompt))) return 'summarize_month';

  if (
    surface?.entityType
    && surface.entityId
    && includesAny(prompt, NAVIGATION_INTENT.map(normalizePrompt))
  ) {
    return 'explain_current_surface';
  }

  return undefined;
}
