export type CanonicalMaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type CanonicalMaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Reads remain compatible with historic maintenance rows written before the
 * canonical lowercase constraint. Shared so list filters, reports, and the
 * maintenance workspace use one lifecycle vocabulary.
 */
export function normalizeMaintenanceStatus(status: unknown): CanonicalMaintenanceStatus {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'in_progress': return 'in_progress';
    case 'resolved':
    case 'completed': return 'resolved';
    case 'closed':
    case 'cancelled': return 'closed';
    case 'open':
    case 'new':
    case 'reported':
    case 'assigned':
    default: return 'open';
  }
}

export function normalizeMaintenancePriority(priority: unknown): CanonicalMaintenancePriority {
  switch (String(priority ?? '').trim().toLowerCase()) {
    case 'low': return 'low';
    case 'high': return 'high';
    case 'urgent': return 'urgent';
    case 'medium':
    case 'normal':
    default: return 'medium';
  }
}

export function getMaintenanceStatusVariants(status: CanonicalMaintenanceStatus): string[] {
  return [status, status.toUpperCase()];
}
