import { useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { openEntityPreview } from '@/components/ui/entity-preview-events';

export function ContractDetailRouteComponent() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const contractId = params.contractId;

  useEffect(() => {
    if (!contractId) return;
    openEntityPreview({ kind: 'contract', id: contractId });
    void navigate({ to: '/contracts', replace: true });
  }, [contractId, navigate]);

  return null;
}
