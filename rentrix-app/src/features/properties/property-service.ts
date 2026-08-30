import { getCrudWriteErrorMessage } from '@/lib/data/crud-write-error';
import { toDateOnlyISO } from '@/lib/formatters';
import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Contract, Property, Unit } from '@/types/domain';
import { propertySchema, type PropertyFormValues, type PropertyPayload } from './property-schema';

export type PropertyStatusFilter = Property['status'] | 'all';

export type PropertyListParams = {
  search: string;
  status: PropertyStatusFilter;
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  rows: T[];
  count: number;
};

type PropertyWorkflowOwner = Readonly<{
  display_name: string | null;
  full_name: string | null;
  name: string;
  deleted_at: string | null;
  is_active: boolean;
}>;

type PropertyWorkflowOwnerLink = Readonly<{
  owner_id: string;
  is_primary: boolean;
  starts_on: string | null;
  ends_on: string | null;
  owner: PropertyWorkflowOwner | null;
}>;

type PropertyWorkflowAgreement = Readonly<{
  starts_on: string;
  ends_on: string | null;
}>;

/**
 * Lightweight unit projection embedded in the property list read.
 *
 * The list query is a single PostgREST request (no N+1); only the fields the
 * card summary needs are selected, under the same RLS that governs the units
 * table. Counting rows in the client is presentation only — no financial or
 * business calculation.
 */
type PropertyListUnit = Readonly<{ id: string; status: Unit['status'] }>;

type PropertyWithWorkflowRelations = Property & PropertyWorkflowRelations;

/**
 * Workflow relations used to derive property onboarding readiness. Kept as a
 * standalone exported shape so the list read and the detail workspace derive
 * the same readiness state from one pure authority
 * (`derivePropertyWorkflowHealth`).
 */
export type PropertyWorkflowRelations = Readonly<{
  property_owners?: readonly PropertyWorkflowOwnerLink[] | null;
  owner_agreements?: readonly PropertyWorkflowAgreement[] | null;
  units?: readonly PropertyListUnit[] | null;
}>;

export type PropertyWorkflowHealth =
  | 'ready'
  | 'missing_owner'
  | 'owner_unavailable'
  | 'missing_agreement';

export type PropertyListItem = PropertyWithWorkflowRelations & Readonly<{
  workflow_health: PropertyWorkflowHealth;
  current_owner_name: string | null;
}>;

function coversDate(startsOn: string | null, endsOn: string | null, asOf: string): boolean {
  return (!startsOn || startsOn <= asOf) && (!endsOn || endsOn >= asOf);
}

export function derivePropertyWorkflowHealth(
  property: PropertyWorkflowRelations,
  asOf = toDateOnlyISO(),
): Pick<PropertyListItem, 'workflow_health' | 'current_owner_name'> {
  const currentOwnerLinks = (property.property_owners ?? [])
    .filter((link) => coversDate(link.starts_on, link.ends_on, asOf))
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary));

  if (currentOwnerLinks.length === 0) {
    return { workflow_health: 'missing_owner', current_owner_name: null };
  }

  const activeOwner = currentOwnerLinks
    .map((link) => link.owner)
    .find((owner) => owner && !owner.deleted_at && owner.is_active) ?? null;

  if (!activeOwner) {
    const linkedOwner = currentOwnerLinks.find((link) => link.owner)?.owner ?? null;
    return {
      workflow_health: 'owner_unavailable',
      current_owner_name: linkedOwner
        ? linkedOwner.display_name ?? linkedOwner.full_name ?? linkedOwner.name
        : null,
    };
  }

  const hasCurrentAgreement = (property.owner_agreements ?? [])
    .some((agreement) => coversDate(agreement.starts_on, agreement.ends_on, asOf));

  return {
    workflow_health: hasCurrentAgreement ? 'ready' : 'missing_agreement',
    current_owner_name: activeOwner.display_name ?? activeOwner.full_name ?? activeOwner.name,
  };
}

