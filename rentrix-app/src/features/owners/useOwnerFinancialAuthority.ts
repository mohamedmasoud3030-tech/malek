import { useQuery } from '@tanstack/react-query';
import { getOwnerFinancialAuthority } from './services/owner-financial-service';

export const ownerFinancialAuthorityKeys = {
  all: ['owner-financial-authority'] as const,
  period: (ownerId: string, from: string, to: string) => [...ownerFinancialAuthorityKeys.all, ownerId, from, to] as const,
};

export function useOwnerFinancialAuthority(ownerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ownerFinancialAuthorityKeys.period(ownerId, from, to),
    queryFn: () => getOwnerFinancialAuthority(ownerId, from, to),
    enabled: Boolean(ownerId && from && to && from <= to),
  });
}
