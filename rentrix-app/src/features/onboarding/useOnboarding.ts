import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/store/ui-store';
import {
  completeCompanyOnboarding,
  getCompanyOnboardingState,
  resetCompanyOnboarding,
  waiveOnboardingRequirement,
  type OnboardingRequirementState,
} from './onboardingService';

export type OnboardingProgress = Readonly<{
  hasProperty: boolean;
  hasUnit: boolean;
  hasContract: boolean;
  hasInvoice: boolean;
}>;

export type OnboardingControls = Readonly<{
  /** Whether the checklist should be rendered at all. */
  isVisible: boolean;
  /** Server state is still loading (avoid a flash of stale/local state). */
  isLoading: boolean;
  /** Authoritative requirement templates + waiver flags from Postgres. */
  requirements: OnboardingRequirementState[];
  /** Company-scoped completion fact (no longer a per-user localStorage flag). */
  completed: boolean;
  /** All required steps are finished — persists completion server-side. */
  complete: () => void;
  /** Admin-authorized waiver for an ADMIN_WAIVABLE step (reason required). */
  waive: (code: string, reason: string, evidenceReference?: string) => void;
  /** Admin-only settings reset (clears waivers + completion). */
  reset: () => void;
  /** Snooze for this session only (reappears next load) via the ui-store. */
  dismissLater: () => void;
}>;

/**
 * GAP-005: backend-driven onboarding state.
 *
 * Completion/waiver state lives in company-scoped Postgres tables with an
 * audited waiver record (actor, time, reason, authority, evidence). The
 * transient per-session collapse stays in the zustand `ui-store`, which is
 * presentation state, not a source of truth.
 */
export function useOnboarding(): OnboardingControls {
  const queryClient = useQueryClient();
  const dismissedSession = useUiStore((s) => s.onboardingDismissed);
  const setDismissedSession = useUiStore((s) => s.setOnboardingDismissed);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setIsAuthenticated(Boolean(data.session?.user?.id));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user?.id));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const stateQuery = useQuery({
    queryKey: ['onboarding', 'state'],
    queryFn: getCompanyOnboardingState,
    enabled: isAuthenticated,
    retry: 1,
  });

  const completeMutation = useMutation({
    mutationFn: completeCompanyOnboarding,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'state'] });
      toast.success('تم إنهاء الإعداد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنهاء الإعداد'),
  });

  const waiveMutation = useMutation({
    mutationFn: (input: { code: string; reason: string; evidenceReference?: string }) =>
      waiveOnboardingRequirement(input.code, input.reason, input.evidenceReference),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'state'] });
      toast.success('تم تسجيل التنازل المصرّح به');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل التنازل'),
  });

  const resetMutation = useMutation({
    mutationFn: resetCompanyOnboarding,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'state'] });
      toast.success('تمت إعادة ضبط حالة الإعداد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذرت إعادة الضبط'),
  });

  const complete = useCallback(() => {
    void completeMutation.mutateAsync().catch(() => undefined);
  }, [completeMutation]);

  const waive = useCallback(
    (code: string, reason: string, evidenceReference?: string) => {
      void waiveMutation.mutateAsync({ code, reason, evidenceReference }).catch(() => undefined);
    },
    [waiveMutation],
  );

  const reset = useCallback(() => {
    void resetMutation.mutateAsync().catch(() => undefined);
  }, [resetMutation]);

  const dismissLater = useCallback(() => {
    setDismissedSession(true);
  }, [setDismissedSession]);

  const completed = stateQuery.data?.completed ?? false;
  const requirements = stateQuery.data?.requirements ?? [];
  const isVisible = isAuthenticated && !stateQuery.isLoading && !completed && !dismissedSession;

  return {
    isVisible,
    isLoading: stateQuery.isLoading,
    requirements,
    completed,
    complete,
    waive,
    reset,
    dismissLater,
  };
}
