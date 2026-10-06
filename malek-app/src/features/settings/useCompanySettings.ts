import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { companySettingsRecordToContract } from './companySettingsContractAdapter';
import { getCompanySettings, updateCompanySettings, type CompanySettingsUpdatePayload } from './companySettingsService';

export const companySettingsKeys = {
  all: ['company-settings'] as const,
  detail: () => [...companySettingsKeys.all, 'detail'] as const,
};

export function useCompanySettings() {
  return useQuery({ queryKey: companySettingsKeys.detail(), queryFn: getCompanySettings });
}

export { companySettingsRecordToContract } from './companySettingsContractAdapter';

export function useCompanySettingsContract(): CompanySettingsContract {
  const companySettingsQuery = useCompanySettings();

  return useMemo(() => companySettingsRecordToContract(companySettingsQuery.data), [companySettingsQuery.data]);
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CompanySettingsUpdatePayload) => updateCompanySettings(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: companySettingsKeys.all });
    },
  });
}
