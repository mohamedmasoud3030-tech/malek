import { Navigate } from '@tanstack/react-router';

/**
 * The marketing landing implementation remains in `features/landing`, but it is
 * intentionally disconnected from the live app until its performance is fixed.
 * Visiting `/` now enters the lightweight authentication flow instead.
 */
export function LandingRouteComponent() {
  return <Navigate to="/login" replace />;
}
