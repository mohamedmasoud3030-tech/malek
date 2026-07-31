import type { Database } from '@/types/database';
import type { LandFormInput, LandFormValues } from './land-schema';

export type LandRecord = Database['public']['Tables']['lands']['Row'];

// Re-export the schema types so existing consumers keep working.
export type { LandFormInput, LandFormValues };

export type LandFilters = Readonly<{
  query: string;
  status: string;
}>;
