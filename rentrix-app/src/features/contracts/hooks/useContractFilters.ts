import { useMemo } from 'react';
import { isContractStatus } from '@/lib/contractStatus';
import { getContractNumber } from '../contractListExport';
import { getContractRemainingDays, parseContractDisplayDate } from '../contractDisplayFormatters';
import type { ContractListItem, ContractStatusFilter } from '../services/contractService';

export type LeaseModeFilter = 'all' | 'long_term' | 'short_stay';

/**
 * Normalize Arabic text **for search/comparison only** — never use for display.
 *
 * Transformations:
 * - Strip diacritics (tashkeel)
 * - Normalize Alef variants (أإآ → ا) and Alef Maqsura (ى → ي)
 * - Normalize Teh Marbuta (ة → ه) so "فاطمة" matches "فاطمه" queries
 * - Collapse whitespace and trim
 * - Normalize Arabic-Indic / Extended Arabic-Indic digits to ASCII
 */
export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Days before `end_date` at which an active contract counts as expiring soon. */
export const CONTRACT_EXPIRING_SOON_DAYS = 30;

/**
 * Expiry only needs the term and the status. Accepting the narrow shape (rather
 * than a whole `ContractListItem`) lets the canonical lifecycle rules reuse
 * this predicate on register rows without duplicating the window.
 */
export type ContractExpirySubject = Pick<ContractListItem, 'end_date' | 'status'>;

export function getDaysUntilEnd(contract: ContractExpirySubject, today: Date = new Date()) {
  return parseContractDisplayDate(contract.end_date) ? getContractRemainingDays(contract.end_date, today) : null;
}

export function isExpiringSoon(contract: ContractExpirySubject, today: Date = new Date()) {
  const days = getDaysUntilEnd(contract, today);
  return isContractStatus(contract.status, 'active') && days !== null && days >= 0 && days <= CONTRACT_EXPIRING_SOON_DAYS;
}

function getSearchText(contract: ContractListItem) {
  return normalizeSearchText(
    [contract.id, getContractNumber(contract), contract.people?.full_name, contract.units?.unit_number, contract.properties?.title]
      .filter(Boolean)
      .join(' '),
  );
}

export function useContractFilters({
  contracts,
  expiringOnly,
  leaseMode,
  searchTerm,
  status,
}: {
  contracts: ContractListItem[] | undefined;
  expiringOnly: boolean;
  leaseMode: LeaseModeFilter;
  searchTerm: string;
  status: ContractStatusFilter;
}) {
  const normalizedSearch = normalizeSearchText(searchTerm);

  const filteredContracts = useMemo(() => {
    const contractList = contracts ?? [];
    return contractList.filter((contract) => {
      const matchesSearch = !normalizedSearch || getSearchText(contract).includes(normalizedSearch);
      const matchesExpiry = !expiringOnly || isExpiringSoon(contract);
      const contractLeaseMode = contract.lease_mode ?? 'long_term';
      const matchesLeaseMode = leaseMode === 'all' || contractLeaseMode === leaseMode;
      const matchesStatus = status === 'all' || isContractStatus(contract.status, status);
      return matchesSearch && matchesExpiry && matchesLeaseMode && matchesStatus;
    });
  }, [contracts, expiringOnly, leaseMode, normalizedSearch, status]);

  const hasContracts = Boolean(contracts?.length);
  const hasActiveFilters = status !== 'all' || leaseMode !== 'all' || Boolean(searchTerm.trim()) || expiringOnly;

  return { filteredContracts, hasActiveFilters, hasContracts };
}
