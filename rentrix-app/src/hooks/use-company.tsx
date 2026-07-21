import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';

/* ── Types ──────────────────────────────────────────── */

export type Company = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
  timezone: string;
  is_active: boolean;
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
  is_active: boolean;
  companies: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    locale: string;
    timezone: string;
    is_active: boolean;
  } | null;
};

/* ── Provider ───────────────────────────────────────── */

export function CompanyProvider({ children }: PropsWithChildren) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<CompanyMemberRole | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCompanies() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Fetch companies the user belongs to via join
        const { data, error } = await supabase
          .from('company_members')
          .select('company_id, role, is_active, companies!inner(id, name, slug, currency, locale, timezone, is_active)')
          .eq('user_id', session.user.id)
          .eq('is_active', true);

        if (error) {
          console.error('Failed to load companies:', error);
          if (mounted) setIsLoading(false);
          return;
        }

        if (!mounted) return;

        const memberships = (data ?? []) as unknown as MembershipRow[];

        const companyList: Company[] = memberships
          .filter((m) => m.companies?.is_active)
          .map((m) => ({
            id: m.companies!.id,
            name: m.companies!.name,
            slug: m.companies!.slug,
            currency: m.companies!.currency,
            locale: m.companies!.locale,
            timezone: m.companies!.timezone,
            is_active: m.companies!.is_active,
          }));

        setCompanies(companyList);

        // Determine active company from JWT or auto-select first
        const appMeta = session.user.app_metadata as Record<string, unknown> | undefined;
        const jwtCompanyId = appMeta?.company_id as string | undefined;
        const jwtCompany = companyList.find(c => c.id === jwtCompanyId);
        const autoSelected = jwtCompany || companyList[0] || null;
        setActiveCompany(autoSelected);

        const activeMembership = memberships.find(
          (m) => m.company_id === autoSelected?.id
        );
        setCurrentRole((activeMembership?.role as CompanyMemberRole) ?? null);
      } catch (err) {
        console.error('CompanyProvider error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCompanies();
    return () => { mounted = false; };
  }, []);

  const switchCompany = useCallback(async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Update user metadata to set active company_id
      await supabase.auth.updateUser({ data: { company_id: companyId } });
      setActiveCompany(company);

      // Fetch role in new company
      const { data: membership } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', session.user.id)
        .single();

      setCurrentRole((membership?.role as CompanyMemberRole) ?? null);
    } catch (err) {
      console.error('Failed to switch company:', err);
    }
  }, [companies]);

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    activeCompany,
    isLoading,
    switchCompany,
    hasMultipleCompanies: companies.length > 1,
    currentRole,
  }), [companies, activeCompany, isLoading, switchCompany, currentRole]);

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
