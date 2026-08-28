/**
 * Shared application service for property workspace 360-degree tabs.
 * Provides filtered queries across contracts, invoices, maintenance, and audit log
 * without violating feature dependency boundaries or presentation import rules.
 */
import { listContractsForProperty } from '@/features/contracts/services/contractService';
import { listInvoicesForProperty } from '@/features/financials/invoices/invoiceService';
import { listMaintenance } from '@/features/maintenance/maintenance-service';
import { fetchAuditLog } from '@/features/audit/services/audit-log-service';
import type { AuditLogRecord } from '@/features/audit/types';
import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';

export interface PropertyActivityRecord {
  id: string;
  action: string;
  description?: string | null;
  occurredAt: string;
}

export async function fetchPropertyContracts(propertyId: string) {
  return listContractsForProperty(propertyId);
}

export async function fetchPropertyInvoices(propertyId: string) {
  return listInvoicesForProperty(propertyId);
}

export async function fetchPropertyMaintenance(propertyId: string) {
  return listMaintenance('all', propertyId);
}

export async function fetchPropertyActivity(propertyId: string): Promise<PropertyActivityRecord[]> {
  const result = await fetchAuditLog();
  if (result.status !== 'available') return [];
  // Property-scoped: only records whose entity id is this exact property (with
  // the entity type validated as a property record, supporting the legacy
  // singular variant). Records of other properties never leak into the dossier.
  const records = result.records.filter(
    (record: AuditLogRecord) =>
      record.entityId === propertyId
      && (record.entityType === 'properties' || record.entityType === 'property'),
  );
  return records.map((r) => ({
    id: r.id,
    action: r.action,
    description: r.description,
    occurredAt: r.occurredAt,
  }));
}

export function checkPropertyTabPermissions(authorization: AuthorizationContext | null | undefined) {
  return {
    canWriteContract: canAccess(authorization, 'contracts.create'),
    canWriteMaintenance: canAccess(authorization, 'maintenance.create'),
  };
}
