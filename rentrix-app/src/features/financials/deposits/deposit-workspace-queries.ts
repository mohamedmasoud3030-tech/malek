import { getContractStatusVariants } from '@/lib/contractStatus';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Contract } from '@/types/domain';
import { useQuery } from '@tanstack/react-query';
import { listDepositClaims, listDepositRefundEvents, listTenantDeposits } from './deposit-service';
import type { DepositContractOption } from './deposit-contract-options';

type InvoiceOption = { id: string; no: string; amount: number; paid_amount: number; status: string };
type ReviewedMoveOutInspection = { id: string; inspected_on: string; summary: string | null };

export function useTenantDeposits() {
  return useQuery({
    queryKey: ['tenant-deposits'],
    queryFn: listTenantDeposits,
  });
}

export function useDepositClaims() {
  return useQuery({
    queryKey: ['deposit-claims'],
    queryFn: () => listDepositClaims(),
  });
}

export function useDepositRefundEvents() {
  return useQuery({
    queryKey: ['deposit-refund-events'],
    queryFn: () => listDepositRefundEvents(),
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ['contracts-for-deposits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(
          'id, tenant_id, property_id, unit_id, people:people!contracts_tenant_id_fkey(id,full_name), properties:properties!contracts_property_id_fkey(id,title), units:units!contracts_unit_id_fkey(id,unit_number)',
        )
        .is('deleted_at', null)
        .in('status', getContractStatusVariants('active') as Contract['status'][])
        .limit(100)
        .returns<DepositContractOption[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل العقود');
      return data ?? [];
    },
  });
}

export function useDepositInvoices(contractId?: string | null) {
  return useQuery({
    queryKey: ['deposit-invoices', contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, no, amount, paid_amount, status')
        .eq('contract_id', contractId!)
        .is('deleted_at', null)
        .limit(100)
        .returns<InvoiceOption[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل فواتير العقد');
      return data ?? [];
    },
  });
}

export function useReviewedMoveOutInspections(contractId?: string | null) {
  return useQuery({
    queryKey: ['reviewed-move-out-inspections', contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_inspections')
        .select('id,inspected_on,summary')
        .eq('contract_id', contractId!)
        .eq('kind', 'MOVE_OUT')
        .eq('status', 'REVIEWED')
        .order('inspected_on', { ascending: false })
        .returns<ReviewedMoveOutInspection[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل فحوص الإخلاء المراجعة');
      return data ?? [];
    },
  });
}

export type { InvoiceOption, ReviewedMoveOutInspection };
