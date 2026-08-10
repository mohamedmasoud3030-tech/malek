import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useActiveCompanyId } from '@/hooks/use-company';
import { useDebounce } from '@/hooks/useDebounce';
import { useCommandPaletteStore } from './command-palette-store';
import { STATIC_COMMANDS, type StaticCommand } from './command-registry';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'people' | 'properties' | 'units' | 'contracts' | 'owners' | 'tenants' | 'lands' | 'invoices' | 'receipts' | 'maintenance';
  route: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
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

export function escapePostgREST(str: string): string {
  if (!str) return '';
  // Escape backslashes first, then commas, parentheses, colons, dots, percents, and underscores
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/:/g, '\\:')
    .replace(/\./g, '\\.')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
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
  const { canAccess, isAuthenticated, authorization } = useAuth();
  const activeCompanyId = useActiveCompanyId();
  const { isOpen } = useCommandPaletteStore();
  const trimmed = query.trim();
  const normalizedQuery = normalizeText(trimmed);

  // Instant local search for Static commands (respects permissions)
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

  // Debounce the network query for entities
  const debouncedQuery = useDebounce(trimmed, 300);
  const isQueryLongEnough = debouncedQuery.length >= 2;

  const canAccessOwners = canAccess('owners.hub.view');
  const canAccessLands = canAccess('lands.view');
  const canAccessMaintenance = canAccess('maintenance.view');

  const entitySearchQuery = useQuery({
    // Cache is strictly scoped to activeCompanyId and userId to prevent cache bleed
    queryKey: ['global-entity-search', activeCompanyId, authorization?.userId, debouncedQuery],
    queryFn: async ({ signal }): Promise<SearchResultItem[]> => {
      if (!isQueryLongEnough || !isOpen) return [];

      const escaped = escapePostgREST(debouncedQuery);
      const term = `%${escaped}%`;

      // Concurrent execution of authorized entity queries with abort signal support
      const promises = [
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
          .select('id, reference, status, start_date, end_date, properties:property_id!inner(title), people:tenant_id!inner(full_name)')
          .is('deleted_at', null)
          .or(`properties.title.ilike.${term},people.full_name.ilike.${term}`) // Server-side contract search!
          .limit(5)
          .abortSignal(signal),
        canAccessOwners
          ? supabase
              .from('owners')
              .select('id, full_name, display_name, phone, email')
              .is('deleted_at', null)
              .or(`full_name.ilike.${term},display_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
              .limit(5)
              .abortSignal(signal)
          : Promise.resolve({ data: [], error: null }),
        canAccessLands
          ? supabase
              .from('lands')
              .select('id, name, plot_no, location, category, status')
              .or(`plot_no.ilike.${term},name.ilike.${term},location.ilike.${term}`)
              .limit(5)
              .abortSignal(signal)
          : Promise.resolve({ data: [], error: null }),
        (supabase as any)
          .from('invoices')
          .select('id,reference,status,due_date,amount,contracts:contract_id(people:tenant_id(full_name),properties:property_id(title))')
          .ilike('reference', term)
          .limit(5)
          .abortSignal(signal),
        (supabase as any)
          .from('receipts')
          .select('id,reference,amount,date_time')
          .ilike('reference', term)
          .limit(5)
          .abortSignal(signal),
        canAccessMaintenance
          ? (supabase as any)
              .from('maintenance_records')
              .select('id,reference,title,status,priority,properties:property_id(title)')
              .or(`reference.ilike.${term},title.ilike.${term}`)
              .limit(5)
              .abortSignal(signal)
          : Promise.resolve({ data: [], error: null }),
      ];

      const [
        peopleRes,
        propertiesRes,
        unitsRes,
        contractsRes,
        ownersRes,
        landsRes,
        invoicesRes,
        receiptsRes,
        maintenanceRes,
      ] = await Promise.all(promises);

      // Explicit error handling: Fail search as a single unit on any response failure
      const errors = [
        peopleRes.error,
        propertiesRes.error,
        unitsRes.error,
        contractsRes.error,
        ownersRes.error,
        landsRes.error,
        invoicesRes.error,
        receiptsRes.error,
        maintenanceRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error('Supabase query error in command palette search:', errors[0]);
        throw new Error(errors[0]?.message || 'تعذر جلب نتائج البحث من السيرفر');
      }

      const results: SearchResultItem[] = [];

      const peopleData = (peopleRes.data || []) as any[];
      const propertiesData = (propertiesRes.data || []) as any[];
      const unitsData = (unitsRes.data || []) as any[];
      const contractsData = (contractsRes.data || []) as any[];
      const ownersData = (ownersRes.data || []) as any[];
      const landsData = (landsRes.data || []) as any[];
      const invoicesData = (invoicesRes.data || []) as any[];
      const receiptsData = (receiptsRes.data || []) as any[];
      const maintenanceData = (maintenanceRes.data || []) as any[];

      // ── Process People (separating general People from Tenants)
      for (const p of peopleData) {
        const typeLabel = p.type === 'tenant' ? 'مستأجر' : p.type === 'owner' ? 'مالك' : 'جهة اتصال';
        const subtitle = `${typeLabel} • ${p.phone ?? p.email ?? ''}`;
        results.push({
          id: p.id,
          title: p.full_name,
          subtitle,
          category: p.type === 'tenant' ? 'tenants' : 'people',
          // Tenant redirects to tenants list filtered by search term for perfect navigation
          route: p.type === 'tenant' ? '/tenants/$tenantId' : '/people/$personId',
          params: p.type === 'tenant' ? { tenantId: p.id } : { personId: p.id },
        });
      }

      // ── Process Properties
      for (const prop of propertiesData) {
        results.push({
          id: prop.id,
          title: prop.title,
          subtitle: prop.address ?? 'العنوان غير محدد',
          category: 'properties',
          route: '/properties/$propertyId',
          params: { propertyId: prop.id },
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
          route: '/properties/$propertyId/units/$unitId',
          params: { propertyId: u.property_id, unitId: u.id },
        });
      }

      // ── Process Contracts
      for (const c of contractsData) {
        const propTitle = c.properties?.title ?? '';
        const tenantName = c.people?.full_name ?? '';
        const statusLabel = c.status === 'active' ? 'نشط' : c.status === 'draft' ? 'مسودة' : 'منتهي';
        results.push({
          id: c.id,
          title: c.reference || `عقد المستأجر ${tenantName}`,
          subtitle: `${propTitle} • حالة: ${statusLabel}`,
          category: 'contracts',
          route: '/contracts/$contractId',
          params: { contractId: c.id },
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
          route: '/owners/$ownerId',
          params: { ownerId: o.id },
        });
      }

      // ── Process Lands
      for (const l of landsData) {
        results.push({
          id: l.id,
          title: `أرض: ${l.name}`,
          subtitle: `مخطط رقم ${l.plot_no} • ${l.location ?? ''}`,
          category: 'lands',
          route: '/lands/$landId',
          params: { landId: l.id },
        });
      }

      for (const invoice of invoicesData) {
        const context = invoice.contracts;
        const tenantName = context?.people?.full_name ?? 'مستأجر غير محدد';
        results.push({
          id: invoice.id,
          title: invoice.reference || 'فاتورة مسجلة',
          subtitle: `${tenantName} • استحقاق ${invoice.due_date}`,
          category: 'invoices',
          route: '/invoices',
          search: { invoiceId: invoice.id },
        });
      }

      for (const receipt of receiptsData) {
        results.push({
          id: receipt.id,
          title: receipt.reference || 'إيصال مسجل',
          subtitle: `تحصيل بقيمة ${receipt.amount} • ${receipt.date_time}`,
          category: 'receipts',
          route: '/receipts',
          search: { receiptId: receipt.id },
        });
      }

      for (const request of maintenanceData) {
        results.push({
          id: request.id,
          title: request.reference || request.title || 'طلب صيانة',
          subtitle: `${request.properties?.title ?? 'عقار غير محدد'} • ${request.status}`,
          category: 'maintenance',
          route: '/maintenance',
          search: { requestId: request.id },
        });
      }

      // Simple matching & ranking:
      return results.sort((a, b) => {
        const scoreA = scoreResult(a.title, a.subtitle, normalizedQuery);
        const scoreB = scoreResult(b.title, b.subtitle, normalizedQuery);
        return scoreB - scoreA;
      });
    },
    enabled: isOpen && isQueryLongEnough,
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
export default useCommandSearch;
