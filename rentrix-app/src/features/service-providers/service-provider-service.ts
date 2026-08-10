import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database, Json } from '@/types/database';
import {
  serviceProviderCategorySchema,
  serviceProviderFormSchema,
  type ServiceProviderCategoryValues,
  type ServiceProviderFormValues,
} from './service-provider-schema';

export type ServiceProvider = Database['public']['Tables']['service_providers']['Row'];
export type ServiceProviderCategory = Database['public']['Tables']['service_provider_categories']['Row'];

export type ServiceProviderListItem = ServiceProvider & Readonly<{
  categories: readonly ServiceProviderCategory[];
  maintenance_jobs_count: number;
  open_jobs_count: number;
}>;

export type ServiceProviderStatusFilter = 'all' | 'active' | 'inactive';

export type ServiceProviderListParams = Readonly<{
  search: string;
  status: ServiceProviderStatusFilter;
  categoryId: string;
  page: number;
  pageSize: number;
}>;

export type PaginatedServiceProviders = Readonly<{
  rows: ServiceProviderListItem[];
  count: number;
}>;

export type ServiceProviderSummary = Readonly<{
  total: number;
  active: number;
  categories: number;
  openJobs: number;
}>;

export type ServiceProviderMaintenanceJob = Readonly<{
  id: string;
  reference: string | null;
  title: string | null;
  status: string | null;
  priority: string | null;
  scheduled_date: string | null;
  resolved_at: string | null;
  created_at: string | null;
  property_id: string | null;
  unit_id: string | null;
  properties: { id: string; title: string | null } | null;
  units: { id: string; unit_number: string | null } | null;
  category: { id: string; name: string } | null;
}>;

export type ServiceProviderDossier = Readonly<{
  provider: ServiceProviderListItem;
  maintenanceJobs: readonly ServiceProviderMaintenanceJob[];
}>;

export type ServiceProviderOption = Readonly<{
  id: string;
  name: string;
  phone: string | null;
  categoryIds: readonly string[];
}>;

type ProviderRelationRow = ServiceProvider & {
  service_provider_category_links?: Array<{ category?: ServiceProviderCategory | null }> | null;
  maintenance_records?: Array<{ id: string; status: string | null }> | null;
};

const nullableProviderFields = [
  'legal_name',
  'registration_number',
  'tax_number',
  'contact_name',
  'phone',
  'alternate_phone',
  'email',
  'website',
  'address',
  'service_area',
  'availability_notes',
  'notes',
] as const;

function normalizeOptionalText(value: string | undefined): string | null {
  return value?.trim() || null;
}

export function toServiceProviderPayload(values: ServiceProviderFormValues) {
  const parsed = serviceProviderFormSchema.parse(values);
  const payload: Record<string, string | boolean | null> = {
    name: parsed.name.trim(),
    is_active: parsed.is_active,
  };
  for (const field of nullableProviderFields) payload[field] = normalizeOptionalText(parsed[field]);
  return { payload, categoryIds: [...new Set(parsed.category_ids)] };
}

function mapProviderRow(row: ProviderRelationRow): ServiceProviderListItem {
  const categories = (row.service_provider_category_links ?? [])
    .map((link) => link.category ?? null)
    .filter((category): category is ServiceProviderCategory => Boolean(category))
    .sort((left, right) => left.name.localeCompare(right.name, 'ar'));
  const maintenanceJobs = row.maintenance_records ?? [];
  const { service_provider_category_links: _links, maintenance_records: _jobs, ...provider } = row;
  return {
    ...provider,
    categories,
    maintenance_jobs_count: maintenanceJobs.length,
    open_jobs_count: maintenanceJobs.filter((job) => job.status === 'open' || job.status === 'in_progress').length,
  };
}

const providerListSelect = `
  *,
  service_provider_category_links(
    category:service_provider_categories(*)
  ),
  maintenance_records(id,status)
`;

async function providerIdsForCategory(categoryId: string): Promise<string[]> {
  if (!categoryId) return [];
  const { rows } = await fetchAllRows<{ service_provider_id: string }>(() => (supabase as any)
    .from('service_provider_category_links')
    .select('service_provider_id')
    .eq('category_id', categoryId)
    .order('service_provider_id', { ascending: true }));
  return [...new Set(rows.map((row) => row.service_provider_id))];
}

