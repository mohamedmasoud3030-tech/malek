import { useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { openEntityPreview } from '@/components/ui/entity-preview-events';

export function OwnerDetailRouteComponent() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const ownerId = params.ownerId;

  useEffect(() => {
    if (!ownerId) return;
    openEntityPreview({ kind: 'owner', id: ownerId });
    void navigate({ to: '/owners', replace: true });
  }, [navigate, ownerId]);

  return null;
}
