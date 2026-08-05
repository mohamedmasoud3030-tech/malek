import type { ReactNode } from 'react';
import './dashboard-v2.css';

/**
 * Dashboard-owned Visual Contract V2 scope (ADR 0012, Phase 2).
 *
 * The enforceable selector is `[data-visual-contract='v2']` and it must live
 * on a real Dashboard DOM node. The shared PageLayout does not forward
 * arbitrary props, so the attribute cannot ride on it; this wrapper is the
 * single Dashboard-owned scope node. Non-Dashboard routes never render it,
 * which keeps V2 tokens contained to the Dashboard proof and leaves every
 * other surface on its existing visual contract.
 *
 * Rollback/containment: removing this wrapper reverts the proof; nothing
 * outside the Dashboard subtree depends on it.
 */
export function DashboardVisualScope({ children }: { children: ReactNode }) {
  return <div data-visual-contract="v2">{children}</div>;
}
