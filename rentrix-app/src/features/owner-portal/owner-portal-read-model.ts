export type OwnerPortalIdentity = Readonly<{
  fullName: string;
  phone?: string | null;
  email?: string | null;
}>;

export type OwnerPortalSummary = Readonly<{
  properties: number;
  units: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  grossCollected: number;
  ownerExpenses: number;
  netPayable: number;
  currency: string;
}>;

export type OwnerPortalProperty = Readonly<{
  id: string;
  title: string;
  address?: string | null;
  ownershipPercentage: number;
  units: number;
  occupiedUnits: number;
  vacantUnits: number;
}>;

export type OwnerPortalUnit = Readonly<{
  id: string;
  propertyId: string;
  propertyTitle: string;
  unitNumber: string;
  status: string;
  referenceRent: number;
  occupied: boolean;
  contractEnd?: string | null;
  currency: string;
}>;

export type OwnerPortalSettlement = Readonly<{
  id: string;
  number: string;
  date?: string | null;
  status: string;
  propertyTitle?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  grossCollected: number;
  officeFee: number;
  ownerExpenses: number;
  taxAmount: number;
  netPayable: number;
  currency: string;
}>;

export type OwnerPortalMaintenance = Readonly<{
  id: string;
  propertyTitle: string;
  unitNumber?: string | null;
  title: string;
  status: string;
  priority?: string | null;
  createdAt: string;
}>;

export type OwnerPortalDocument = Readonly<{
  id: string;
  title: string;
  mime?: string | null;
  scope: 'owner' | 'property' | 'settlement';
  createdAt?: string | null;
}>;

export type OwnerPortalSnapshot = Readonly<{
  ownerId: string;
  companyId: string;
  asOf: string;
  identity: OwnerPortalIdentity;
  summary: OwnerPortalSummary;
  properties: readonly OwnerPortalProperty[];
  units: readonly OwnerPortalUnit[];
  settlements: readonly OwnerPortalSettlement[];
  maintenance: readonly OwnerPortalMaintenance[];
  documents: readonly OwnerPortalDocument[];
  /**
   * The server projection bounds every list to a recent window (50 rows) and
   * reports the full matching row count in these additive keys. The summary
   * figures remain computed over the complete scoped set regardless.
   */
  propertiesTotal?: number;
  unitsTotal?: number;
  settlementsTotal?: number;
  maintenanceTotal?: number;
  documentsTotal?: number;
}>;

/**
 * The portal may only present a list as complete when it really is. When the
 * bounded projection truncated the window, the UI must say so explicitly
 * (same fail-honest doctrine as the paged-read contract).
 */
export function ownerPortalWindowNote(shown: number, total: number | undefined): string | null {
  if (typeof total !== 'number' || total <= shown) return null;
  return `يعرض ${shown} من أصل ${total}`;
}

export type OwnerPortalLoadResult =
  | Readonly<{ status: 'ready'; snapshot: OwnerPortalSnapshot }>
  | Readonly<{
      status: 'invalid';
      reason: 'OWNER_PORTAL_LINK_REQUIRED' | 'OWNER_PORTAL_LINK_INVALID_OR_EXPIRED';
    }>;

export const OWNER_PORTAL_SECTIONS = [
  'summary',
  'portfolio',
  'settlements',
  'maintenance',
  'documents',
] as const;
