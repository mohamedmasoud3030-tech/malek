import { describe, expect, it, vi } from 'vitest';
import { appPermissions } from './permissions';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));

const { getEffectiveAuthorizationContextFromSession } = await import('./effective-permissions');

const accessTokenWithRole = (role: string) => [
  'header',
  Buffer.from(JSON.stringify({ app_metadata: { user_role: role } })).toString('base64url'),
  'signature',
].join('.');

describe('ADMIN effective permissions', () => {
  it('uses the signed ADMIN role without depending on the effective-permission RPC', async () => {
    rpc.mockRejectedValueOnce(new Error('projection unavailable'));
    const context = await getEffectiveAuthorizationContextFromSession({
      user: { id: 'admin-1', email: 'admin@example.com', app_metadata: {} },
      access_token: accessTokenWithRole('ADMIN'),
    } as never);

    expect(rpc).not.toHaveBeenCalled();
    expect(context?.role).toBe('ADMIN');
    expect(context?.effectivePermissionsResolved).toBe(true);
    expect(context?.grantedPermissions).toEqual(appPermissions);
  });
});