export function normalizePropertyPayload(payload: PropertyPayload): PropertyInsert {
  const normalized: PropertyInsert & { name: string } = { ...payload, name: payload.title };
  return normalized;
}

type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

async function assertPropertyHasNoActiveContracts(propertyId: string, actionLabel: string): Promise<void> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id')
    .eq('property_id', propertyId)
    .in('status', ['active', 'ACTIVE', 'draft', 'DRAFT'] as Contract['status'][])
    .is('deleted_at', null)
    .limit(1);

  if (error) throw new Error(`تعذر التحقق من ارتباطات العقار قبل ${actionLabel}. أعد المحاولة.`);
  if ((data ?? []).length > 0) {
    throw new Error(`لا يمكن ${actionLabel} العقار لوجود عقد نشط أو مسودة. أنهِ دورة العقد أولاً.`);
  }
}

async function assertPropertyCanBeArchived(propertyId: string): Promise<void> {
  const [unitsResult, agreementsResult, maintenanceResult] = await Promise.all([
    supabase.from('units').select('id').eq('property_id', propertyId).is('deleted_at', null).limit(1),
    supabase.from('owner_agreements').select('id').eq('property_id', propertyId).limit(1),
    supabase
      .from('maintenance_records')
      .select('id')
      .eq('property_id', propertyId)
      .in('status', ['open', 'in_progress'])
      .is('deleted_at', null)
      .limit(1),
  ]);

  if (unitsResult.error || agreementsResult.error || maintenanceResult.error) {
    throw new Error('تعذر التحقق من ارتباطات العقار قبل الأرشفة. أعد المحاولة.');
  }
  if ((unitsResult.data ?? []).length > 0) {
    throw new Error('لا يمكن أرشفة العقار بينما يحتوي على وحدات غير مؤرشفة. عالج الوحدات أولاً.');
  }
  if ((agreementsResult.data ?? []).length > 0) {
    throw new Error('لا يمكن أرشفة عقار له اتفاقية مالك محفوظة؛ استخدم حالة غير نشط أو مباع للحفاظ على السجل.');
  }
  if ((maintenanceResult.data ?? []).length > 0) {
    throw new Error('لا يمكن أرشفة العقار مع طلب صيانة مفتوح أو قيد التنفيذ.');
  }

  await assertPropertyHasNoActiveContracts(propertyId, 'أرشفة');
}

export async function listProperties(params: PropertyListParams): Promise<PaginatedResult<PropertyListItem>> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  let query = supabase
    .from('properties')
    .select('*, property_owners(owner_id,is_primary,starts_on,ends_on,owner:owners(display_name,full_name,name,deleted_at,is_active)), owner_agreements(starts_on,ends_on), units(id,status)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  const trimmedSearch = params.search.trim();
  if (trimmedSearch) {
    const escaped = trimmedSearch.replaceAll('%', '\\%').replaceAll('_', '\\_');
    const term = `"%${escaped}%"`;
    query = query.or(`title.ilike.${term},address.ilike.${term},owner_name.ilike.${term}`);
  }

  if (params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, count, error } = await query.returns<PropertyWithWorkflowRelations[]>();
  if (error) throw error;
  return {
    rows: (data ?? []).map((property) => ({ ...property, ...derivePropertyWorkflowHealth(property) })),
    count: count ?? 0,
  };
}

