import { QueryClient } from '@tanstack/react-query';

const MAX_QUERY_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 8_000;
const NON_RETRYABLE_CODES = new Set(['401', '403', '404', '42501', 'PGRST116', 'PGRST301', 'PGRST302']);

function readErrorCandidate(error: unknown) {
  if (typeof error !== 'object' || error === null) return null;
  return error as { code?: unknown; status?: unknown; message?: unknown; name?: unknown };
}

/**
 * Retry only failures that may recover without changing the request. Query
 * retries are reads, but repeatedly sending deterministic auth, validation, or
 * integrity failures still adds load and delays an actionable UI state.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;

  const candidate = readErrorCandidate(error);
  const name = candidate && typeof candidate.name === 'string' ? candidate.name : '';
  if (name === 'AbortError') return false;
  if (!candidate) return true;

  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
  const numericStatus = typeof candidate.status === 'number'
    ? candidate.status
    : typeof candidate.status === 'string'
      ? Number(candidate.status)
      : Number.NaN;

  if (NON_RETRYABLE_CODES.has(code)) return false;
  // PostgreSQL data/constraint and syntax/access-rule classes are deterministic.
  if (/^(22|23|42)[0-9A-Z]{3}$/u.test(code)) return false;
  if (Number.isFinite(numericStatus) && numericStatus >= 400 && numericStatus < 500 && numericStatus !== 408 && numericStatus !== 429) return false;

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  if (
    message.includes('permission denied')
    || message.includes('row-level security')
    || (message.includes('jwt') && (message.includes('expired') || message.includes('invalid')))
  ) return false;

  return true;
}

/** Exponential, bounded delay; exported so reliability behavior stays testable. */
export function getQueryRetryDelay(attemptIndex: number): number {
  const safeAttempt = Number.isFinite(attemptIndex) ? Math.max(0, Math.floor(attemptIndex)) : 0;
  return Math.min(1_000 * (2 ** safeAttempt), MAX_RETRY_DELAY_MS);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: shouldRetryQuery,
        retryDelay: getQueryRetryDelay,
        // Pause reads while offline instead of consuming retries immediately,
        // then reconcile server state once connectivity returns.
        networkMode: 'online',
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      // Mutations are never retried in the browser. Financial/server actions
      // have their own explicit idempotency contracts where replay is allowed.
      mutations: {
        // Run once immediately even when the browser reports offline so a
        // failed write reaches its error UI now; never queue an operator action
        // for surprising execution after connectivity returns.
        networkMode: 'always',
        retry: 0,
      },
    },
  });
}

export const queryClient = createQueryClient();
