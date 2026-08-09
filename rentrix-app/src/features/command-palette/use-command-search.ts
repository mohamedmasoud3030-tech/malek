import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { STATIC_COMMANDS, type StaticCommand } from './command-registry';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'people' | 'properties' | 'units' | 'contracts' | 'owners' | 'tenants' | 'lands';
  route: string;
}

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

// Perform simple match ranking
export function scoreResult(title: string, subtitle: string, searchNormalized: string): number {
  const tNorm = normalizeText(title);
  const sNorm = normalizeText(subtitle);

  if (tNorm === searchNormalized || sNorm === searchNormalized) return 100;
  if (tNorm.startsWith(searchNormalized) || sNorm.startsWith(searchNormalized)) return 80;
  if (tNorm.includes(searchNormalized) || sNorm.includes(searchNormalized)) return 50;
  return 0;
}

export function useCommandSearch(query: string) {
  const { canAccess, isAuthenticated } = useAuth();
  const trimmed = query.trim();
  const normalizedQuery = normalizeText(trimmed);

  // 1. Static commands search (fast & local, respects permissions)
  const filteredStaticCommands = useMemo(() => {
    if (!isAuthenticated) return [];
    return STATIC_COMMANDS.filter((cmd) => {
      // Respect permissions
      if (cmd.permission && !canAccess(cmd.permission)) {
        return false;
      }
      if (!trimmed) return true;

      // Match keywords or title
      return cmd.keywords.some((kw) => normalizeText(kw).includes(normalizedQuery)) ||
             normalizeText(cmd.title).includes(normalizedQuery);
    });
  }, [normalizedQuery, trimmed, canAccess, isAuthenticated]);

  // 2. Global Entity Search (React Query server-state search with debounce handled by caller or state)
  const isQueryLongEnough = trimmed.length >= 2;

  const entitySearchQuery = useQuery({
    queryKey: ['global-entity-search', trimmed],
    queryFn: async ({ signal }): Promise<SearchResultItem[]> => {
      if (!isQueryLongEnough) return [];

      const escaped = trimmed.replaceAll('%', '\\%').replaceAll('_', '\\_');
      const term = `%${escaped}%`;

      // Concurrent execution of all 6 entity queries with abort signal support
      const [
        peopleRes,
        propertiesRes,
        unitsRes,
        contractsRes,
        ownersRes,
        landsRes,
      ] = await Promise.all([
        supabase
          .from('people')
          .select('id, full_name, phone, email, type')
          .is('deleted_at', null)
          .or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
          .limit(5)
          .abortSignal(signal),
        supabase
          .from('properties')
          .select('id, title, address')
          .is('deleted_at', null)
          .or(`title.ilike.${term},address.ilike.${term}`)
          .limit(5)
          .abortSignal(signal),
        supabase
          .from('units')
          .select('id, unit_number, status, property_id, properties:property_id(title)')
          .is('deleted_at', null)
          .ilike('unit_number', term)
          .limit(5)
          .abortSignal(signal),
        supabase
          .from('contracts')
          .select('id, status, start_date, end_date, properties:property_id(title), people:tenant_id(full_name)')
          .is('deleted_at', null)
          .limit(15)
          .abortSignal(signal),
        supabase
          .from('owners')
          .select('id, full_name, display_name, phone, email')
          .is('deleted_at', null)
          .or(`full_name.ilike.${term},display_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
          .limit(5)
          .abortSignal(signal),
        supabase
          .from('lands')
          .select('id, name, plot_no, location, category, status')
          .or(`plot_no.ilike.${term},name.ilike.${term},location.ilike.${term}`)
          .limit(5)
          .abortSignal(signal),
      ]);

      const results: SearchResultItem[] = [];

      const peopleData = (peopleRes.data || []) as any[];
      const propertiesData = (propertiesRes.data || []) as any[];
      const unitsData = (unitsRes.data || []) as any[];
      const contractsData = (contractsRes.data || []) as any[];
      const ownersData = (ownersRes.data || []) as any[];
      const landsData = (landsRes.data || []) as any[];

      // ── Process People (separating general People from Tenants)
      for (const p of peopleData) {
        const typeLabel = p.type === 'tenant' ? 'مستأجر' : p.type === 'owner' ? 'مالك' : 'جهة اتصال';
        const subtitle = `${typeLabel} • ${p.phone ?? p.email ?? ''}`;
        results.push({
          id: p.id,
          title: p.full_name,
          subtitle,
          category: p.type === 'tenant' ? 'tenants' : 'people',
          route: p.type === 'tenant' ? `/tenants` : `/people/${p.id}/edit`,
        });
      }

      // ── Process Properties
      for (const prop of propertiesData) {
        results.push({
          id: prop.id,
          title: prop.title,
          subtitle: prop.address ?? 'العنوان غير محدد',
          category: 'properties',
          route: `/properties/${prop.id}`,
        });
      }

      // ── Process Units
      for (const u of unitsData) {
        const propTitle = u.properties?.title ?? '';
        const statusLabel = u.status === 'occupied' ? 'مشغولة' : 'شاغرة';
        results.push({
          id: u.id,
          title: `وحدة رقم ${u.unit_number}`,
          subtitle: `${propTitle} • حالة: ${statusLabel}`,
          category: 'units',
          route: `/properties/${u.property_id}/units/${u.id}`,
        });
      }

      // ── Process Contracts (with client-side filtering and ranking)
      const filteredContracts = contractsData.filter((c) => {
        const propTitle = c.properties?.title ?? '';
        const tenantName = c.people?.full_name ?? '';
        const combined = `${propTitle} ${tenantName} ${c.status}`.toLowerCase();
        return combined.includes(trimmed.toLowerCase());
      });

      for (const c of filteredContracts.slice(0, 5)) {
        const propTitle = c.properties?.title ?? '';
        const tenantName = c.people?.full_name ?? '';
        const statusLabel = c.status === 'active' ? 'نشط' : c.status === 'draft' ? 'مسودة' : 'منتهي';
        results.push({
          id: c.id,
          title: `عقد المستأجر ${tenantName}`,
          subtitle: `${propTitle} • حالة: ${statusLabel}`,
          category: 'contracts',
          route: `/contracts/${c.id}`,
        });
      }

      // ── Process Owners
      for (const o of ownersData) {
        const name = o.display_name?.trim() || o.full_name;
        results.push({
          id: o.id,
          title: name,
          subtitle: `مالك • ${o.phone ?? o.email ?? ''}`,
          category: 'owners',
          route: `/owners/${o.id}`,
        });
      }

      // ── Process Lands
      for (const l of landsData) {
        results.push({
          id: l.id,
          title: `أرض: ${l.name}`,
          subtitle: `مخطط رقم ${l.plot_no} • ${l.location ?? ''}`,
          category: 'lands',
          route: `/lands`,
        });
      }

      // 3. Simple matching & ranking:
      return results.sort((a, b) => {
        const scoreA = scoreResult(a.title, a.subtitle, normalizedQuery);
        const scoreB = scoreResult(b.title, b.subtitle, normalizedQuery);
        return scoreB - scoreA;
      });
    },
    enabled: isQueryLongEnough,
    staleTime: 5000,
  });

  return {
    staticCommands: filteredStaticCommands,
    entities: entitySearchQuery.data ?? [],
    isLoading: entitySearchQuery.isLoading,
    isError: entitySearchQuery.isError,
    error: entitySearchQuery.error,
  };
}
