import { useQuery } from '@tanstack/react-query';
import { listOwnerOptions } from '@/services/owner-options';

export const ownerOptionQueryKey = ['shared-owner-options'] as const;

export function useOwnerOptions(options?: Readonly<{ enabled?: boolean }>) {
  return useQuery({
    queryKey: ownerOptionQueryKey,
    queryFn: listOwnerOptions,
    enabled: options?.enabled ?? true,
  });
}
