import { z } from 'zod';

export const trimmedShort = (max: number) =>
  z
    .string()
    .max(max, `القيمة طويلة جداً (الحد الأقصى ${max} حرفاً)`)
    .transform((value) => value.trim());

export const optionalTrimmedShort = (max: number) =>
  trimmedShort(max).transform((value) => (value === '' ? null : value));
