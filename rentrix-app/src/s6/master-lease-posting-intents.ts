import type { LeaseSchedule } from './master-lease-schedule';

export type MasterLeaseAccountCodes = Readonly<{
  rouAsset: string;
  leaseLiability: string;
  cashOrBank: string;
  depreciationExpense: string;
  accumulatedRouDepreciation: string;
  leaseInterestExpense: string;
}>;

export type PostingIntentLine = Readonly<{
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
}>;

export type PostingIntent = Readonly<{
  sourceType: 'master_lease_initial_recognition' | 'master_lease_period';
  sourceId: string;
  eventId: string;
  period: number | null;
  lines: readonly PostingIntentLine[];
}>;

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must not be empty`);
}

function assertBalanced(lines: readonly PostingIntentLine[]): void {
  const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0);
  const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0);
  if (debit !== credit) throw new Error(`posting intent is not balanced: debit=${debit}, credit=${credit}`);
}

export function buildMasterLeasePostingIntents(input: Readonly<{
  leaseId: string;
  schedule: LeaseSchedule;
  accounts: MasterLeaseAccountCodes;
}>): readonly PostingIntent[] {
  assertNonEmpty(input.leaseId, 'leaseId');
  for (const [key, value] of Object.entries(input.accounts)) assertNonEmpty(value, `accounts.${key}`);

  const initialLines: PostingIntentLine[] = [
    {
      accountCode: input.accounts.rouAsset,
      debitMinor: input.schedule.initialRouAssetMinor,
      creditMinor: 0,
    },
    {
      accountCode: input.accounts.leaseLiability,
      debitMinor: 0,
      creditMinor: input.schedule.initialLiabilityMinor,
    },
  ];

  const rouDifference = input.schedule.initialRouAssetMinor - input.schedule.initialLiabilityMinor;
  if (rouDifference > 0) {
    initialLines.push({ accountCode: input.accounts.cashOrBank, debitMinor: 0, creditMinor: rouDifference });
  } else if (rouDifference < 0) {
    initialLines.push({ accountCode: input.accounts.cashOrBank, debitMinor: -rouDifference, creditMinor: 0 });
  }
  assertBalanced(initialLines);

  const intents: PostingIntent[] = [
    {
      sourceType: 'master_lease_initial_recognition',
      sourceId: input.leaseId,
      eventId: `master-lease:${input.leaseId}:initial-recognition`,
      period: null,
      lines: initialLines,
    },
  ];

  for (const row of input.schedule.rows) {
    const lines: PostingIntentLine[] = [];

    if (row.interestMinor > 0) {
      lines.push(
        { accountCode: input.accounts.leaseInterestExpense, debitMinor: row.interestMinor, creditMinor: 0 },
        { accountCode: input.accounts.leaseLiability, debitMinor: 0, creditMinor: row.interestMinor },
      );
    }

    if (row.paymentMinor > 0) {
      lines.push(
        { accountCode: input.accounts.leaseLiability, debitMinor: row.paymentMinor, creditMinor: 0 },
        { accountCode: input.accounts.cashOrBank, debitMinor: 0, creditMinor: row.paymentMinor },
      );
    }

    if (row.rouDepreciationMinor > 0) {
      lines.push(
        { accountCode: input.accounts.depreciationExpense, debitMinor: row.rouDepreciationMinor, creditMinor: 0 },
        { accountCode: input.accounts.accumulatedRouDepreciation, debitMinor: 0, creditMinor: row.rouDepreciationMinor },
      );
    }

    assertBalanced(lines);
    intents.push({
      sourceType: 'master_lease_period',
      sourceId: input.leaseId,
      eventId: `master-lease:${input.leaseId}:period:${row.period}`,
      period: row.period,
      lines,
    });
  }

  return intents;
}
