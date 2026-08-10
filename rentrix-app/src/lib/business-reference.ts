type BusinessReferenceRecord = Readonly<Record<string, unknown>>;

const referenceFields = [
  'reference',
  'contract_number',
  'invoice_number',
  'receipt_number',
  'reference_no',
  'reference_number',
  'bill_number',
  'plot_no',
] as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns only a stored business reference; internal IDs are never a fallback. */
export function getBusinessReference(record: BusinessReferenceRecord | null | undefined): string | null {
  if (!record) return null;
  for (const field of referenceFields) {
    const value = record[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && !uuidPattern.test(trimmed)) return trimmed;
  }
  return null;
}

export function businessReferenceOrLabel(record: BusinessReferenceRecord | null | undefined, label: string): string {
  return getBusinessReference(record) ?? label;
}
