import { QueryClient } from '@tanstack/react-query';

const NON_RETRYABLE_CODES = new Set(['401','403','404','42501','PGRST116','PGRST301']);

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (typeof error !== 'object' || error === null) return true;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
  const status = typeof candidate.status === 'number' ? candidate.status : Number.NaN;
  if (NON_RETRYABLE_CODES.has(code)) return false;
  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  if (message.includes('permission denied') || (message.includes('jwt') && message.includes('expired'))) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
