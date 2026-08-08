import { useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { openEntityPreview } from '@/components/ui/entity-preview-events';

export function PropertyOverviewRouteComponent() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const propertyId = params.propertyId;

  useEffect(() => {
    if (!propertyId) return;
    openEntityPreview({ kind: 'property', id: propertyId });
    void navigate({ to: '/properties', replace: true });
  }, [navigate, propertyId]);

  return null;
}
