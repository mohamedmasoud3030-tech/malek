import type { LeaseRemeasurementResult } from './master-lease-remeasurement';
import type { PostingIntentLine } from './master-lease-posting-intents';

export type MasterLeaseRemeasurementAccounts = Readonly<{
  rouAsset: string;
  leaseLiability: string;
  terminationGain: string;
  terminationLoss: string;
}>;

export type RemeasurementPostingIntent = Readonly<{
  sourceType: 'master_lease_remeasurement';
  sourceId: string;
  eventId: string;
  period: number;
  lines: readonly PostingIntentLine[];
}>;

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must not be empty`);
}

function addSignedLine(
  lines: PostingIntentLine[],
  accountCode: string,
  amountMinor: number,
  positiveSide: 'debit' | 'credit',
): void {
  if (amountMinor === 0) return;
  const positive = amountMinor > 0;
  const debit = (positive && positiveSide === 'debit') || (!positive && positiveSide === 'credit');
  lines.push({
    accountCode,
    debitMinor: debit ? Math.abs(amountMinor) : 0,
    creditMinor: debit ? 0 : Math.abs(amountMinor),
  });
}

export function buildMasterLeaseRemeasurementPostingIntent(input: Readonly<{
  leaseId: string;
  effectivePeriod: number;
  result: LeaseRemeasurementResult;
  accounts: MasterLeaseRemeasurementAccounts;
}>): RemeasurementPostingIntent {
  assertNonEmpty(input.leaseId, 'leaseId');
  if (!Number.isInteger(input.effectivePeriod) || input.effectivePeriod <= 0) {
    throw new Error('effectivePeriod must be a positive integer');
  }
  for (const [key, value] of Object.entries(input.accounts)) {
    assertNonEmpty(value, `accounts.${key}`);
  }

  const lines: PostingIntentLine[] = [];
  addSignedLine(lines, input.accounts.rouAsset, input.result.rouAdjustmentMinor, 'debit');
  addSignedLine(lines, input.accounts.leaseLiability, input.result.liabilityDeltaMinor, 'credit');

  if (input.result.terminationGainLossMinor > 0) {
    lines.push({
      accountCode: input.accounts.terminationGain,
      debitMinor: 0,
      creditMinor: input.result.terminationGainLossMinor,
    });
  } else if (input.result.terminationGainLossMinor < 0) {
    lines.push({
      accountCode: input.accounts.terminationLoss,
      debitMinor: Math.abs(input.result.terminationGainLossMinor),
      creditMinor: 0,
    });
  }

  const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0);
  const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0);
  if (debit !== credit) {
    throw new Error(`remeasurement posting intent is not balanced: debit=${debit}, credit=${credit}`);
  }

  return {
    sourceType: 'master_lease_remeasurement',
    sourceId: input.leaseId,
    eventId: input.result.eventId,
    period: input.effectivePeriod,
    lines,
  };
}
