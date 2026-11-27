import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { roundMoney } from './money';

// Real PostgreSQL numeric is the oracle, not a second JS rounding formula.
describe('money rounding agrees with PostgreSQL', () => {
  it('matches positive and negative decimal ties across operating amounts', async () => {
    const db = await PGlite.create();
    try {
      const amounts = [0.0005, 1.0005, 1.2345, 10.2345, 1234.5675,
        10000.0005, 99999.9995, 1000000.0005];
      for (const amount of amounts.flatMap(value => [value, -value])) {
        const result = await db.query<{ rounded: string }>(
          'select round($1::numeric, 3)::text as rounded', [String(amount)]);
        expect(roundMoney(amount), String(amount)).toBe(Number(result.rows[0].rounded));
      }
      for (const amount of [1.005, 10.075, 1234.565, -1.005, -10.075, -1234.565]) {
        const result = await db.query<{ rounded: string }>(
          'select round($1::numeric, 2)::text as rounded', [String(amount)]);
        expect(roundMoney(amount, 'AED'), String(amount)).toBe(Number(result.rows[0].rounded));
      }
    } finally { await db.close(); }
  });

  it('handles scientific notation, very large numbers and zero safely', () => {
    expect(roundMoney(5e-4)).toBe(0.001);
    expect(roundMoney(-5e-4)).toBe(-0.001);
    expect(roundMoney(1e-7)).toBe(0);
    expect(Object.is(roundMoney(-1e-7), -0)).toBe(false);
    expect(roundMoney(1e21)).toBe(1e21);
    expect(roundMoney(1e308)).toBe(1e308);
    expect(roundMoney(-1e308)).toBe(-1e308);
  });
});
