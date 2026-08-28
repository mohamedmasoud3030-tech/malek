/**
 * Tenant Portal v1 read-only projection contract.
 *
 * Every field is a projection of canonical company/tenant-scoped data. The
 * portal is never an accounting authority and never writes office records.
 */

export type TenantPortalIdentity = Readonly<{
  fullName: string;
  phone?: string | null;
  email?: string | null;
}>;

export type TenantPortalUnit = Readonly<{
  title: string;
  unitNumber: string;
  status: string;
}>;

export type TenantPortalContract = Readonly<{
  reference: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  currency: string;
}>;

export type TenantPortalDueScheduleItem = Readonly<{
  label: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'overdue';
}>;

export type TenantPortalPaidPosition = Readonly<{
  invoiced: number;
  paid: number;
  remaining: number;
  overdue: number;
  currency: string;
}>;

export type TenantPortalServiceItem = Readonly<{
  label: string;
  period?: string | null;
  status: string;
}>;

export type TenantPortalReceipt = Readonly<{
  reference: string;
  date: string;
  amount: number;
  currency: string;
  status: 'posted' | 'void';
}>;

export type TenantPortalDocument = Readonly<{
  title: string;
  type: string;
  createdAt: string;
  reference?: string | null;
}>;

export type TenantPortalMaintenanceRecord = Readonly<{
  label: string;
  status: string;
  createdAt: string;
}>;

export type TenantPortalSnapshot = Readonly<{
  tenantId: string;
  companyId: string;
  asOf: string;
  identity: TenantPortalIdentity;
  unit: TenantPortalUnit | null;
  contract: TenantPortalContract | null;
  dueSchedule: readonly TenantPortalDueScheduleItem[];
  paidPosition: TenantPortalPaidPosition | null;
  services: readonly TenantPortalServiceItem[];
  receipts: readonly TenantPortalReceipt[];
  documents: readonly TenantPortalDocument[];
  maintenance: readonly TenantPortalMaintenanceRecord[];
}>;

/** Section ids the v1 portal may render — no office module may be added. */
export const TENANT_PORTAL_V1_SECTIONS = [
  'identity',
  'unit_contract',
  'due_schedule',
  'position',
  'services',
  'receipts',
  'documents',
  'maintenance',
] as const;

export type TenantPortalSectionId = (typeof TENANT_PORTAL_V1_SECTIONS)[number];

export function isTenantPortalSectionId(value: string): value is TenantPortalSectionId {
  return (TENANT_PORTAL_V1_SECTIONS as readonly string[]).includes(value);
}

export type TenantPortalLoadResult =
  | Readonly<{ status: 'ready'; snapshot: TenantPortalSnapshot }>
  | Readonly<{
      status: 'invalid';
      reason: 'TENANT_PORTAL_LINK_REQUIRED' | 'TENANT_PORTAL_LINK_INVALID_OR_EXPIRED';
    }>;
