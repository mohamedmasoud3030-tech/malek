import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export const ACTIVE_COMPANY_ERROR = 'تعذر تحديد الشركة النشطة';
export const ACTIVE_COMPANY_RESOLUTION_TIMEOUT_MS = 12_000;
export const ACTIVE_COMPANY_BOOTSTRAP_FALLBACK_DELAY_MS = 300;

/**
 * A company claim is a security boundary, but the UI must not remain in a
 * permanent loading state when an Auth/PostgREST request stalls. Timing out
 * preserves the existing fail-closed behavior and returns the operator to a
 * clear recovery screen instead of a blank workspace.
 */
export function withCompanyResolutionTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = ACTIVE_COMPANY_RESOLUTION_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error(ACTIVE_COMPANY_ERROR)), timeoutMs);
    Promise.resolve(operation).then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export type Company = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
};

export type CompanyMemberRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'OPERATIONS' | 'USER' | 'VIEWER';

export type CompanyContextValue = {
  companies: Company[];
  activeCompany: Company | null;
  isLoading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  hasMultipleCompanies: boolean;
  currentRole: CompanyMemberRole | null;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

type MembershipRow = {
  company_id: string;
  role: string;
  companies: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    locale: string;
  } | null;
};

/**
 * Active-company resolution contract (security boundary, fail-closed):
 *
 * 1. company_members is the ONLY source of truth for WHICH companies a user may
 *    access. The provider queries ACTIVE memberships in ACTIVE companies and
 *    never offers anything outside that list.
 *
 * 2. user_metadata.company_id is an untrusted browser preference. It becomes
 *    authoritative only after the server-side custom_access_token_hook validates
 *    it against an active membership and stamps app_metadata.company_id into the
 *    ACCESS TOKEN claims during token issuance. The browser can never write
 *    app_metadata directly.
 *
 * 3. RLS policies and every financial SECURITY DEFINER RPC derive the tenant
 *    from public.current_company_id() = app_metadata.company_id in the JWT.
 *    The provider therefore reads the SAME issued access-token claim that
 *    PostgreSQL sees. session.user.app_metadata is the Auth user record and is
 *    not guaranteed to contain transient claims added by Custom Access Token
 *    Hooks, so it is deliberately not used as the tenant authority here.
 */

function readCompanyIdFromAppMetadata(appMetadata: unknown): string | null {
  if (!appMetadata || typeof appMetadata !== 'object') return null;
  const companyId = (appMetadata as Record<string, unknown>).company_id;
  return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
}

/**
 * Decodes only the payload of an access token already returned by Supabase Auth.
 * Signature verification remains a server responsibility; the browser uses the
 * decoded value only to keep its UI tenant aligned with the exact token sent to
 * PostgREST/RPCs. Malformed tokens fail closed.
 */
function readCompanyIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;

  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

    if (!claims || typeof claims !== 'object') return null;
    return readCompanyIdFromAppMetadata((claims as Record<string, unknown>).app_metadata);
  } catch {
    return null;
  }
}

/** Selects a company ONLY when the server-issued claim matches an authorized membership. */
function pickClaimMatchedCompany(companyList: Company[], claim: string | null): Company | null {
  if (!claim) return null;
  return companyList.find((company) => company.id === claim) ?? null;
}

/**
 * Server-side JWT sync for the active company:
 * stores the selection intent in user_metadata (untrusted preference), then asks
 * the auth server for a freshly hooked token and returns the company claim from
 * that exact ACCESS TOKEN. Callers must verify the returned claim before exposing
 * tenant data.
 */
async function requestServerClaimSync(companyId: string): Promise<string | null> {
  const { error: updateError } = await supabase.auth.updateUser({
    data: { company_id: companyId },
  });
  if (updateError) throw updateError;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;

  return readCompanyIdFromAccessToken(refreshed.session?.access_token);
}

