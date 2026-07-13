import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import type { Owner, PropertyOwner, PropertyOwnerUpdatePayload, PropertyWithOwners } from './ownerService';

export type OwnerFormValues = {
  full_name: string;
  display_name: string;
  phone: string;
  email: string;
  national_id: string;
  tax_number: string;
  address: string;
  notes: string;
  is_active: boolean;
};

export type PropertyOwnershipLinkFormValues = {
  property_id: string;
  ownership_percentage: string;
  is_primary: boolean;
  starts_on: string;
  ends_on: string;
};

export const emptyPropertyOwnershipLinkFormValues: PropertyOwnershipLinkFormValues = {
  property_id: '',
  ownership_percentage: '100',
  is_primary: true,
  starts_on: '',
  ends_on: '',
};

export function validatePropertyOwnershipLinkForm(values: PropertyOwnershipLinkFormValues): string | null {
  if (!values.property_id) {
    return 'اختر العقار أولاً';
  }

  if (values.starts_on && values.ends_on && values.ends_on < values.starts_on) {
    return 'تاريخ نهاية الملكية يجب ألا يسبق تاريخ البداية';
  }

  return null;
}

type PropertyOwnerFormFields = Pick<PropertyOwner, 'property_id' | 'ownership_percentage' | 'is_primary' | 'starts_on' | 'ends_on'>;

export function propertyOwnerLinkToFormValues(link: PropertyOwnerFormFields): PropertyOwnershipLinkFormValues {
  return {
    property_id: link.property_id,
    ownership_percentage: String(link.ownership_percentage),
    is_primary: link.is_primary,
    starts_on: link.starts_on ?? '',
    ends_on: link.ends_on ?? '',
  };
}

export function propertyOwnershipLinkFormToPayload(values: PropertyOwnershipLinkFormValues): PropertyOwnerUpdatePayload {
  return {
    ownership_percentage: Number(values.ownership_percentage),
    is_primary: values.is_primary,
    starts_on: values.starts_on,
    ends_on: values.ends_on,
  };
}

export type OwnerSummary = {
  totalOwners: number;
  activeOwners: number;
  linkedPropertiesCount: number;
  propertiesWithoutLinkedOwner: number;
};

export const emptyOwnerFormValues: OwnerFormValues = {
  full_name: '',
  display_name: '',
  phone: '',
  email: '',
  national_id: '',
  tax_number: '',
  address: '',
  notes: '',
  is_active: true,
};

export function ownerToFormValues(owner: Owner | null): OwnerFormValues {
  if (!owner) {
    return emptyOwnerFormValues;
  }

  return {
    full_name: owner.full_name,
    display_name: owner.display_name ?? '',
    phone: owner.phone ?? '',
    email: owner.email ?? '',
    national_id: owner.national_id ?? '',
    tax_number: owner.tax_number ?? '',
    address: owner.address ?? '',
    notes: owner.notes ?? '',
    is_active: owner.is_active,
  };
}

export function validateOwnerForm(values: OwnerFormValues): string | null {
  return Object.values(validateOwnerFormFields(values)).find(Boolean) ?? null;
}

export function validateOwnerFormFields(values: OwnerFormValues): Partial<Record<keyof OwnerFormValues, string>> {
  const errors: Partial<Record<keyof OwnerFormValues, string>> = {};

  if (!values.full_name.trim()) {
    errors.full_name = 'اسم المالك مطلوب';
  }

  if (values.email.trim() && !values.email.includes('@')) {
    errors.email = 'البريد الإلكتروني غير صالح';
  }

  if (values.phone.trim() && !/^[+\d][\d\s-]{6,19}$/.test(values.phone.trim())) {
    errors.phone = 'رقم الهاتف غير صحيح';
  }

  if (values.national_id.trim() && !/^[A-Za-z0-9\-/]{4,32}$/.test(values.national_id.trim())) {
    errors.national_id = 'رقم الهوية غير صحيح';
  }

  return errors;
}

export function getOwnerDisplayLabel(owner: Pick<Owner, 'full_name' | 'display_name'>): string {
  return owner.display_name?.trim() || owner.full_name;
}

/**
 * A dated ownership link stays active through its end date.  Treating every
 * non-null end date as already ended made scheduled handovers disappear early.
 */
export function isActivePropertyOwnerLink(
  link: Pick<PropertyOwner, 'ends_on'>,
  asOf = getTodayLocalDateString(),
): boolean {
  return !link.ends_on || link.ends_on >= asOf;
}

function getActivePropertyOwnerLinks(property: Pick<PropertyWithOwners, 'property_owners'>): PropertyOwner[] {
  return property.property_owners.filter((link) => isActivePropertyOwnerLink(link));
}

