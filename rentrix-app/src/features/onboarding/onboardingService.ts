import { supabase } from '@/lib/supabase';

/**
 * GAP-005: authoritative, backend-driven onboarding state.
 *
 * Completion/waiver state is company-scoped and audited in Postgres; the
 * browser no longer persists a per-user localStorage flag. Step *completion*
 * (does an owner/property/unit/contract/invoice exist) remains derived from
 * live company data by the dashboard; this service owns the state that must
 * not live in the browser: waivers and completion.
 */

export type OnboardingWaiverPolicy = 'NON_WAIVABLE' | 'ADMIN_WAIVABLE';

export type OnboardingRequirementState = Readonly<{
  code: string;
  label_ar: string;
  required: boolean;
  waiver_policy: OnboardingWaiverPolicy;
  sort_order: number;
  waived: boolean;
  waiver_reason: string | null;
  waived_at: string | null;
  waiver_authority: string | null;
  evidence_reference: string | null;
}>;

export type CompanyOnboardingState = Readonly<{
  company_id: string;
  completed: boolean;
  requirements: OnboardingRequirementState[];
}>;

function parseState(data: unknown): CompanyOnboardingState {
  if (!data || typeof data !== 'object') throw new Error('استجابة غير صالحة من خادم الإعداد');
  const state = data as CompanyOnboardingState;
  if (typeof state.completed !== 'boolean' || !Array.isArray(state.requirements)) {
    throw new Error('استجابة حالة الإعداد ناقصة الحقول المطلوبة');
  }
  return state;
}

export async function getCompanyOnboardingState(): Promise<CompanyOnboardingState> {
  const { data, error } = await supabase.rpc('get_company_onboarding_state');
  if (error) throw error;
  return parseState(data);
}

export async function waiveOnboardingRequirement(
  code: string,
  reason: string,
  evidenceReference?: string | null,
): Promise<unknown> {
  const { data, error } = await supabase.rpc('waive_onboarding_requirement_atomic', {
    p_code: code,
    p_reason: reason,
    p_evidence_reference: evidenceReference ?? null,
  });
  if (error) throw error;
  return data;
}

export async function revokeOnboardingWaiver(code: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('revoke_onboarding_waiver_atomic', { p_code: code });
  if (error) throw error;
  return data;
}

export async function completeCompanyOnboarding(): Promise<unknown> {
  const { data, error } = await supabase.rpc('complete_company_onboarding_atomic');
  if (error) throw error;
  return data;
}

export async function resetCompanyOnboarding(): Promise<unknown> {
  const { data, error } = await supabase.rpc('reset_company_onboarding_atomic');
  if (error) throw error;
  return data;
}
