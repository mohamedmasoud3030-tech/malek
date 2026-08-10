import { useNavigate } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { OperationsHubWorkspace } from '@/features/operations-hub/operations-hub-workspace';
import { ServiceProviderFormDialog } from '@/features/service-providers/components/service-provider-form-dialog';
import { ServiceProvidersWorkspace } from '@/features/service-providers/service-providers-page';

export function ServiceProviderNewRouteComponent() {
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const close = () => {
    if (background) window.history.back();
    else void navigate({ to: '/service-providers' });
  };
  const backgroundContent = background?.pathname === '/maintenance'
    ? <OperationsHubWorkspace defaultSection="service_providers" mode="standalone" />
    : <ServiceProvidersWorkspace />;

  return (
    <>
      {backgroundContent}
      <ServiceProviderFormDialog open provider={null} onOpenChange={(open) => { if (!open) close(); }} />
    </>
  );
}
