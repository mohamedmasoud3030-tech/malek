/**
 * Shared application service for owner workspace dossier context.
 *
 * Reuses the real audit log as the owner activity source — no synthetic
 * activity feed is introduced. Mirrors the property-workspace-service seam so
 * presentation components never import cross-feature services directly.
 */
import { fetchAuditLog } from '@/features/audit/services/audit-log-service';
import type { AuditLogRecord } from '@/features/audit/types';

export interface OwnerActivityRecord {
  id: string;
  action: string;
  description?: string | null;
  occurredAt: string;
}

/**
 * The audit log stores entity as the table name (or a legacy singular variant).
 * An entity dossier must receive ONLY records belonging to that exact entity:
 * the entity id is the hard requirement, and the entity type merely validates
 * that the row is an owner record (supporting the legacy singular variant).
 */
export function isOwnerAuditRecord(record: AuditLogRecord, ownerId: string): boolean {
  return (
    record.entityId === ownerId
    && (record.entityType === 'owners' || record.entityType === 'owner')
  );
}

export async function fetchOwnerActivity(ownerId: string): Promise<OwnerActivityRecord[]> {
  const result = await fetchAuditLog();
  if (result.status !== 'available') return [];
  const records = result.records.filter((record: AuditLogRecord) => isOwnerAuditRecord(record, ownerId));
  return records.map((record) => ({
    id: record.id,
    action: record.action,
    description: record.description,
    occurredAt: record.occurredAt,
  }));
}
