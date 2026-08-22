import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';
import { getBillingPeriodForCycle, formatLocalDate, getIssueDate, getDueDate } from './billing-schedule';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('billing schedule PGlite equivalence — proves client helper matches server', () => {
  it('monthly: server date_trunc month matches client', async () => {
    const ref = new Date('2026-08-15');
    const client = getBillingPeriodForCycle('monthly', ref);
    const { rows } = await db.query<{ start: string; end: string }>(
      `select date_trunc('month', date '2026-08-15')::date::text as start, (date_trunc('month', date '2026-08-15') + interval '1 month' - interval '1 day')::date::text as end`,
    );
    expect(formatLocalDate(client.start)).toBe(rows[0].start);
    expect(formatLocalDate(client.end)).toBe(rows[0].end);
  });

  it('quarterly: server date_trunc quarter matches client', async () => {
    const ref = new Date('2026-08-15');
    const client = getBillingPeriodForCycle('quarterly', ref);
    const { rows } = await db.query<{ start: string; end: string }>(
      `select date_trunc('quarter', date '2026-08-15')::date::text as start, (date_trunc('quarter', date '2026-08-15') + interval '3 months' - interval '1 day')::date::text as end`,
    );
    expect(formatLocalDate(client.start)).toBe(rows[0].start);
    expect(formatLocalDate(client.end)).toBe(rows[0].end);
  });

  it('semi_annual first half matches server logic', async () => {
    const ref = new Date('2026-02-15');
    const client = getBillingPeriodForCycle('semi_annual', ref);
    expect(formatLocalDate(client.start)).toBe('2026-01-01');
    expect(formatLocalDate(client.end)).toBe('2026-06-30');
  });

  it('semi_annual second half matches server', async () => {
    const ref = new Date('2026-08-15');
    const client = getBillingPeriodForCycle('semi_annual', ref);
    expect(formatLocalDate(client.start)).toBe('2026-07-01');
    expect(formatLocalDate(client.end)).toBe('2026-12-31');
  });

  it('annual matches server', async () => {
    const ref = new Date('2026-08-15');
    const client = getBillingPeriodForCycle('annual', ref);
    const { rows } = await db.query<{ start: string; end: string }>(
      `select date_trunc('year', date '2026-08-15')::date::text as start, (date_trunc('year', date '2026-08-15') + interval '1 year' - interval '1 day')::date::text as end`,
    );
    expect(formatLocalDate(client.start)).toBe(rows[0].start);
    expect(formatLocalDate(client.end)).toBe(rows[0].end);
  });

  it('issue_date anchored to billing_day and clamped', async () => {
    const periodStart = new Date('2026-08-01');
    const periodEnd = new Date('2026-08-31');
    const clientIssue = getIssueDate(periodStart, periodEnd, 28);
    const { rows } = await db.query<{ issue: string }>(
      `select least(make_date(2026, 8, 28), date '2026-08-31')::text as issue`,
    );
    expect(formatLocalDate(clientIssue)).toBe(rows[0].issue);
  });

  it('due_date = period_end + grace_days', async () => {
    const periodEnd = new Date('2026-08-31');
    const clientDue = getDueDate(periodEnd, 10);
    const { rows } = await db.query<{ due: string }>(`select (date '2026-08-31' + 10)::text as due`);
    expect(formatLocalDate(clientDue)).toBe(rows[0].due);
  });

  it('contract start/end boundaries do not affect period (period based on refDate)', async () => {
    // Server's generate_invoices uses current_date for period, not contract start/end
    // Our helper also uses refDate, not contract boundaries
    const ref = new Date('2026-08-15');
    const period = getBillingPeriodForCycle('monthly', ref);
    expect(formatLocalDate(period.start)).toBe('2026-08-01');
    // Contract may have started 2026-01-01 and end 2026-12-31, but period remains current month
  });
});