export async function getProperty(propertyId: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<Property>();
  if (error) throw error;
  // `.maybeSingle()` returns null for the zero-row case instead of a 406.
  // A lenient server/proxy or a 200+[] response can still resolve data to
  // `[]` — a truthy array. Returning that made the UI render a phantom
  // property (blank fields, default «عقار» title) instead of the not-found
  // state. Normalize to null so callers' truthiness checks always mean
  // "a real record".
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export type PropertyTitleRow = Readonly<{ id: string; title: string }>;

export async function listPropertyTitles(): Promise<PropertyTitleRow[]> {
  // Occupancy labels treat a missing title as "عقار بدون اسم". A silent
  // 1000-row PostgREST cap would therefore invent unnamed properties.
  // Fail closed if the portfolio exceeds the paged-read ceiling — the
  // reports hook does not expose a truncated warning for this list.
  const { rows } = await fetchAllRows<Pick<Property, 'id' | 'title'>>(
    () =>
      supabase
        .from('properties')
        .select('id, title')
        .is('deleted_at', null)
        .order('title', { ascending: true })
        .order('id', { ascending: true })
        .returns<Array<Pick<Property, 'id' | 'title'>>>(),
  );
  return rows
    .map((row) => ({ id: row.id, title: (row.title ?? '').trim() }))
    .filter((row) => row.title.length > 0);
}

export async function updateProperty(propertyId: string, payload: PropertyFormValues | PropertyPayload): Promise<Property> {
  // Re-validate at the service boundary — the form does it too, but a
  // hand-crafted call (future import script, test) cannot bypass the
  // schema. Both FormValues (the form's string shape) and the typed
  // payload are accepted.
  const validated = propertySchema.parse(payload);
  if (validated.status === 'inactive' || validated.status === 'sold') {
    await assertPropertyHasNoActiveContracts(propertyId, `تغيير حالة`);
  }
  const updatePayload: PropertyUpdate = normalizePropertyPayload(validated);
  const { data, error } = await supabase
    .from('properties')
    .update(updatePayload)
    .eq('id', propertyId)
    .is('deleted_at', null)
    .select('*')
    .single()
    .returns<Property>();
  if (error) throw new Error(getCrudWriteErrorMessage({ action: 'update', entityPlural: 'العقارات', error }));
  return data;
}

export type CoOwnerShare = Readonly<{ owner_id: string; percentage: number }>;

type PropertyOwnerInsert = Database['public']['Tables']['property_owners']['Insert'];
type PropertyOwnerUpdate = Database['public']['Tables']['property_owners']['Update'];

/**
 * Applies the ownership split captured in the property creation workflow:
 * adjusts the primary owner's percentage (the atomic creation RPC links the
 * primary owner at 100%) and inserts the extra co-owner links. Lives at the
 * service boundary so presentation components never touch the
 * property_owners table directly.
 */
export async function applyPropertyOwnershipSplit(params: Readonly<{
  propertyId: string;
  primaryPercentage: number;
  extraOwners: readonly CoOwnerShare[];
  startsOn: string;
}>): Promise<void> {
  const { propertyId, primaryPercentage, extraOwners, startsOn } = params;

  if (primaryPercentage !== 100) {
    const updatePayload: PropertyOwnerUpdate = { ownership_percentage: primaryPercentage };
    const { error } = await supabase
      .from('property_owners')
      .update(updatePayload)
      .eq('property_id', propertyId)
      .eq('is_primary', true);
    if (error) throw new Error(getCrudWriteErrorMessage({ action: 'update', entityPlural: 'ملكية العقار', error }));
  }

  for (const coOwner of extraOwners) {
    if (!coOwner.owner_id || Number(coOwner.percentage) <= 0) continue;
    const insertPayload: PropertyOwnerInsert = {
      property_id: propertyId,
      owner_id: coOwner.owner_id,
      ownership_percentage: Number(coOwner.percentage),
      is_primary: false,
      starts_on: startsOn,
    };
    const { error } = await supabase.from('property_owners').insert(insertPayload);
    if (error) throw new Error(getCrudWriteErrorMessage({ action: 'create', entityPlural: 'ملكية العقار', error }));
  }
}

export async function softDeleteProperty(propertyId: string): Promise<void> {
  await assertPropertyCanBeArchived(propertyId);
  const updatePayload: PropertyUpdate = { deleted_at: new Date().toISOString() };
  const { error } = await supabase.from('properties').update(updatePayload).eq('id', propertyId).is('deleted_at', null);
  if (error) throw new Error(getCrudWriteErrorMessage({ action: 'archive', entityPlural: 'العقارات', error }));
}
