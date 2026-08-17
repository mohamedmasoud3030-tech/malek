import { describe, expect, it } from 'vitest';
import { shouldRetryQuery } from './query-client';

describe('query retry policy', () => {
  it('does not repeat deterministic authorization or missing-row failures', () => {
    expect(shouldRetryQuery(0, { code: '42501', message: 'permission denied' })).toBe(false);
    expect(shouldRetryQuery(0, { code: 'PGRST116', message: 'no rows' })).toBe(false);
    expect(shouldRetryQuery(0, { status: 403 })).toBe(false);
  });

  it('allows bounded retries for network/server/transient throttle failures', () => {
    expect(shouldRetryQuery(0, new TypeError('fetch failed'))).toBe(true);
    expect(shouldRetryQuery(1, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(1, { status: 429 })).toBe(true);
    expect(shouldRetryQuery(2, { status: 503 })).toBe(false);
  });

  it('does not retry deliberately aborted requests', () => {
    expect(shouldRetryQuery(0, new DOMException('aborted', 'AbortError'))).toBe(false);
  });
});
