import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';

/**
 * Legacy preview query → canonical URL redirect.
 * Handles old bookmarked URLs like ?previewKind=property&previewId=xxx
 * that were previously handled by EntityPreviewHost via search.
 * Now redirects to canonical entity URLs with replace:true.
 */
export function LegacyPreviewRedirect() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();

  useEffect(() => {
    const kind = typeof search.previewKind === 'string' ? search.previewKind : null;
    const id = typeof search.previewId === 'string' ? search.previewId.trim() : null;
    if (!kind || !id) return;

    // Map preview kind to canonical route
    let to: string | null = null;
    let params: Record<string, string> | undefined;

    if (kind === 'property') {
      to = '/properties/$propertyId';
      params = { propertyId: id };
    } else if (kind === 'contract') {
      to = '/contracts/$contractId';
      params = { contractId: id };
    } else if (kind === 'owner') {
      to = '/owners/$ownerId';
      params = { ownerId: id };
    } else if (kind === 'person') {
      to = '/people/$personId';
      params = { personId: id };
    } else if (kind === 'tenant') {
      to = '/tenants/$tenantId';
      params = { tenantId: id };
    } else if (kind === 'land') {
      to = '/lands/$landId';
      params = { landId: id };
    } else if (kind === 'unit') {
      // Unit preview: need propertyId to build canonical /properties/:propertyId/units/:unitId
      // Resolve via Supabase lookup (read-only, RLS-protected)
      void (async () => {
        try {
          const { data } = await supabase
            .from('units')
            .select('property_id')
            .eq('id', id)
            .maybeSingle();
          const propertyId = (data as { property_id?: string } | null)?.property_id;
          if (propertyId) {
            void (navigate as unknown as (opts: unknown) => void)({
              to: '/properties/$propertyId/units/$unitId',
              params: { propertyId, unitId: id },
              replace: true,
              search: (prev: Record<string, unknown>) => {
                const next = { ...prev };
                delete next.previewKind;
                delete next.previewId;
                return next;
              },
            });
          } else {
            // Fallback: unit not found or no property link → keep bookmark but clean query
            void (navigate as unknown as (opts: unknown) => void)({
              to: '/properties',
              replace: true,
              search: (prev: Record<string, unknown>) => {
                const next = { ...prev };
                delete next.previewKind;
                delete next.previewId;
                return next;
              },
            });
          }
        } catch {
          void (navigate as unknown as (opts: unknown) => void)({
            to: '/properties',
            replace: true,
            search: (prev: Record<string, unknown>) => {
              const next = { ...prev };
              delete next.previewKind;
              delete next.previewId;
              return next;
            },
          });
        }
      })();
      return;
    }

    if (!to) return;

    void (navigate as unknown as (opts: unknown) => void)({
      to,
      params,
      replace: true,
      // Clean up legacy search params
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev };
        delete next.previewKind;
        delete next.previewId;
        return next;
      },
    });
  }, [search, navigate]);

  return null;
}
