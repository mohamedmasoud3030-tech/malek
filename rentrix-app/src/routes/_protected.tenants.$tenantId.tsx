import { useParams } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { TenantsWorkspace } from '@/features/tenants/TenantsPage';
import { TenantDetailPage, TenantPreviewDialog } from '@/features/tenants/components/TenantPreviewDialog';

export function TenantDetailRouteComponent() {
  const { tenantId = '' } = useParams({ strict: false }) as { tenantId?: string };
  const isDialog = useBackgroundLocation() !== null;
  if (!tenantId) return null;
  if (!isDialog) return <TenantDetailPage tenantId={tenantId} />;
  return <><TenantsWorkspace embedded /><TenantPreviewDialog tenantId={tenantId} open onOpenChange={(open) => { if (!open) window.history.back(); }} /></>;
}
