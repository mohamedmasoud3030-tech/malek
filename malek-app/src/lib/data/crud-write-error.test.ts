import { describe, expect, it } from 'vitest';
import { getCrudWriteErrorMessage } from './crud-write-error';

describe('getCrudWriteErrorMessage', () => {
  it('keeps permission failures actionable without exposing backend wording', () => {
    const message = getCrudWriteErrorMessage({
      action: 'update',
      entityPlural: 'العقارات',
      error: new Error('permission denied for table properties'),
    });

    expect(message).toBe('تعذر تحديث العقارات: لا تملك صلاحية تنفيذ هذا الإجراء. تواصل مع المسؤول إذا كنت تحتاج هذه الصلاحية.');
    expect(message).not.toContain('permission denied');
    expect(message).not.toContain('properties');
  });

  it('maps duplicate database failures to a safe operator explanation', () => {
    const message = getCrudWriteErrorMessage({
      action: 'archive',
      entityPlural: 'الوحدات',
      error: new Error('duplicate key value violates unique constraint units_number_key'),
    });

    expect(message).toBe('تعذر أرشفة الوحدات: توجد بيانات مماثلة مسجلة بالفعل. راجع البيانات ثم أعد المحاولة.');
    expect(message).not.toContain('duplicate key');
    expect(message).not.toContain('unique constraint');
  });

  it('does not echo unknown raw backend failures', () => {
    const message = getCrudWriteErrorMessage({
      action: 'create',
      entityPlural: 'العقارات',
      error: new Error('RPC_FAILED internal_schema.fn_create_property request_id=abc'),
    });

    expect(message).toBe('تعذر إنشاء العقارات. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.');
    expect(message).not.toContain('RPC_FAILED');
    expect(message).not.toContain('internal_schema');
    expect(message).not.toContain('request_id');
  });
});
