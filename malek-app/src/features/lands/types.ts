import type { Database } from '@/types/database';

export type LandRecord = Database['public']['Tables']['lands']['Row'];

export type LandFilters = Readonly<{
  query: string;
  status: string;
}>;
