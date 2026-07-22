import { useMemo } from 'react';
import { isContractStatus } from '@/lib/contractStatus';
import { getContractNumber } from '../contractListExport';
import { getContractRemainingDays, parseContractDisplayDate } from '../contractDisplayFormatters';
import type { ContractListItem, ContractStatusFilter } from '../services/contractService';

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

export function getDaysUntilEnd(contract: ContractListItem) {
  return parseContractDisplayDate(contract.end_date) ? getContractRemainingDays(contract.end_date) : null;
}

export function isExpiringSoon(contract: ContractListItem) {
  const days = getDaysUntilEnd(contract);
  return isContractStatus(contract.status, 'active') && days !== null && days >= 0 && days <= 30;
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
  searchTerm,
  status,
}: {
  contracts: ContractListItem[] | undefined;
  expiringOnly: boolean;
  searchTerm: string;
  status: ContractStatusFilter;
}) {
  const normalizedSearch = normalizeSearchText(searchTerm);

  const filteredContracts = useMemo(() => {
    const contractList = contracts ?? [];
    return contractList.filter((contract) => {
      const matchesSearch = !normalizedSearch || getSearchText(contract).includes(normalizedSearch);
      const matchesExpiry = !expiringOnly || isExpiringSoon(contract);
      return matchesSearch && matchesExpiry;
    });
  }, [contracts, expiringOnly, normalizedSearch]);

  const hasContracts = Boolean(contracts?.length);
  const hasActiveFilters = status !== 'all' || Boolean(searchTerm.trim()) || expiringOnly;

  return { filteredContracts, hasActiveFilters, hasContracts };
}
