import { describe, expect, it } from 'vitest';
import { readAccessTokenAppMetadata } from './access-token-claims';

function token(claims: unknown): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${payload}.signature`;
}

describe('readAccessTokenAppMetadata', () => {
  it('decodes app metadata once for independent role and company consumers', () => {
    expect(readAccessTokenAppMetadata(token({ app_metadata: { user_role: 'ADMIN', company_id: 'company-1' } })))
      .toEqual({ user_role: 'ADMIN', company_id: 'company-1' });
  });

  it('fails closed for missing tokens, malformed payloads, and invalid metadata shapes', () => {
    expect(readAccessTokenAppMetadata(null)).toBeNull();
    expect(readAccessTokenAppMetadata('not-a-jwt')).toBeNull();
    expect(readAccessTokenAppMetadata('header.%%%.signature')).toBeNull();
    expect(readAccessTokenAppMetadata(token({ app_metadata: [] }))).toBeNull();
    expect(readAccessTokenAppMetadata(token({ app_metadata: null }))).toBeNull();
  });
});
