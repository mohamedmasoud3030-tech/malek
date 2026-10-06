import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('onboardingService (GAP-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the authoritative company-scoped onboarding state', async () => {
    const state = {
      company_id: 'c1',
      completed: false,
      requirements: [
        { code: 'owner', label_ar: 'إضافة أول مالك', required: true, waiver_policy: 'NON_WAIVABLE', sort_order: 1, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
      ],
    };
    supabaseMock.rpc.mockResolvedValue({ data: state, error: null });
    const { getCompanyOnboardingState } = await import('./onboardingService');

    await expect(getCompanyOnboardingState()).resolves.toEqual(state);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_company_onboarding_state');
  });

  it('waives an ADMIN_WAIVABLE requirement with a reason and optional evidence', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { id: 'w1' }, error: null });
    const { waiveOnboardingRequirement } = await import('./onboardingService');

    await waiveOnboardingRequirement('unit', 'تُدار خارجياً', 'ext-1');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('waive_onboarding_requirement_atomic', {
      p_code: 'unit',
      p_reason: 'تُدار خارجياً',
      p_evidence_reference: 'ext-1',
    });
  });

  it('completes onboarding server-side', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { company_id: 'c1' }, error: null });
    const { completeCompanyOnboarding } = await import('./onboardingService');

    await completeCompanyOnboarding();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('complete_company_onboarding_atomic');
  });

  it('resets onboarding server-side (admin settings reset)', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { reset: true }, error: null });
    const { resetCompanyOnboarding } = await import('./onboardingService');

    await resetCompanyOnboarding();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('reset_company_onboarding_atomic');
  });

  it('propagates backend gate errors unchanged (e.g. NON_WAIVABLE)', async () => {
    const error = new Error('ONBOARDING_REQUIREMENT_NON_WAIVABLE');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { waiveOnboardingRequirement } = await import('./onboardingService');

    await expect(waiveOnboardingRequirement('owner', 'تخطي')).rejects.toThrow('ONBOARDING_REQUIREMENT_NON_WAIVABLE');
  });

  it('rejects malformed state responses missing the completion flag', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { company_id: 'c1' }, error: null });
    const { getCompanyOnboardingState } = await import('./onboardingService');

    await expect(getCompanyOnboardingState()).rejects.toThrow('ناقصة الحقول');
  });
});
