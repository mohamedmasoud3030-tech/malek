import { describe, expect, it, vi } from 'vitest';
import { buildPasswordRecoveryRedirect, requestPasswordRecovery } from './password-recovery-service';

describe('password recovery service', () => {
  it('uses a dedicated reset route on the current application origin', () => {
    expect(buildPasswordRecoveryRedirect('https://app.example.com/base')).toBe('https://app.example.com/reset-password');
  });

  it('requests a time-limited provider email without exposing account lookup logic in the browser', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { resetPasswordForEmail } } as any;

    await expect(requestPasswordRecovery(client, 'user@example.com', 'https://app.example.com/reset-password')).resolves.toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', { redirectTo: 'https://app.example.com/reset-password' });
  });

  it('returns provider failures for the page to translate into a neutral retry message', async () => {
    const providerError = new Error('rate limited');
    const client = { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: providerError }) } } as any;

    await expect(requestPasswordRecovery(client, 'user@example.com', 'https://app.example.com/reset-password')).resolves.toEqual({ ok: false, error: providerError });
  });
});
