import { useParams } from '@tanstack/react-router';
import { ContractDetailPage } from '@/features/contracts/pages/ContractDetailPage';

/**
 * Contract dossiers are heavyweight workspaces (financials, documents, lifecycle).
 * Always render the canonical full page, even when navigation carries a background
 * location from a list/dashboard. Lightweight invoice/receipt previews may still
 * use dialogs elsewhere.
 */
export function ContractDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const contractId = params.contractId ?? '';

  if (!contractId) return null;

  return <ContractDetailPage />;
}
