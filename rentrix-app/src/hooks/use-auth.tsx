import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useRouter } from '@tanstack/react-router';
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
import {
  EFFECTIVE_PERMISSIONS_CHANGED_EVENT,
  loadGrantedPermissions,
} from '@/features/auth/effective-permissions';
import { getCurrentSession, signInWithEmail, signOut } from '@/services/auth-service';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  authorization: AuthorizationContext | null;
  authorizationDiagnostics: AuthorizationDiagnostics;
  canAccess: (permission: AppPermission) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshPermissions: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGIN_PATH = '/login';
const AUTH_STORAGE_KEY = 'rentrix-auth-session';
let effectivePermissionsChannelSequence = 0;

function nextEffectivePermissionsChannelTopic(userId: string): string {
  effectivePermissionsChannelSequence += 1;
  return `effective-permissions:${userId}:${effectivePermissionsChannelSequence}`;
}

function clearStaleSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in privacy mode. Safe to ignore.
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const appRouter = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [grantedPermissions, setGrantedPermissions] = useState<readonly AppPermission[]>([]);
  const [effectivePermissionsResolved, setEffectivePermissionsResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hadSessionRef = useRef(false);
  const explicitLogoutRef = useRef(false);

  const refreshPermissions = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setGrantedPermissions([]);
      setEffectivePermissionsResolved(false);
      return;
    }
    setEffectivePermissionsResolved(false);
    try {
      setGrantedPermissions(await loadGrantedPermissions(userId));
    } catch {
      // Authorization data is security-sensitive: failure resolves to an empty
      // authoritative set instead of retaining stale access.
      setGrantedPermissions([]);
    } finally {
      setEffectivePermissionsResolved(true);
    }
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;

    const stopLoadingIfMounted = () => {
      if (mounted) setIsLoading(false);
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
      if (!mounted) return;

      switch (event) {
        case 'SIGNED_OUT': {
          const wasUnexpected = hadSessionRef.current && !explicitLogoutRef.current;
          setSession(null);
          setGrantedPermissions([]);
          setEffectivePermissionsResolved(false);
          hadSessionRef.current = false;
          if (wasUnexpected) {
            clearStaleSessionStorage();
            toast.error('انتهت جلستك، الرجاء تسجيل الدخول مجددًا للمتابعة.');
          }
          explicitLogoutRef.current = false;
          if (appRouter.state.location.pathname !== LOGIN_PATH) {
            void appRouter.navigate({ to: LOGIN_PATH, replace: true });
          }
          break;
        }
        case 'SIGNED_IN':
        case 'USER_UPDATED':
        case 'TOKEN_REFRESHED':
          setEffectivePermissionsResolved(false);
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
  }, [appRouter]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setGrantedPermissions([]);
      setEffectivePermissionsResolved(false);
      return undefined;
    }

    void refreshPermissions();
    const handleRefresh = () => { void refreshPermissions(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPermissions();
    };
    window.addEventListener(EFFECTIVE_PERMISSIONS_CHANGED_EVENT, handleRefresh);
    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);

    const channel = (supabase as any)
      .channel(nextEffectivePermissionsChannelTopic(userId))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_permission_grants', filter: `user_id=eq.${userId}`,
      }, handleRefresh)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_permission_overrides', filter: `user_id=eq.${userId}`,
      }, handleRefresh)
      .subscribe();

    return () => {
      window.removeEventListener(EFFECTIVE_PERMISSIONS_CHANGED_EVENT, handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      void (supabase as any).removeChannel(channel);
    };
  }, [refreshPermissions, session?.user.id]);

  const authorization = useMemo(() => {
    const base = getAuthorizationContextFromSession(session);
    return base
      ? { ...base, grantedPermissions, effectivePermissionsResolved }
      : null;
  }, [effectivePermissionsResolved, grantedPermissions, session]);
  const authorizationDiagnostics = useMemo(() => getAuthorizationDiagnosticsFromSession(session), [session]);

  useEffect(() => {
    if (!import.meta.env.DEV || !authorizationDiagnostics.metadataMismatch) return;
    console.warn('MALIK authorization role metadata is missing or unrecognized.', {
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
      refreshPermissions,
      login: async (email, password) => {
        await signInWithEmail(email, password);
        await appRouter.navigate({ to: '/dashboard', replace: true });
      },
      logout: async () => {
        explicitLogoutRef.current = true;
        try {
          await signOut();
        } finally {
          setGrantedPermissions([]);
          setEffectivePermissionsResolved(false);
          setSession(null);
          hadSessionRef.current = false;
          if (appRouter.state.location.pathname !== LOGIN_PATH) {
            void appRouter.navigate({ to: LOGIN_PATH, replace: true });
          }
        }
      },
    }),
    [appRouter, authorization, authorizationDiagnostics, isLoading, refreshPermissions, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/** Read-only integrations may render in isolated document/print tests. */
export function useOptionalAuth() {
  return useContext(AuthContext);
}
