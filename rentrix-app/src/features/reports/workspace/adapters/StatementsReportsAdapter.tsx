import { lazy } from 'react';
import type { ReportAdapterProps } from './report-adapter-contract';

const StatementsSection = lazy(() =>
  import('../../components/StatementsSection').then((m) => ({ default: m.StatementsSection })),
);

/**
 * WP-C adapter — statements section.
 *
 * Tenant/owner statements, the office operating movement, the GL-backed cash
 * flow (1111/1120) and VAT are all read from their authoritative services
 * through the workspace model. The adapter only forwards the active scope so
 * the section can resolve which statement party the user selected.
 */
export function StatementsReportsAdapter({ model, filters }: ReportAdapterProps) {
  return <StatementsSection {...model.sections.statements} filters={filters} />;
}
