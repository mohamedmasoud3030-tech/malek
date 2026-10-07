import { describe, expect, it, vi } from 'vitest';
import { updateCurrentUserPassword, type PasswordUpdateClient } from './change-password-service';
import { validateChangePasswordForm } from './change-password-page';

describe('change password governance flow', () => {
  it('validates password length and confirmation', () => {
    expect(validateChangePasswordForm({ password: 'short', confirmPassword: 'short' })).toContain('8');
    expect(validateChangePasswordForm({ password: 'long-enough', confirmPassword: 'different' })).toContain('غير مطابق');
    expect(validateChangePasswordForm({ password: 'long-enough', confirmPassword: 'long-enough' })).toBeNull();
  });

  it('reports success when Supabase updates the current user password', async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    const client: PasswordUpdateClient = { auth: { updateUser } };

    await expect(updateCurrentUserPassword(client, 'long-enough')).resolves.toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: 'long-enough' });
  });

  it('reports failure when Supabase rejects the password update', async () => {
    const error = new Error('session expired');
    const client: PasswordUpdateClient = { auth: { updateUser: vi.fn(async () => ({ error })) } };

    await expect(updateCurrentUserPassword(client, 'long-enough')).resolves.toEqual({ ok: false, error });
  });

  it('reports failure when Supabase throws during the password update', async () => {
    const error = new Error('network unavailable');
    const client: PasswordUpdateClient = { auth: { updateUser: vi.fn(() => Promise.reject(error)) } };

    await expect(updateCurrentUserPassword(client, 'long-enough')).resolves.toEqual({ ok: false, error });
  });
});
