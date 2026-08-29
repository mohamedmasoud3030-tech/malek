import { describe, expect, it } from 'vitest';
import { normalizeDailyCollectionSeries, EMPTY_DAILY_COLLECTION_SERIES } from './daily-collection-series';

describe('normalizeDailyCollectionSeries', () => {
  it('returns the empty series for absent or malformed payloads', () => {
    expect(normalizeDailyCollectionSeries(undefined)).toEqual(EMPTY_DAILY_COLLECTION_SERIES);
    expect(normalizeDailyCollectionSeries({})).toEqual(EMPTY_DAILY_COLLECTION_SERIES);
    expect(normalizeDailyCollectionSeries({ rows: 'nope' })).toEqual(EMPTY_DAILY_COLLECTION_SERIES);
  });

  it('keeps the server rows ordered by date and coerces totals safely', () => {
    const series = normalizeDailyCollectionSeries({
      rows: [
        { date: '2026-08-05', total: '12.500' },
        { date: '2026-08-01', total: 4 },
        { date: '2026-08-03', total: null },
        { total: 99 }, // dateless row is dropped, never guessed
      ],
      total: '16.500',
    });

    expect(series.total).toBe(16.5);
    expect(series.rows.map((row) => row.date)).toEqual(['2026-08-01', '2026-08-03', '2026-08-05']);
    expect(series.rows[1].total).toBe(0);
  });

  it('never fabricates points when the period has no collections', () => {
    const series = normalizeDailyCollectionSeries({ rows: [], total: 0 });
    expect(series.rows).toEqual([]);
    expect(series.total).toBe(0);
  });
});
