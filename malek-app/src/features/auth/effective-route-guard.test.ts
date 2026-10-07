import { describe, expect, it, vi } from 'vitest';

const effectiveContext = vi.fn();
vi.mock('./effective-permissions', () => ({
  getEffectiveAuthorizationContextFromSession: effectiveContext,
}));

const { assertSessionPermission } = await import('./route-guards');

describe('effective permission route guard', () => {
  it('accepts an approved grant using the same authorization context as navigation', async () => {
    effectiveContext.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      grantedPermissions: ['lands.view'],
    });
    await expect(assertSessionPermission({ user: {} } as never, 'lands.view')).resolves.toBeUndefined();
  });

  it('fails closed when neither role nor approved grants authorize the route', async () => {
    effectiveContext.mockResolvedValueOnce({ userId: 'user-1', email: null, role: 'USER', grantedPermissions: [] });
    await expect(assertSessionPermission({ user: {} } as never, 'lands.view')).rejects.toBeDefined();
  });
});
