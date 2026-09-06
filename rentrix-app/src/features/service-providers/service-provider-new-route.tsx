import { useNavigate } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { ServiceProviderFormDialog } from '@/features/service-providers/components/service-provider-form-dialog';
import { ServiceProvidersWorkspace } from '@/features/service-providers/service-providers-page';

export function ServiceProviderNewRouteComponent() {
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const close = () => {
    if (background) window.history.back();
    else void navigate({ to: '/service-providers' });
  };

  return (
    <>
      <ServiceProvidersWorkspace />
      <ServiceProviderFormDialog open provider={null} onOpenChange={(open) => { if (!open) close(); }} />
    </>
  );
}
