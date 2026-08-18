import { translateSharedLabel } from '@/lib/i18n';
import { LoadingState } from '@/components/ui/loading-state';

/**
 * Route-level loading skeleton.
 *
 * Thin alias over the shared `LoadingState` `route` variant so existing route
 * components keep a stable import path. The canonical implementation lives in
 * `components/ui/loading-state.tsx`; this file exists only to preserve the
 * historical `RouteLoadingState` name and its Arabic accessible label.
 */
export function RouteLoadingState() {
  return <LoadingState variant="route" label={translateSharedLabel('routeLoadingAria')} />;
}
