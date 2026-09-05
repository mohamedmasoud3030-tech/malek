import type { SemanticTone } from '@/components/ui/status-badge';

export type CanonicalMaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
export type CanonicalMaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

/** Canonical maintenance lifecycle vocabulary — one label/tone per status for lists, dossiers, and reports. */
export const maintenanceStatusLabels: Record<CanonicalMaintenanceStatus, string> = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم التنفيذ',
  closed: 'مغلق',
  cancelled: 'ملغى',
};

export const maintenanceStatusTone: Record<CanonicalMaintenanceStatus, SemanticTone> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
  cancelled: 'neutral',
};

export const maintenancePriorityLabels: Record<CanonicalMaintenancePriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
};

export const maintenancePriorityTone: Record<CanonicalMaintenancePriority, SemanticTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

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
    case 'closed': return 'closed';
    // R8: Cancelled ≠ Closed — called-off work is never presented as done.
    case 'cancelled': return 'cancelled';
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
