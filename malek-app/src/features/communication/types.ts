import type { Database } from '@/types/database';

export type CommunicationRecord = Database['public']['Tables']['communication_records']['Row'];

// Re-export the schema-driven form values type so existing call
// sites keep importing from this module.
export type { CommunicationFormValues } from './communication-schema';

export type CommunicationFilters = Readonly<{
  query: string;
  channel: string;
  status: string;
}>;
