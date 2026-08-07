import { describe, expect, it } from 'vitest';
import {
  getActionableSupabaseErrorMessage,
  handleSupabaseError,
} from './supabase-error';

describe('getActionableSupabaseErrorMessage', () => {
  it('preserves a precise Arabic business error from a trusted RPC', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'مبلغ الاسترداد يجب أن يكون أكبر من صفر', code: '22023' },
      'تعذر رد مبلغ التأمين',
    )).toBe('مبلغ الاسترداد يجب أن يكون أكبر من صفر');
  });

  it('replaces generic Arabic placeholders with the operation-specific fallback', () => {
    expect(getActionableSupabaseErrorMessage(
      new Error('خطأ'),
      'تعذر تسجيل الدفعة',
    )).toBe('تعذر تسجيل الدفعة');

    expect(getActionableSupabaseErrorMessage(
      { message: 'حدث خطأ غير متوقع' },
      'تعذر حفظ العمولة',
    )).toBe('تعذر حفظ العمولة');
  });

  it('turns missing company context into operator guidance', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'Company context is required (no company_id claim in JWT).', code: '42501' },
      'تعذر تسجيل الدفعة',
    )).toBe('تعذر تسجيل الدفعة: تعذر التحقق من الشركة الحالية. حدّث الصفحة، وإن استمرت المشكلة سجّل الدخول من جديد.');
  });

  it('turns permission/RLS failures into a non-technical Arabic message', () => {
    const message = getActionableSupabaseErrorMessage(
      { message: 'new row violates row-level security policy', code: '42501' },
      'تعذر حفظ العمولة',
    );

    expect(message).toBe('تعذر حفظ العمولة: حسابك لا يملك الصلاحية المطلوبة لهذه العملية. تأكد من الحساب الحالي ثم حاول مرة أخرى.');
    expect(message).not.toMatch(/RLS|row-level|42501/i);
  });

  it('explains expired sessions without leaking JWT internals', () => {
    const message = getActionableSupabaseErrorMessage(
      { message: 'JWT expired', code: 'PGRST301' },
      'تعذر تسجيل الدفعة',
    );

    expect(message).toBe('تعذر تسجيل الدفعة: انتهت الجلسة أو تعذر التحقق منها. سجّل الدخول من جديد ثم أعد المحاولة.');
    expect(message).not.toMatch(/JWT|PGRST/i);
  });

  it('explains network failures', () => {
    expect(getActionableSupabaseErrorMessage(
      new TypeError('Failed to fetch'),
      'تعذر تسجيل المصروف',
    )).toBe('تعذر تسجيل المصروف: تعذر الاتصال بالخدمة. تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.');
  });

  it('explains a missing RPC/schema-cache deployment mismatch', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'Could not find the function public.foo in the schema cache', code: 'PGRST202' },
      'تعذر تنفيذ العملية',
    )).toBe('تعذر تنفيذ العملية: الخدمة المطلوبة غير متاحة في النسخة الحالية. حدّث التطبيق ثم أعد المحاولة.');
  });

  it('maps deterministic stale owner-settlement errors', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'OWNER_SETTLEMENT_STALE_TOTALS: source amounts changed after draft creation', code: '22023' },
      'تعذر اعتماد التسوية',
    )).toBe('تغيّرت بيانات التسوية منذ إنشاء المسودة. ألغِ المسودة وأنشئ تسوية جديدة بالقيم الحالية.');
  });

  it('does not expose an unknown English database message', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'duplicate key value violates obscure_internal_index', code: 'XX000' },
      'تعذر إنشاء السجل',
    )).toBe('تعذر إنشاء السجل');
  });

  it('maps common constraint codes to contextual Arabic', () => {
    expect(getActionableSupabaseErrorMessage(
      { message: 'duplicate key value violates unique constraint', code: '23505' },
      'تعذر إنشاء السجل',
    )).toBe('تعذر إنشاء السجل: يوجد سجل مطابق بالفعل. راجع البيانات قبل إنشاء سجل جديد.');
  });
});

describe('handleSupabaseError', () => {
  it('throws an Error carrying the translated message used by mutation hooks', () => {
    expect(() => handleSupabaseError(
      { message: 'permission denied for table payments', code: '42501' },
      'تعذر تسجيل الدفعة',
    )).toThrow('تعذر تسجيل الدفعة: حسابك لا يملك الصلاحية المطلوبة لهذه العملية. تأكد من الحساب الحالي ثم حاول مرة أخرى.');
  });
});
