import type { Database } from '@/types/database';

export type LeadRecord = Database['public']['Tables']['leads']['Row'];

export type LeadFormValues = Readonly<{
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  desired_unit_type: string;
  min_budget: string;
  max_budget: string;
  notes: string;
}>;

export type LeadFilters = Readonly<{
  query: string;
  status: string;
  source: string;
}>;
