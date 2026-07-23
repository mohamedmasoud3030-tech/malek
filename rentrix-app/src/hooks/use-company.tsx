import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';

export const ACTIVE_COMPANY_ERROR = 'تعذر تحديد الشركة النشطة';

/* ── Types ──────────────────────────────────────────── */

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

/* ── Types for membership query result ──────────────── */

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

/* ── Provider ───────────────────────────────────────── */

export function CompanyProvider({ children }: PropsWithChildren) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<CompanyMemberRole | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCompanies() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) {
            setHasAuthenticatedSession(false);
            setCompanies([]);
            setActiveCompany(null);
            setCurrentRole(null);
          }
          return;
        }

        if (mounted) setHasAuthenticatedSession(true);

        // Production currently exposes only these stable columns. Do not request
        // optional columns that are absent from the live schema.
        const { data, error } = await supabase
          .from('company_members')
          .select('company_id, role, companies!inner(id, name, slug, currency, locale)')
          .eq('user_id', session.user.id);

        if (error) throw error;
        if (!mounted) return;

        const memberships = (data ?? []) as unknown as MembershipRow[];
        const companyList = memberships
          .map((membership) => membership.companies)
          .filter((company): company is NonNullable<MembershipRow['companies']> => company !== null);

        if (companyList.length === 0) {
          throw new Error(ACTIVE_COMPANY_ERROR);
        }

        let jwtCompanyId = readCompanyIdFromAppMetadata(session.user.app_metadata);
        let selectedCompany = companyList.find((company) => company.id === jwtCompanyId) ?? null;

        // Financial RPCs and RLS read app_metadata.company_id. Refresh an older
        // session once so the access-token hook can inject the current company.
        if (!selectedCompany) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          jwtCompanyId = readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata);
          selectedCompany = companyList.find((company) => company.id === jwtCompanyId) ?? null;
        }

        // A single membership is already an explicit authorization decision.
        // Use it as the safe local selection when an older/stale access token
        // has not yet received app_metadata.company_id from the auth hook.
        // This avoids locking out valid single-company users while preserving
        // the membership/RLS boundary; a multi-company session still requires
        // an explicit JWT company claim.
        if (!selectedCompany && companyList.length === 1) {
          selectedCompany = companyList[0];
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
      } catch (error) {
        console.error('CompanyProvider error:', error);
        if (mounted) {
          setCompanies([]);
          setActiveCompany(null);
          setCurrentRole(null);
          setLoadError(ACTIVE_COMPANY_ERROR);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadCompanies();
    return () => { mounted = false; };
  }, [reloadVersion]);

  const switchCompany = useCallback(async (companyId: string) => {
    const company = companies.find((candidate) => candidate.id === companyId);
    if (!company) throw new Error(ACTIVE_COMPANY_ERROR);

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
      .single();

    if (membershipError) throw membershipError;

    setActiveCompany(company);
    setCurrentRole((membership?.role as CompanyMemberRole) ?? null);
  }, [companies]);

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    activeCompany,
    isLoading,
    switchCompany,
    hasMultipleCompanies: companies.length > 1,
    currentRole,
  }), [companies, activeCompany, isLoading, switchCompany, currentRole]);

  if (isLoading) {
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

/** Active company ID or null — use for INSERT payloads. */
export function useActiveCompanyId(): string | null {
  return useCompany().activeCompany?.id ?? null;
}
