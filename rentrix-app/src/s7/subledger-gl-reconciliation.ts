export type SubledgerRecord = Readonly<{
  sourceType: string;
  sourceId: string;
  expectedDebitMinor: number;
  expectedCreditMinor: number;
}>;

export type GlPostingRecord = Readonly<{
  sourceType: string;
  sourceId: string;
  eventId: string;
  debitMinor: number;
  creditMinor: number;
}>;

export type SourceReconciliationStatus =
  | 'matched'
  | 'missing_gl_posting'
  | 'duplicate_gl_posting'
  | 'amount_mismatch'
  | 'unbalanced_gl_posting';

export type SourceReconciliationRow = Readonly<{
  sourceType: string;
  sourceId: string;
  status: SourceReconciliationStatus;
  expectedDebitMinor: number;
  expectedCreditMinor: number;
  actualDebitMinor: number;
  actualCreditMinor: number;
  debitDifferenceMinor: number;
  creditDifferenceMinor: number;
  eventIds: readonly string[];
}>;

export type SubledgerGlReconciliation = Readonly<{
  matchedCount: number;
  exceptionCount: number;
  rows: readonly SourceReconciliationRow[];
}>;

function key(sourceType: string, sourceId: string): string {
  return `${sourceType}\u0000${sourceId}`;
}

function assertRecord(
  record: Readonly<{ sourceType: string; sourceId: string; debitMinor?: number; creditMinor?: number; expectedDebitMinor?: number; expectedCreditMinor?: number }>,
): void {
  if (record.sourceType.trim() === '' || record.sourceId.trim() === '') {
    throw new Error('sourceType and sourceId must not be empty');
  }
  for (const value of [
    record.debitMinor,
    record.creditMinor,
    record.expectedDebitMinor,
    record.expectedCreditMinor,
  ]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error('amounts must be non-negative safe integers in minor units');
    }
  }
}

export function reconcileSubledgerToGl(
  subledger: readonly SubledgerRecord[],
  postings: readonly GlPostingRecord[],
): SubledgerGlReconciliation {
  const expectedBySource = new Map<string, SubledgerRecord>();
  for (const record of subledger) {
    assertRecord(record);
    const sourceKey = key(record.sourceType, record.sourceId);
    if (expectedBySource.has(sourceKey)) {
      throw new Error(`duplicate subledger source: ${record.sourceType}/${record.sourceId}`);
    }
    expectedBySource.set(sourceKey, record);
  }

  const postingsBySource = new Map<string, GlPostingRecord[]>();
  const seenEvents = new Set<string>();
  for (const posting of postings) {
    assertRecord(posting);
    if (posting.eventId.trim() === '') throw new Error('eventId must not be empty');
    if (seenEvents.has(posting.eventId)) throw new Error(`duplicate eventId: ${posting.eventId}`);
    seenEvents.add(posting.eventId);
    const sourceKey = key(posting.sourceType, posting.sourceId);
    const group = postingsBySource.get(sourceKey) ?? [];
    group.push(posting);
    postingsBySource.set(sourceKey, group);
  }

  const rows: SourceReconciliationRow[] = [];
  for (const expected of expectedBySource.values()) {
    const group = postingsBySource.get(key(expected.sourceType, expected.sourceId)) ?? [];
    const actualDebitMinor = group.reduce((sum, item) => sum + item.debitMinor, 0);
    const actualCreditMinor = group.reduce((sum, item) => sum + item.creditMinor, 0);
    const debitDifferenceMinor = actualDebitMinor - expected.expectedDebitMinor;
    const creditDifferenceMinor = actualCreditMinor - expected.expectedCreditMinor;

    let status: SourceReconciliationStatus;
    if (group.length === 0) status = 'missing_gl_posting';
    else if (group.length > 1) status = 'duplicate_gl_posting';
    else if (actualDebitMinor !== actualCreditMinor) status = 'unbalanced_gl_posting';
    else if (debitDifferenceMinor !== 0 || creditDifferenceMinor !== 0) status = 'amount_mismatch';
    else status = 'matched';

    rows.push({
      sourceType: expected.sourceType,
      sourceId: expected.sourceId,
      status,
      expectedDebitMinor: expected.expectedDebitMinor,
      expectedCreditMinor: expected.expectedCreditMinor,
      actualDebitMinor,
      actualCreditMinor,
      debitDifferenceMinor,
      creditDifferenceMinor,
      eventIds: group.map((item) => item.eventId).sort(),
    });
  }

  rows.sort((a, b) =>
    a.sourceType === b.sourceType
      ? a.sourceId.localeCompare(b.sourceId)
      : a.sourceType.localeCompare(b.sourceType),
  );

  const matchedCount = rows.filter((row) => row.status === 'matched').length;
  return { matchedCount, exceptionCount: rows.length - matchedCount, rows };
}
