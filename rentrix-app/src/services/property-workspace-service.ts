/**
 * Shared application service for property workspace 360-degree tabs.
 * Provides filtered queries across contracts, invoices, maintenance, and audit log
 * without violating feature dependency boundaries or presentation import rules.
 */
import { listContracts } from '@/features/contracts/services/contractService';
import { listInvoices, type InvoiceListItem } from '@/features/financials/invoices/invoiceService';
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
  const result = await listContracts({ status: 'all', page: 1, pageSize: 50 });
  return (result.rows ?? []).filter((contract) => contract.property_id === propertyId);
}

export async function fetchPropertyInvoices(propertyId: string) {
  // Property-scoped: only invoices whose contract belongs to this property.
  // Previously the filter only checked `contract_id != null`, which leaked
  // invoices from other properties into this property's financial context.
  const propertyContracts = await fetchPropertyContracts(propertyId);
  const propertyContractIds = new Set(propertyContracts.map((contract) => contract.id));
  const result = await listInvoices({ search: '', status: 'all' });
  return (result ?? []).filter(
    (invoice: InvoiceListItem) => invoice.contract_id != null && propertyContractIds.has(invoice.contract_id),
  );
}

export async function fetchPropertyMaintenance(propertyId: string) {
  return listMaintenance('all', propertyId);
}

export async function fetchPropertyActivity(propertyId: string): Promise<PropertyActivityRecord[]> {
  const result = await fetchAuditLog();
  if (result.status !== 'available') return [];
  const records = result.records.filter(
    (record: AuditLogRecord) => record.entityId === propertyId || record.entityType === 'properties',
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
    canWriteContract: canAccess(authorization, 'contracts.write'),
    canWriteMaintenance: canAccess(authorization, 'maintenance.view'),
  };
}
