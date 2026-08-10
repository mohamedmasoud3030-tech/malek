import { useNavigate, useParams } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { OperationsHubWorkspace } from '@/features/operations-hub/operations-hub-workspace';
import { ServiceProviderFormDialog } from '@/features/service-providers/components/service-provider-form-dialog';
import { ServiceProviderDetailPage } from '@/features/service-providers/service-provider-detail-page';
import { ServiceProvidersWorkspace } from '@/features/service-providers/service-providers-page';
import { useServiceProvider } from '@/features/service-providers/use-service-providers';

export function ServiceProviderEditRouteComponent() {
  const { providerId } = useParams({ strict: false }) as { providerId?: string };
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const providerQuery = useServiceProvider(providerId ?? '');
  const close = () => {
    if (background) window.history.back();
    else if (providerId) void navigate({ to: '/service-providers/$providerId', params: { providerId } });
    else void navigate({ to: '/service-providers' });
  };

  let backgroundContent = <ServiceProvidersWorkspace />;
  if (background?.pathname === '/maintenance') backgroundContent = <OperationsHubWorkspace defaultSection="service_providers" mode="standalone" />;
  else if (background?.pathname.startsWith('/service-providers/') && providerId) backgroundContent = <ServiceProviderDetailPage />;

  return (
    <>
      {backgroundContent}
      <ServiceProviderFormDialog
        open
        provider={providerQuery.data ?? null}
        isProviderLoading={providerQuery.isLoading}
        onOpenChange={(open) => { if (!open) close(); }}
      />
    </>
  );
}
