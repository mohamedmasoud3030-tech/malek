import type { Contract } from '@/types/domain';

/**
 * A contract row enriched with the display relations the deposits workspace
 * needs to show a human-readable option instead of a raw UUID. The UUID stays
 * the internal value; these joined fields exist purely for labeling.
 */
export type DepositContractOption = Pick<Contract, 'id' | 'tenant_id' | 'property_id' | 'unit_id'> & {
  people: { id: string; full_name: string | null } | null;
  properties: { id: string; title: string | null } | null;
  units: { id: string; unit_number: string | null } | null;
};

export const MISSING_TENANT_LABEL = 'مستأجر غير محدد';
export const MISSING_UNIT_LABEL = 'وحدة غير محددة';
export const MISSING_PROPERTY_LABEL = 'عقار غير محدد';

function tenantName(contract: DepositContractOption): string {
  const name = contract.people?.full_name?.trim();
  return name && name.length > 0 ? name : MISSING_TENANT_LABEL;
}

function unitLabel(contract: DepositContractOption): string {
  const unitNumber = contract.units?.unit_number?.trim();
  return unitNumber && unitNumber.length > 0 ? `الوحدة ${unitNumber}` : MISSING_UNIT_LABEL;
}

function propertyLabel(contract: DepositContractOption): string {
  const title = contract.properties?.title?.trim();
  return title && title.length > 0 ? title : MISSING_PROPERTY_LABEL;
}

/**
 * Human-readable label for a contract option, e.g.
 * "محمد أحمد — الوحدة 12 — عقار النور". The contract UUID is intentionally
 * never part of the label; missing relations degrade to Arabic fallbacks
 * instead of leaking raw identifiers.
 */
export function formatContractOptionLabel(contract: DepositContractOption): string {
  return [tenantName(contract), unitLabel(contract), propertyLabel(contract)].join(' — ');
}

/** Single-line confirmation summary shown after the user picks a contract. */
export function describeSelectedContract(contract: DepositContractOption): string {
  return `المستأجر: ${tenantName(contract)} · ${unitLabel(contract)} · العقار: ${propertyLabel(contract)}`;
}

/**
 * Readable reference for an existing deposit (list + printed clearance
 * document). Falls back to Arabic placeholders — never a raw tenant_id,
 * property_id, or unit_id UUID.
 */
export function formatDepositContractReference(fields: {
  tenant_name?: string | null;
  property_title?: string | null;
  unit_number?: string | null;
}): string {
  const tenant = fields.tenant_name?.trim() || MISSING_TENANT_LABEL;
  const unit = fields.unit_number?.trim() ? `الوحدة ${fields.unit_number.trim()}` : MISSING_UNIT_LABEL;
  const property = fields.property_title?.trim() || MISSING_PROPERTY_LABEL;
  return `${tenant} — ${unit} — ${property}`;
}
