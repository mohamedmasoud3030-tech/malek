import { z } from 'zod';
import { normalizeOm3 } from './money';

/** PostgreSQL report numeric/bigint transport values, not permissive user input.
 * Missing or malformed evidence is an error, never a fabricated zero balance. */
export const reportNumberSchema = z.union([
  z.number(), z.string().trim().regex(/^[+-]?\d+(?:\.\d+)?$/),
]).transform(Number).pipe(z.number().finite());
export const reportMoneySchema = reportNumberSchema.transform(normalizeOm3);
export const reportCountSchema = reportNumberSchema.pipe(z.number().int().nonnegative());
