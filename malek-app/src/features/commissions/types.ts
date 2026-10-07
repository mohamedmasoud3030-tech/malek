import type { Database } from '@/types/database';

export type CommissionRecord = Database['public']['Tables']['commissions']['Row'];

export type CommissionFormValues = Readonly<{
  staff_name: string;
  type: string;
  status: string;
  source_id: string;
  deal_value: string;
  percentage: string;
  amount: string;
}>;

export type CommissionFilters = Readonly<{
  query: string;
  status: string;
  type: string;
}>;
