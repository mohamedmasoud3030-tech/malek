import type { ResponsibleParty, UtilityBillStatus } from './utility-schema';

/**
 * Persisted utility bill row shape. Lives in its own module so that pure
 * derivation modules (e.g. utility-obligations) can consume the type without
 * pulling in the full Supabase-backed service and creating a cycle.
 */
export type UtilityBill = {
  id: string;
  meter_id: string | null;
  property_id: string;
  unit_id?: string | null;
  bill_number?: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  previous_reading?: number | null;
  current_reading?: number | null;
  consumption_units?: number | null;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: UtilityBillStatus;
  responsible_party: ResponsibleParty;
  actual_payer?: ResponsibleParty | null;
  attachment_url?: string | null;
  notes?: string | null;
  created_at: string;
};
