import type { Database } from './database';

export type Property = Database['public']['Tables']['properties']['Row'];
export type Contract = Database['public']['Tables']['contracts']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Person = Database['public']['Tables']['people']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];
export type Owner = Database['public']['Tables']['owners']['Row'];
export type PropertyOwner = Database['public']['Tables']['property_owners']['Row'];

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
