import { describe, expect, it } from 'vitest';
import { getLoginErrorMessage } from './login-error-message';

describe('getLoginErrorMessage', () => {
  it('maps invalid credentials to a safe Arabic message', () => {
    expect(getLoginErrorMessage(new Error('Invalid login credentials')))
      .toBe('تعذر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور ثم حاول مرة أخرى.');
  });

  it('does not expose an unknown provider error', () => {
    const result = getLoginErrorMessage(new Error('unexpected backend failure: SQLSTATE 42501'));
    expect(result).toBe('تعذر تسجيل الدخول حاليًا. حاول مرة أخرى.');
    expect(result).not.toContain('SQLSTATE');
  });
});
