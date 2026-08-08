import { useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { openEntityPreview } from '@/components/ui/entity-preview-events';

export function PropertyUnitDetailRouteComponent() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const unitId = params.unitId;

  useEffect(() => {
    if (!unitId) return;
    openEntityPreview({ kind: 'unit', id: unitId });
    void navigate({
      to: '/properties',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'units' }),
      replace: true,
    });
  }, [navigate, unitId]);

  return null;
}
