import { useParams } from '@tanstack/react-router';
import { TenantDetailPage } from '@/features/tenants/components/TenantPreviewDialog';

/** Tenant dossiers carry contracts, arrears, activity, and documents: full page only. */
export function TenantDetailRouteComponent() {
  const { tenantId = '' } = useParams({ strict: false }) as { tenantId?: string };

  if (!tenantId) return null;

  return <TenantDetailPage tenantId={tenantId} />;
}
