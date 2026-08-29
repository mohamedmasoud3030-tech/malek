import { describe, expect, it } from 'vitest';
import { createQueryClient, getQueryRetryDelay, shouldRetryQuery } from './query-client';

describe('query retry policy', () => {
  it('does not repeat deterministic authorization or missing-row failures', () => {
    expect(shouldRetryQuery(0, { code: '42501', message: 'permission denied' })).toBe(false);
    expect(shouldRetryQuery(0, { code: 'PGRST116', message: 'no rows' })).toBe(false);
    expect(shouldRetryQuery(0, { status: 403 })).toBe(false);
    expect(shouldRetryQuery(0, { status: '404' })).toBe(false);
    expect(shouldRetryQuery(0, { message: 'row-level security policy rejected the read' })).toBe(false);
  });

  it('does not retry deterministic database shape, validation, or integrity failures', () => {
    expect(shouldRetryQuery(0, { code: '22P02' })).toBe(false);
    expect(shouldRetryQuery(0, { code: '23505' })).toBe(false);
    expect(shouldRetryQuery(0, { code: '42P01' })).toBe(false);
    expect(shouldRetryQuery(0, { code: 'PGRST302' })).toBe(false);
  });

  it('allows bounded retries for network/server/transient throttle failures', () => {
    expect(shouldRetryQuery(0, new TypeError('fetch failed'))).toBe(true);
    expect(shouldRetryQuery(1, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(1, { status: 429 })).toBe(true);
    expect(shouldRetryQuery(2, { status: 503 })).toBe(false);
  });

  it('does not retry deliberately aborted requests from any error implementation', () => {
    expect(shouldRetryQuery(0, new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(shouldRetryQuery(0, { name: 'AbortError', message: 'cancelled' })).toBe(false);
  });

  it('uses bounded exponential backoff', () => {
    expect([0, 1, 2, 3, 4, 20].map(getQueryRetryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
    expect(getQueryRetryDelay(Number.NaN)).toBe(1_000);
  });

  it('pauses reads offline but never queues or retries mutations for reconnect replay', () => {
    const client = createQueryClient();
    const queryOptions = client.getDefaultOptions().queries;
    const mutationOptions = client.getDefaultOptions().mutations;

    expect(queryOptions?.networkMode).toBe('online');
    expect(queryOptions?.refetchOnReconnect).toBe(true);
    expect(mutationOptions?.networkMode).toBe('always');
    expect(mutationOptions?.retry).toBe(0);
  });
});