export function CompanyProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useAuth();
  const authenticatedUserId = session?.user.id ?? null;
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<CompanyMemberRole | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [showBootstrapFallback, setShowBootstrapFallback] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (isAuthLoading) {
      return () => { mounted = false; };
    }

    if (!session?.user) {
      void queryClient.cancelQueries();
      queryClient.clear();
      setResolvedUserId(null);
      setHasAuthenticatedSession(false);
      setCompanies([]);
      setActiveCompany(null);
      setCurrentRole(null);
      setLoadError(null);
      setIsLoading(false);
      return () => { mounted = false; };
    }

    const sessionUser = session.user;
    const sessionAccessToken = session.access_token;

    async function loadCompanies() {
      setIsLoading(true);
      setResolvedUserId(null);
      setLoadError(null);
      setHasAuthenticatedSession(true);

      await queryClient.cancelQueries();
      queryClient.clear();

      try {
        // Authorized memberships are the source of truth for resolution.
        // Ordering matches the access-token hook fallback
        // (ORDER BY cm.created_at, cm.id) so client and server defaults agree.
        const { data, error } = await withCompanyResolutionTimeout(
          supabase
            .from('company_members')
            .select('company_id, role, companies!inner(id, name, slug, currency, locale)')
            .eq('user_id', sessionUser.id)
            .eq('is_active', true)
            .eq('companies.is_active', true)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }),
        );

        if (error) throw error;
        if (!mounted) return;

        const memberships = (data ?? []) as unknown as MembershipRow[];
        const companyList = memberships
          .map((membership) => membership.companies)
          .filter((company): company is NonNullable<MembershipRow['companies']> => company !== null);

        // No authorized membership at all: nothing may open (fail closed).
        if (companyList.length === 0) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }

        // Step 1 — use the claim from the actual server-issued access token.
        let jwtCompanyId = readCompanyIdFromAccessToken(sessionAccessToken);
        let selectedCompany = pickClaimMatchedCompany(companyList, jwtCompanyId);

        // Step 2 — a cached token may predate the membership or the hook:
        // refresh once (no writes) and let the server re-derive the claim.
        if (!selectedCompany) {
          const { data: refreshed, error: refreshError } = await withCompanyResolutionTimeout(supabase.auth.refreshSession());
          if (refreshError) throw refreshError;
          jwtCompanyId = readCompanyIdFromAccessToken(refreshed.session?.access_token);
          selectedCompany = pickClaimMatchedCompany(companyList, jwtCompanyId);
        }

        // Step 3 — the claim still matches no authorized membership. Resolve the
        // deterministic membership default, sync the preference server-side, and
        // unlock only if the ACCESS TOKEN issued by the server verifies it.
        if (!selectedCompany) {
          const membershipDefault = companyList[0];
          const verifiedClaim = await withCompanyResolutionTimeout(requestServerClaimSync(membershipDefault.id));
          if (!mounted) return;
          if (verifiedClaim !== membershipDefault.id) {
            throw new Error(ACTIVE_COMPANY_ERROR);
          }
          selectedCompany = membershipDefault;
        }

        setCompanies(companyList);
        setActiveCompany(selectedCompany);

        const activeMembership = memberships.find(
          (membership) => membership.company_id === selectedCompany.id,
        );
        setCurrentRole((activeMembership?.role as CompanyMemberRole) ?? null);
        setResolvedUserId(sessionUser.id);
      } catch (error) {
        console.error('CompanyProvider error:', error);
        if (mounted) {
          setCompanies([]);
          setActiveCompany(null);
          setCurrentRole(null);
          setResolvedUserId(sessionUser.id);
          setLoadError(ACTIVE_COMPANY_ERROR);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadCompanies();
    return () => { mounted = false; };
  }, [authenticatedUserId, isAuthLoading, reloadVersion, queryClient]);

  const switchCompany = useCallback(async (companyId: string) => {
    const company = companies.find((candidate) => candidate.id === companyId);
    if (!company) throw new Error(ACTIVE_COMPANY_ERROR);

    setIsLoading(true);
    setLoadError(null);
    let sessionUserId: string | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(ACTIVE_COMPANY_ERROR);
      sessionUserId = session.user.id;

      if (readCompanyIdFromAccessToken(session.access_token) !== companyId) {
        const verifiedClaim = await requestServerClaimSync(companyId);
        if (verifiedClaim !== companyId) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }
      }

      // Role comes from the authorized membership row, never from the request.
      // maybeSingle: a race that drops membership between the company list load
      // and switch must fail closed with ACTIVE_COMPANY_ERROR, not a PostgREST 406.
      const { data: membership, error: membershipError } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) throw new Error(ACTIVE_COMPANY_ERROR);

      await queryClient.cancelQueries();
      queryClient.clear();

      setActiveCompany(company);
      setCurrentRole((membership?.role as CompanyMemberRole) ?? null);
      setResolvedUserId(session.user.id);
    } catch (error) {
      await queryClient.cancelQueries();
      queryClient.clear();
      setActiveCompany(null);
      setCurrentRole(null);
      setResolvedUserId(sessionUserId);
      setLoadError(ACTIVE_COMPANY_ERROR);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [companies, queryClient]);

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    activeCompany,
    isLoading,
    switchCompany,
    hasMultipleCompanies: companies.length > 1,
    currentRole,
  }), [companies, activeCompany, isLoading, switchCompany, currentRole]);

  const isCompanyContextTransition = authenticatedUserId !== resolvedUserId;
  const shouldBlockForCompanyResolution = isCompanyContextTransition || (isLoading && !activeCompany);

  useEffect(() => {
    if (!shouldBlockForCompanyResolution) {
      setShowBootstrapFallback(false);
      return;
    }

    const timeout = globalThis.setTimeout(
      () => setShowBootstrapFallback(true),
      ACTIVE_COMPANY_BOOTSTRAP_FALLBACK_DELAY_MS,
    );
    return () => globalThis.clearTimeout(timeout);
  }, [shouldBlockForCompanyResolution]);

  if (shouldBlockForCompanyResolution) {
    return (
      <main
        className="min-h-dvh bg-background p-4 sm:p-6"
        dir="rtl"
        aria-busy="true"
        aria-label="جاري تجهيز مساحة العمل"
      >
        {showBootstrapFallback ? (
          <div
            className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col gap-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:min-h-[calc(100dvh-3rem)]"
            data-testid="company-bootstrap-skeleton"
          >
            <div className="h-14 w-full animate-pulse rounded-2xl bg-muted/55" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="h-24 animate-pulse rounded-2xl bg-muted/45" />
              <div className="h-24 animate-pulse rounded-2xl bg-muted/45" />
              <div className="h-24 animate-pulse rounded-2xl bg-muted/45" />
              <div className="h-24 animate-pulse rounded-2xl bg-muted/45" />
            </div>
            <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <div className="min-h-72 animate-pulse rounded-2xl bg-muted/40" />
              <div className="min-h-52 animate-pulse rounded-2xl bg-muted/35" />
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (hasAuthenticatedSession && (loadError || !activeCompany)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6" dir="rtl">
        <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm" role="alert">
          <h1 className="text-lg font-bold text-foreground">{ACTIVE_COMPANY_ERROR}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            لم يتم فتح مساحة العمل لحماية البيانات ومنع إنشاء سجلات بدون شركة.
            تحقق من الاتصال ثم أعد المحاولة. إذا استمرت المشكلة، راجع مسؤول النظام لتفعيل عضويتك في الشركة.
          </p>
          <Button
            type="button"
            className="mt-5 rounded-xl px-5"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            إعادة المحاولة
          </Button>
        </section>
      </main>
    );
  }

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}

export function useActiveCompanyId(): string | null {
  return useCompany().activeCompany?.id ?? null;
}
