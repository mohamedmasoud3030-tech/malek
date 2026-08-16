/**
 * Shared action center counts service.
 *
 * R1 — Dashboard Truth: settlement and bank counts now come from the
 * authoritative dashboard read model (rpt_dashboard_snapshot.exceptions).
 * Only the data-integrity audit count remains here: it is a diagnostics
 * feature with its own service boundary, not an operational/financial KPI.
 */
import { runDataIntegrityAudit } from '@/features/system/services/data-integrity-service';

export async function fetchIntegrityWarningsCount(): Promise<number> {
  const audit = await runDataIntegrityAudit();
  if (audit.status !== 'available') {
    // Honest partial data (#1474 contract): an unavailable audit must surface
    // as a failed source («غير متاح»), never as a fake zero warning count.
    throw new Error(audit.reason);
  }
  return audit.snapshot.checks.filter((c) => c.count > 0).length;
}