export function summarizeOwners(owners: Owner[], properties: PropertyWithOwners[]): OwnerSummary {
  const linkedPropertyIds = new Set<string>();

  for (const property of properties) {
    if (getActivePropertyOwnerLinks(property).length > 0) {
      linkedPropertyIds.add(property.id);
    }
  }

  return {
    totalOwners: owners.length,
    activeOwners: owners.filter((owner) => owner.is_active).length,
    linkedPropertiesCount: linkedPropertyIds.size,
    propertiesWithoutLinkedOwner: properties.filter((property) => getActivePropertyOwnerLinks(property).length === 0).length,
  };
}

export function countLinkedPropertiesForOwner(ownerId: string, properties: PropertyWithOwners[]): number {
  return properties.filter((property) => getActivePropertyOwnerLinks(property).some((link) => link.owner_id === ownerId)).length;
}

export type OwnerWorkspaceProperty = {
  id: string;
  title: string;
  ownershipPercentage: number;
  isPrimary: boolean;
};

export type OwnerWorkspaceRow = {
  owner: Owner;
  properties: OwnerWorkspaceProperty[];
  propertyCount: number;
  activeContractCount: number;
  propertyNames: string;
  ownershipSummary: string;
};

type ActivePropertyContract = Readonly<{
  id: string;
  property_id: string;
}>;

function getCodePointOffset(value: string, baseCodePoint: number): number {
  return (value.codePointAt(0) ?? baseCodePoint) - baseCodePoint;
}

function normalizeOwnerSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replaceAll(/[أإآ]/g, 'ا')
    .replaceAll('ى', 'ي')
    .replaceAll(/[٠-٩]/g, (digit) => String(getCodePointOffset(digit, 0x0660)))
    .replaceAll(/[۰-۹]/g, (digit) => String(getCodePointOffset(digit, 0x06f0)));
}

function formatOwnershipRole(isPrimary: boolean): string {
  return isPrimary ? 'أساسي' : 'شريك';
}

function formatOwnershipLink(link: Pick<PropertyOwner, 'ownership_percentage' | 'is_primary'>): string {
  return `${link.ownership_percentage}% ${formatOwnershipRole(link.is_primary)}`;
}

function getOwnerWorkspaceSearchText(row: OwnerWorkspaceRow): string {
  return normalizeOwnerSearchText([
    row.owner.full_name,
    row.owner.display_name,
    row.owner.phone,
    row.owner.email,
    row.propertyNames,
  ].filter((value): value is string => Boolean(value)).join(' '));
}

function getActiveContractCount(propertyIds: Set<string>, activeContracts: ActivePropertyContract[]): number {
  return activeContracts.filter((contract) => propertyIds.has(contract.property_id)).length;
}

function buildWorkspaceProperties(ownerId: string, properties: PropertyWithOwners[]): OwnerWorkspaceProperty[] {
  return properties.flatMap((property) => getActivePropertyOwnerLinks(property)
    .filter((link) => link.owner_id === ownerId)
    .map((link) => ({
      id: property.id,
      title: property.title,
      ownershipPercentage: link.ownership_percentage,
      isPrimary: link.is_primary,
    })));
}

export function buildOwnerWorkspaceRows(owners: Owner[], properties: PropertyWithOwners[], activeContracts: ActivePropertyContract[]): OwnerWorkspaceRow[] {
  return owners.map((owner) => {
    const ownerProperties = buildWorkspaceProperties(owner.id, properties);
    const propertyIds = new Set(ownerProperties.map((property) => property.id));
    return {
      owner,
      properties: ownerProperties,
      propertyCount: propertyIds.size,
      activeContractCount: getActiveContractCount(propertyIds, activeContracts),
      propertyNames: ownerProperties.map((property) => property.title).join('، '),
      ownershipSummary: ownerProperties.map((property) => `${property.title}: ${property.ownershipPercentage}% ${formatOwnershipRole(property.isPrimary)}`).join('، '),
    };
  });
}

export function filterOwnerWorkspaceRows(rows: OwnerWorkspaceRow[], search: string): OwnerWorkspaceRow[] {
  const normalizedSearch = normalizeOwnerSearchText(search.trim());
  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((row) => getOwnerWorkspaceSearchText(row).includes(normalizedSearch));
}

export function getOwnerPropertyOwnershipLabel(property: OwnerWorkspaceProperty): string {
  return `${property.title} · ${formatOwnershipLink({ ownership_percentage: property.ownershipPercentage, is_primary: property.isPrimary })}`;
}
