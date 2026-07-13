import { supabase } from '@/lib/supabase';
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

  let query = supabase
    .from('contracts')
    .select('id,unit_id,start_date,end_date,status')
    .is('deleted_at', null)
    .in('unit_id', ids)
    .in('status', ['draft', 'active'])
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (excludedContractId) query = query.neq('id', excludedContractId);

  const { data, error } = await query.returns<ContractUnitConflict[]>();
  if (error) throw error;
  return data ?? [];
}
