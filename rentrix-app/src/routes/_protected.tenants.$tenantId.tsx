import { useParams } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { ContextualBackground } from '@/app/router/contextual-background';
import { TenantsWorkspace } from '@/features/tenants/TenantsPage';
import { TenantDetailPage, TenantPreviewDialog } from '@/features/tenants/components/TenantPreviewDialog';

export function TenantDetailRouteComponent() {
  const { tenantId = '' } = useParams({ strict: false }) as { tenantId?: string };
  const background = useBackgroundLocation();
  const isDialog = background !== null;
  if (!tenantId) return null;
  if (!isDialog) return <TenantDetailPage tenantId={tenantId} />;
  return <><ContextualBackground location={background} fallback={<TenantsWorkspace embedded />} /><TenantPreviewDialog tenantId={tenantId} open onOpenChange={(open) => { if (!open) window.history.back(); }} /></>;
}
