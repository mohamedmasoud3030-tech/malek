import type { ReactNode } from 'react';
import './dashboard-layout.css';

/**
 * Dashboard layout scope.
 *
 * The wrapper exists only to scope dashboard-specific geometry. Visual theme,
 * palette, shadows and radii are inherited from the single global token system.
 */
export function DashboardVisualScope({ children }: { children: ReactNode }) {
  return <div data-visual-contract="v2">{children}</div>;
}
