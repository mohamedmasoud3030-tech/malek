import { z } from 'zod';

/** Phone values accepted by owner and communication forms and payload schemas. */
export const PHONE_PATTERN = /^[+\d][\d\s-]{6,19}$/;

/** Optional form phone: trim input, allow blank, and normalize blank to null. */
export function optionalPhoneFormField() {
  return z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || PHONE_PATTERN.test(value), {
      message: 'رقم الهاتف غير صحيح',
    })
    .transform((value) => (value === '' ? null : value));
}
