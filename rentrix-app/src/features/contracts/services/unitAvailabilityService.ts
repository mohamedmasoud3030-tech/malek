import { getContractStatusVariants } from '@/lib/contractStatus';
import { supabase } from '@/lib/supabase';
import type { Contract } from '@/types/domain';
import type { ContractUnitConflict } from '../domain/unitAvailability';

export async function listUnitContractConflicts({
  unitIds,
  startDate,
  endDate,
  excludedContractId,
}: Readonly<{
  unitIds: readonly string[];
  startDate: string;
  endDate: string;
  excludedContractId?: string | null;
}>): Promise<ContractUnitConflict[]> {
  const ids = [...new Set(unitIds.filter(Boolean))];
  if (ids.length === 0 || !startDate || !endDate) return [];

  // Blocking statuses are draft + active in every stored casing — a legacy
  // 'ACTIVE' contract still occupies the unit (the DB overlap guard compares
  // lower(status)), so the UI warning must see it too. Cast because the
  // generated column type only knows the modern lowercase spellings.
  const blockingStatuses = [
    ...getContractStatusVariants('draft'),
    ...getContractStatusVariants('active'),
  ] as Contract['status'][];

  let query = supabase
    .from('contracts')
    .select('id,unit_id,start_date,end_date,status')
    .is('deleted_at', null)
    .in('unit_id', ids)
    .in('status', blockingStatuses)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (excludedContractId) query = query.neq('id', excludedContractId);

  const { data, error } = await query.returns<ContractUnitConflict[]>();
  if (error) throw error;
  return data ?? [];
}
