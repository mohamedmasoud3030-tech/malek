import type { Database } from '@/types/database';

type OwnerRow = Database['public']['Tables']['owners']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyOwnerRow = Database['public']['Tables']['property_owners']['Row'];

export const ownerRowFixtureDefaults = {
  name: 'مالك اختباري',
  deleted_at: null,
  company_id: 'company-1',
} satisfies Pick<OwnerRow, 'name' | 'deleted_at' | 'company_id'>;

export const propertyRowFixtureDefaults = {
  owner_id: null,
  name: 'عقار اختباري',
  company_id: 'company-1',
} satisfies Pick<PropertyRow, 'owner_id' | 'name' | 'company_id'>;

export const propertyOwnerRowFixtureDefaults = {
  company_id: 'company-1',
} satisfies Pick<PropertyOwnerRow, 'company_id'>;
