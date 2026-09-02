import { lazy } from 'react';
import type { ReportAdapterProps } from './report-adapter-contract';

const StatementsSection = lazy(() =>
  import('../../components/StatementsSection').then((m) => ({ default: m.StatementsSection })),
);

/**
 * Statements stay on their authoritative shared loaders. The premium catalog
 * only chooses which party-facing portion is visible; it never introduces a
 * second statement query or calculation path.
 */
export function StatementsReportsAdapter({ model, filters, statementFocus }: ReportAdapterProps) {
  return <StatementsSection {...model.sections.statements} filters={filters} focus={statementFocus} />;
}
