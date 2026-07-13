import type { ContractDetail } from '../services/contractService';
import type { RenewalPayload } from '../contractSchema';

const toDateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return date; };
const addYear = (date: Date) => { const nextDate = new Date(date); nextDate.setFullYear(nextDate.getFullYear() + 1); nextDate.setDate(nextDate.getDate() - 1); return nextDate; };

export const canRenewContract = (contract: ContractDetail) => contract.status === 'active' || contract.status === 'expired';
export const canTerminateContract = (contract: ContractDetail) => contract.status === 'active' || contract.status === 'draft';
export const getRenewalDefaults = (contract: ContractDetail): RenewalPayload => {
  const nextStart = addDays(contract.end_date, 1);
  return { new_start: toDateInputValue(nextStart), new_end: toDateInputValue(addYear(nextStart)), new_amount: contract.rent_amount, agreement_id: contract.agreement_id };
};
