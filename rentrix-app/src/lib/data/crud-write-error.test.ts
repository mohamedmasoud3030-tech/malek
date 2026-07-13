import { describe, expect, it } from 'vitest';
import { getCrudWriteErrorMessage } from './crud-write-error';

describe('getCrudWriteErrorMessage', () => {
  it('keeps RLS failures actionable and domain-specific', () => {
    expect(getCrudWriteErrorMessage({
      action: 'update',
      entityPlural: 'العقارات',
      error: new Error('permission denied for table properties'),
    })).toBe('تعذر تحديث العقارات: لا تملك صلاحية الكتابة على العقارات. تواصل مع المسؤول أو استخدم حساباً بصلاحيات أعلى.');
  });

  it('preserves a non-permission database error after the Arabic action context', () => {
    expect(getCrudWriteErrorMessage({
      action: 'archive',
      entityPlural: 'الوحدات',
      error: new Error('duplicate key value violates unique constraint'),
    })).toBe('تعذر أرشفة الوحدات: duplicate key value violates unique constraint');
  });
});
