import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/store/ui-store';

const KEY_PREFIX = 'rentrix_onboarding_';

function readFlag(userId: string | undefined, suffix: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  return window.localStorage.getItem(`${KEY_PREFIX}${userId}_${suffix}`) === 'true';
}

function writeFlag(userId: string | undefined, suffix: string, value: boolean): void {
  if (typeof window === 'undefined' || !userId) return;
  if (value) window.localStorage.setItem(`${KEY_PREFIX}${userId}_${suffix}`, 'true');
  else window.localStorage.removeItem(`${KEY_PREFIX}${userId}_${suffix}`);
}

export type OnboardingProgress = Readonly<{
  hasProperty: boolean;
  hasUnit: boolean;
  hasContract: boolean;
  hasInvoice: boolean;
}>;

export type OnboardingControls = Readonly<{
  /** Whether the checklist should be rendered at all. */
  isVisible: boolean;
  /** All required steps are finished — persist completion. */
  complete: () => void;
  /** User opts out permanently (persisted per user). */
  skip: () => void;
  /** Snooze for this session only (reappears next load) via the ui-store. */
  dismissLater: () => void;
  /** Clear every flag (e.g. from a settings reset). */
  reset: () => void;
}>;

/**
 * Onboarding visibility + persistence.
 *
 * The signed-in user id is resolved from the Supabase session (no auth-router
 * context required) so the checklist can be mounted anywhere. Completion/skip
 * live in `localStorage` keyed per user (`rentrix_onboarding_{userId}_{completed|skipped}`)
 * and survive reloads; the "إكمال لاحقاً"/collapse action is a transient,
 * per-session flag held in the existing zustand `ui-store`.
 */
export function useOnboarding(): OnboardingControls {
  const dismissedSession = useUiStore((s) => s.onboardingDismissed);
  const setDismissedSession = useUiStore((s) => s.setOnboardingDismissed);

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [completed, setCompleted] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user?.id;
      setUserId(id);
      setCompleted(readFlag(id, 'completed'));
      setSkipped(readFlag(id, 'skipped'));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id;
      setUserId(id);
      setCompleted(readFlag(id, 'completed'));
      setSkipped(readFlag(id, 'skipped'));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const complete = useCallback(() => {
    writeFlag(userId, 'completed', true);
    setCompleted(true);
  }, [userId]);

  const skip = useCallback(() => {
    writeFlag(userId, 'skipped', true);
    setSkipped(true);
  }, [userId]);

  const dismissLater = useCallback(() => {
    setDismissedSession(true);
  }, [setDismissedSession]);

  const reset = useCallback(() => {
    writeFlag(userId, 'completed', false);
    writeFlag(userId, 'skipped', false);
    setCompleted(false);
    setSkipped(false);
    setDismissedSession(false);
  }, [userId, setDismissedSession]);

  const isVisible = Boolean(userId) && !completed && !skipped && !dismissedSession;

  return { isVisible, complete, skip, dismissLater, reset };
}
