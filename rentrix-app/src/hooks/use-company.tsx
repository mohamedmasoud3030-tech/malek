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

function readCompanyIdFromAppMetadata(appMetadata: unknown): string | null {
  if (!appMetadata || typeof appMetadata !== 'object') return null;
  const companyId = (appMetadata as Record<string, unknown>).company_id;
  return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
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
        const { data, error } = await supabase
          .from('company_members')
          .select('company_id, role, companies!inner(id, name, slug, currency, locale)')
          .eq('user_id', sessionUser.id)
          .eq('is_active', true)
          .eq('companies.is_active', true);

        if (error) throw error;
        if (!mounted) return;

        const memberships = (data ?? []) as unknown as MembershipRow[];
        const companyList = memberships
          .map((membership) => membership.companies)
          .filter((company): company is NonNullable<MembershipRow['companies']> => company !== null);

        if (companyList.length === 0) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }

        let jwtCompanyId = readCompanyIdFromAppMetadata(sessionUser.app_metadata);
        let selectedCompany = companyList.find((company) => company.id === jwtCompanyId) ?? null;

        if (!selectedCompany) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          jwtCompanyId = readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata);
          selectedCompany = companyList.find((company) => company.id === jwtCompanyId) ?? null;
        }

        if (!selectedCompany) {
          throw new Error(ACTIVE_COMPANY_ERROR);
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
          // Mark this authenticated user's company bootstrap as completed even
          // when it failed. Keeping this null made the transition guard below
          // permanently mask the fail-closed error UI with an infinite loader.
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(ACTIVE_COMPANY_ERROR);

      if (readCompanyIdFromAppMetadata(session.user.app_metadata) !== companyId) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { company_id: companyId },
        });
        if (updateError) throw updateError;

        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        if (readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata) !== companyId) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }
      }

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
      // A failed switch is also a terminal attempt for the current user; surface
      // the fail-closed recovery UI instead of re-entering the transition loader.
      setResolvedUserId(authenticatedUserId);
      setLoadError(ACTIVE_COMPANY_ERROR);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedUserId, companies, queryClient]);

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
