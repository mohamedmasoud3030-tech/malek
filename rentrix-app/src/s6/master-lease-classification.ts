export type MasterLeaseClassificationInput = Readonly<{
  leaseTermMonths: number;
  purchaseOptionReasonablyCertain: boolean;
  lowValueExemptionElected: boolean;
  shortTermExemptionElected: boolean;
}>;

export type MasterLeaseClassification = Readonly<{
  recognitionRequired: boolean;
  exemption: 'none' | 'short_term' | 'low_value';
  reason: string;
}>;

export function classifyMasterLease(input: MasterLeaseClassificationInput): MasterLeaseClassification {
  if (!Number.isInteger(input.leaseTermMonths) || input.leaseTermMonths <= 0) {
    throw new Error('leaseTermMonths must be a positive integer');
  }

  if (input.lowValueExemptionElected) {
    return {
      recognitionRequired: false,
      exemption: 'low_value',
      reason: 'low-value exemption elected',
    };
  }

  const shortTermEligible = input.leaseTermMonths <= 12 && !input.purchaseOptionReasonablyCertain;
  if (input.shortTermExemptionElected && shortTermEligible) {
    return {
      recognitionRequired: false,
      exemption: 'short_term',
      reason: 'short-term exemption elected for an eligible lease',
    };
  }

  return {
    recognitionRequired: true,
    exemption: 'none',
    reason: input.shortTermExemptionElected && !shortTermEligible
      ? 'short-term exemption is not available for this lease'
      : 'ROU asset and lease liability recognition required',
  };
}
