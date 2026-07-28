import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  canAccess as canAccessPermission,
  getAuthorizationContextFromSession,
  getAuthorizationDiagnosticsFromSession,
  type AppPermission,
  type AuthorizationContext,
  type AuthorizationDiagnostics,
} from '@/features/auth/permissions';
import { supabase } from '@/lib/supabase';
import { getCurrentSession, signInWithEmail, signOut } from '@/services/auth-service';
import { router } from '@/app/router/app-router';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  authorization: AuthorizationContext | null;
  authorizationDiagnostics: AuthorizationDiagnostics;
  canAccess: (permission: AppPermission) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGIN_PATH = '/login';
const AUTH_STORAGE_KEY = 'rentrix-auth-session';

function redirectToLogin(): void {
  const currentPath = router.state.location.pathname;
  if (currentPath !== LOGIN_PATH) {
    void router.navigate({ to: LOGIN_PATH, replace: true });
  }
}

/**
 * Clears the local session storage entry so a corrupted/stale refresh token
 * (e.g. left over from another Vercel preview deployment sharing the same
 * origin/storage key) cannot keep failing silently on the next load.
 */
function clearStaleSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (privacy mode, etc.) - safe to ignore.
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks whether we last observed an authenticated session, so a SIGNED_OUT
  // event can be told apart from an explicit user-initiated logout (which
  // already clears storage itself via signOut()) vs. an unexpected session
  // drop (e.g. corrupted/expired refresh token) that needs cleanup + a
  // user-facing explanation instead of a silent redirect.
  const hadSessionRef = useRef(false);
  const explicitLogoutRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const stopLoadingIfMounted = () => {
      if (mounted) {
        setIsLoading(false);
      }
    };

    getCurrentSession()
      .then((restoredSession) => {
        if (mounted) {
          setSession(restoredSession);
          hadSessionRef.current = Boolean(restoredSession);
        }
      })
      .finally(stopLoadingIfMounted);

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }

      switch (event) {
        case 'SIGNED_OUT': {
          const wasUnexpected = hadSessionRef.current && !explicitLogoutRef.current;
          setSession(null);
          hadSessionRef.current = false;
          if (wasUnexpected) {
            // Session dropped without an explicit logout call - most likely
            // a corrupted/expired refresh token. Clear the stale storage
            // entry so it can't keep failing on reload, and tell the user
            // plainly instead of redirecting them silently mid-edit.
            clearStaleSessionStorage();
            toast.error('انتهت جلستك، الرجاء تسجيل الدخول مجددًا للمتابعة.');
          }
          explicitLogoutRef.current = false;
          redirectToLogin();
          break;
        }
        case 'SIGNED_IN':
        case 'USER_UPDATED':
          setSession(nextSession);
          hadSessionRef.current = Boolean(nextSession);
          break;
        default:
          break;
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const authorization = useMemo(() => getAuthorizationContextFromSession(session), [session]);
  const authorizationDiagnostics = useMemo(() => getAuthorizationDiagnosticsFromSession(session), [session]);

  useEffect(() => {
    if (!import.meta.env.DEV || !authorizationDiagnostics.metadataMismatch) return;

    console.warn('Rentrix authorization role metadata is missing or unrecognized.', {
      resolvedRole: authorizationDiagnostics.resolvedRole,
      hasAppMetadataUserRole: authorizationDiagnostics.hasUserRoleMetadata,
      hasAppMetadataRole: authorizationDiagnostics.hasRoleMetadata,
      requiredMetadata: 'app_metadata.user_role = "ADMIN" or app_metadata.role = "ADMIN"',
    });
  }, [authorizationDiagnostics]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      authorization,
      authorizationDiagnostics,
      canAccess: (permission) => canAccessPermission(authorization, permission),
      isLoading,
      isAuthenticated: Boolean(session),
      login: async (email, password) => {
        await signInWithEmail(email, password);
        await router.navigate({ to: '/dashboard', replace: true });
      },
      logout: async () => {
        explicitLogoutRef.current = true;
        await signOut();
        setSession(null);
      },
    }),
    [authorization, authorizationDiagnostics, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
