import { useQuery } from '@tanstack/react-query';
import { getContractPaymentsSnapshot } from './services/contractPaymentService';

const contractPaymentKeys = {
  all: ['contract-payments'] as const,
  detail: (contractId: string) =>
    [...contractPaymentKeys.all, contractId] as const,
};

export function useContractPayments(contractId: string) {
  return useQuery({
    queryKey: contractPaymentKeys.detail(contractId),
    queryFn: () => getContractPaymentsSnapshot(contractId),
    enabled: Boolean(contractId),
  });
}
