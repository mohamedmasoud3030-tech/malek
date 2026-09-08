import { expect, it, vi } from 'vitest';
import { RetryableCommandStore } from './retryable-command';

it('coalesces double submission and retains identity after a lost response', async () => {
  const store = new RetryableCommandStore(() => 'stable');
  const send = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValue('ack');
  const first = store.run('refund', { amount: 25, id: 'd' }, send);
  const concurrent = store.run('refund', { id: 'd', amount: 25 }, send);
  expect(concurrent).toBe(first);
  await expect(first).rejects.toThrow('response lost');
  expect(await store.run('refund', { id: 'd', amount: 25 }, send)).toBe('ack');
  expect(send.mock.calls.map(([id]) => id)).toEqual(['stable', 'stable']);
});

it('separates operations, payloads and new confirmed intents', async () => {
  let sequence = 0;
  const store = new RetryableCommandStore(() => String(++sequence));
  const send = vi.fn(async (id: string) => id);
  expect(await store.run('refund', { amount: 5 }, send)).toBe('1');
  expect(await store.run('refund', { amount: 5 }, send)).toBe('2');
  expect(await store.run('refund', { amount: 6 }, send)).toBe('3');
  expect(await store.run('apply', { amount: 6 }, send)).toBe('4');
});