export async function listServiceProviders(params: ServiceProviderListParams): Promise<PaginatedServiceProviders> {
  try {
    const categoryProviderIds = params.categoryId ? await providerIdsForCategory(params.categoryId) : null;
    if (categoryProviderIds && categoryProviderIds.length === 0) return { rows: [], count: 0 };

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    let query = (supabase as any)
      .from('service_providers')
      .select(providerListSelect, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    const search = params.search.trim();
    if (search) {
      const escaped = search.replaceAll('%', '\\%').replaceAll('_', '\\_');
      const term = `"%${escaped}%"`;
      query = query.or(`name.ilike.${term},legal_name.ilike.${term},contact_name.ilike.${term},phone.ilike.${term},email.ilike.${term},registration_number.ilike.${term}`);
    }
    if (params.status !== 'all') query = query.eq('is_active', params.status === 'active');
    if (categoryProviderIds) query = query.in('id', categoryProviderIds);

    const { data, count, error } = await query;
    if (error) handleSupabaseError(error, 'تعذر تحميل مزودي الخدمات');
    return {
      rows: ((data ?? []) as ProviderRelationRow[]).map(mapProviderRow),
      count: count ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('تعذر تحميل مزودي الخدمات')) throw error;
    handleSupabaseError(error, 'تعذر تحميل مزودي الخدمات');
    throw error;
  }
}

async function exactCount(table: string, configure?: (query: any) => any): Promise<number> {
  let query = (supabase as any).from(table).select('id', { count: 'exact', head: true });
  query = configure ? configure(query) : query;
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getServiceProviderSummary(): Promise<ServiceProviderSummary> {
  try {
    const [total, active, categories, openJobs] = await Promise.all([
      exactCount('service_providers', (query) => query.is('deleted_at', null)),
      exactCount('service_providers', (query) => query.is('deleted_at', null).eq('is_active', true)),
      exactCount('service_provider_categories', (query) => query.is('deleted_at', null).eq('is_active', true)),
      exactCount('maintenance_records', (query) => query.is('deleted_at', null).not('service_provider_id', 'is', null).in('status', ['open', 'in_progress'])),
    ]);
    return { total, active, categories, openJobs };
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل ملخص مزودي الخدمات');
    throw error;
  }
}

export async function listServiceProviderCategories(options: { includeInactive?: boolean } = {}): Promise<ServiceProviderCategory[]> {
  let query = (supabase as any)
    .from('service_provider_categories')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (!options.includeInactive) query = query.eq('is_active', true);
  const { rows } = await fetchAllRows<ServiceProviderCategory>(() => query);
  return rows;
}

export async function listActiveServiceProviderOptions(): Promise<ServiceProviderOption[]> {
  try {
    const { rows } = await fetchAllRows<ProviderRelationRow>(() => (supabase as any)
      .from('service_providers')
      .select('*,service_provider_category_links(category:service_provider_categories(*))')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .order('id', { ascending: true }));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      categoryIds: (row.service_provider_category_links ?? [])
        .map((link) => link.category?.id)
        .filter((id): id is string => Boolean(id)),
    }));
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل مزودي الخدمات المتاحين');
    throw error;
  }
}

export async function getServiceProvider(providerId: string): Promise<ServiceProviderListItem> {
  const { data, error } = await (supabase as any)
    .from('service_providers')
    .select(providerListSelect)
    .eq('id', providerId)
    .is('deleted_at', null)
    .single();
  if (error) handleSupabaseError(error, 'تعذر تحميل ملف مزود الخدمة');
  if (!data) throw new Error('ملف مزود الخدمة غير متاح');
  return mapProviderRow(data as ProviderRelationRow);
}

export async function getServiceProviderDossier(providerId: string): Promise<ServiceProviderDossier> {
  const provider = await getServiceProvider(providerId);
  const { data, error } = await (supabase as any)
    .from('maintenance_records')
    .select(`
      id,reference,title,status,priority,scheduled_date,resolved_at,created_at,property_id,unit_id,
      properties:property_id(id,title),
      units:unit_id(id,unit_number),
      category:service_provider_category_id(id,name)
    `)
    .eq('service_provider_id', providerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) handleSupabaseError(error, 'تعذر تحميل سجل صيانة مزود الخدمة');
  return { provider, maintenanceJobs: (data ?? []) as ServiceProviderMaintenanceJob[] };
}

export async function saveServiceProvider(providerId: string | null, values: ServiceProviderFormValues): Promise<ServiceProvider> {
  const normalized = toServiceProviderPayload(values);
  const { data, error } = await supabase.rpc('save_service_provider_atomic', {
    p_provider_id: providerId,
    p_payload: normalized.payload as Json,
    p_category_ids: normalized.categoryIds,
  });
  if (error) handleSupabaseError(error, providerId ? 'تعذر تحديث مزود الخدمة' : 'تعذر إنشاء مزود الخدمة');
  const provider = (data as { provider?: ServiceProvider } | null)?.provider;
  if (!provider) throw new Error('استجابة الخادم لا تحتوي على مزود الخدمة المحفوظ');
  return provider;
}

export async function archiveServiceProvider(providerId: string): Promise<void> {
  const { data, error } = await supabase.rpc('archive_service_provider_atomic', { p_provider_id: providerId });
  if (error) handleSupabaseError(error, 'تعذر أرشفة مزود الخدمة');
  if (!(data as { archived?: boolean } | null)?.archived) throw new Error('لم يؤكد الخادم أرشفة مزود الخدمة');
}

export async function createServiceProviderCategory(values: ServiceProviderCategoryValues): Promise<ServiceProviderCategory> {
  const parsed = serviceProviderCategorySchema.parse(values);
  const { data, error } = await supabase
    .from('service_provider_categories')
    .insert({ name: parsed.name.trim(), description: normalizeOptionalText(parsed.description), is_active: true })
    .select('*')
    .single();
  if (error) handleSupabaseError(error, 'تعذر إنشاء نوع الخدمة');
  if (!data) throw new Error('لم يتم حفظ نوع الخدمة');
  return data;
}

export async function updateServiceProviderCategory(categoryId: string, values: ServiceProviderCategoryValues): Promise<ServiceProviderCategory> {
  const parsed = serviceProviderCategorySchema.parse(values);
  const { data, error } = await supabase
    .from('service_provider_categories')
    .update({ name: parsed.name.trim(), description: normalizeOptionalText(parsed.description) })
    .eq('id', categoryId)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error) handleSupabaseError(error, 'تعذر تحديث نوع الخدمة');
  if (!data) throw new Error('نوع الخدمة غير متاح');
  return data;
}

export async function archiveServiceProviderCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('service_provider_categories')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', categoryId)
    .is('deleted_at', null);
  if (error) handleSupabaseError(error, 'تعذر أرشفة نوع الخدمة');
}
