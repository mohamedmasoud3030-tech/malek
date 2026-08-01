/**
 * Shared action center counts service.
 * Provides server-authoritative counts for the dashboard action center without
 * coupling dashboard presentation components to cross-feature internal services.
 */
import { listOwnerSettlements } from '@/features/owners/services/owner-settlements-service';
import { runDataIntegrityAudit } from '@/features/system/services/data-integrity-service';

export async function fetchPendingSettlementsCount(): Promise<number> {
  const settlements = await listOwnerSettlements();
  return settlements.filter(
    (s) => String(s.status).toLowerCase() === 'draft' || String(s.status).toLowerCase() === 'approved',
  ).length;
}

export async function fetchIntegrityWarningsCount(): Promise<number> {
  const audit = await runDataIntegrityAudit();
  if (audit.status !== 'available') return 0;
  return audit.snapshot.checks.filter((c) => c.count > 0).length;
}
