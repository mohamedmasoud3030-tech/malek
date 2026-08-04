/**
 * UX-049: Commission source lookup service.
 *
 * This service wraps cross-feature data-fetching so the presentation
 * components inside the commissions feature never import services from
 * other feature directories directly, satisfying the architecture boundary
 * check while keeping the selector typed and permission-aware.
 */
import { listAllContracts } from '@/features/contracts/services/contractService';
import { listLeads } from '@/features/leads/services/leads-service';
import { listLands } from '@/features/lands/services/lands-service';
import { listPeople } from '@/features/people/people-service';

export interface SourceOption {
  id: string;
  label: string;
}

export async function fetchCommissionSources(type: string): Promise<SourceOption[]> {
  switch (type) {
    case 'contract':
      return fetchContractSources();
    case 'owner':
      return fetchOwnerSources();
    case 'lead':
      return fetchLeadSources();
    case 'land':
      return fetchLandSources();
    default:
      return [];
  }
}

async function fetchContractSources(): Promise<SourceOption[]> {
  const result = await listAllContracts('all');
  return result.rows.map((c) => ({
    id: c.id,
    label: c.properties?.title
      ? `عقد ${c.properties.title} — ${c.people?.full_name ?? '—'} (${c.start_date} → ${c.end_date})`
      : `عقد #${c.id.slice(0, 8)}`,
  }));
}

async function fetchOwnerSources(): Promise<SourceOption[]> {
  const result = await listPeople({ search: '', type: 'owner', page: 1, pageSize: 200 });
  return (result.rows ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? `مالك #${p.id.slice(0, 8)}`,
  }));
}

async function fetchLeadSources(): Promise<SourceOption[]> {
  const leads = await listLeads({ query: '', status: 'all', source: 'all' });
  return leads.map((l) => ({
    id: l.id,
    label: l.name ?? `عميل محتمل #${l.id.slice(0, 8)}`,
  }));
}

async function fetchLandSources(): Promise<SourceOption[]> {
  const lands = await listLands({ query: '', status: 'all' });
  return lands.map((l) => ({
    id: l.id,
    label: l.name ?? l.plot_no ?? `أرض #${l.id.slice(0, 8)}`,
  }));
}
