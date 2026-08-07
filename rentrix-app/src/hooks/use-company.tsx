import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export const ACTIVE_COMPANY_ERROR = 'تعذر تحديد الشركة النشطة';

export type Company = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
};

export type CompanyMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

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
 *    it against an active membership and stamps app_metadata.company_id during
 *    token issuance. The browser can never write app_metadata directly.
 *
 * 3. RLS policies and every financial SECURITY DEFINER RPC derive the tenant
 *    from public.current_company_id() = app_metadata.company_id in the JWT.
 *    The provider therefore unlocks the UI ONLY when the refreshed JWT claim
 *    exactly matches a membership-authorized company. A client-side-only
 *    fallback would render the UI scoped to one tenant while PostgreSQL keeps
 *    another (or none) — so any unresolved mismatch fails closed instead of
 *    bypassing tenant isolation cosmetically.
 */

function readCompanyIdFromAppMetadata(appMetadata: unknown): string | null {
  if (!appMetadata || typeof appMetadata !== 'object') return null;
  const companyId = (appMetadata as Record<string, unknown>).company_id;
  return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
}

/** Selects a company ONLY when the server-issued claim matches an authorized membership. */
function pickClaimMatchedCompany(companyList: Company[], claim: string | null): Company | null {
  if (!claim) return null;
  return companyList.find((company) => company.id === claim) ?? null;
}

/**
 * Server-side JWT sync for the active company:
 * stores the selection intent in user_metadata (untrusted preference), then asks
 * the auth server for a freshly hooked token and returns the claim the SERVER
 * actually issued. Callers must verify the returned claim before exposing data.
 */
async function requestServerClaimSync(companyId: string): Promise<string | null> {
  const { error: updateError } = await supabase.auth.updateUser({
    data: { company_id: companyId },
  });
  if (updateError) throw updateError;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;

  return readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata);
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
        const { data, error } = await supabase
          .from('company_members')
          .select('company_id, role, companies!inner(id, name, slug, currency, locale)')
          .eq('user_id', sessionUser.id)
          .eq('is_active', true)
          .eq('companies.is_active', true)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

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

        // Step 1 — the already-issued claim selects among authorized memberships.
        let jwtCompanyId = readCompanyIdFromAppMetadata(sessionUser.app_metadata);
        let selectedCompany = pickClaimMatchedCompany(companyList, jwtCompanyId);

        // Step 2 — a cached token may predate the membership or the hook:
        // refresh once (no writes) and let the server re-derive the claim.
        if (!selectedCompany) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          jwtCompanyId = readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata);
          selectedCompany = pickClaimMatchedCompany(companyList, jwtCompanyId);
        }

        // Step 3 — the claim still matches no authorized membership. Resolve the
        // deterministic membership default, sync the preference server-side, and
        // unlock only if the server-issued claim verifies against it.
        if (!selectedCompany) {
          const membershipDefault = companyList[0];
          const verifiedClaim = await requestServerClaimSync(membershipDefault.id);
          if (!mounted) return;
          if (verifiedClaim !== membershipDefault.id) {
            // The server refused to honor/derive this membership (misconfigured
            // or outdated auth hook). Fail closed — never render scoped to a
            // company the JWT does not claim.
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
          // A failed resolution is still a TERMINAL state for this user: all
          // tenant state was cleared above, so the transition gate may open and
          // the fail-closed screen becomes reachable instead of an endless
          // loading spinner.
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

      if (readCompanyIdFromAppMetadata(session.user.app_metadata) !== companyId) {
        // Persist the intent as a preference, then require the server (auth
        // hook, validating active membership) to issue the matching claim.
        const verifiedClaim = await requestServerClaimSync(companyId);
        if (verifiedClaim !== companyId) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }
      }

      // Role comes from the authorized membership row, never from the request.
      const { data: membership, error: membershipError } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (membershipError) throw membershipError;

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
      // Terminal (fail-closed) state for the current user: tenant state is
      // cleared, so the error screen must be reachable, not a stuck spinner.
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
  if (isLoading || isCompanyContextTransition) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6" dir="rtl" aria-busy="true">
        <p className="text-sm font-semibold text-muted-foreground">جاري تحديد الشركة النشطة…</p>
      </main>
    );
  }

  if (hasAuthenticatedSession && (loadError || !activeCompany)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6" dir="rtl">
        <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm" role="alert">
          <h1 className="text-lg font-bold text-foreground">{ACTIVE_COMPANY_ERROR}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            لم يتم فتح التطبيق لحماية البيانات ومنع إنشاء سجلات بدون شركة.
          </p>
          <button
            type="button"
            className="mt-5 min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            إعادة المحاولة
          </button>
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
