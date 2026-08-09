import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';
import type { Person } from '@/types/domain';
import { personSchema, type PersonFormValues, type PersonPayload } from './person-schema';

export type PersonTypeFilter = Person['type'] | 'all';

export type PeopleListParams = {
  search: string;
  type: PersonTypeFilter;
  page: number;
  pageSize: number;
};

export type PaginatedPeople = {
  rows: Person[];
  count: number;
};

type PersonInsert = Database['public']['Tables']['people']['Insert'];
type PersonUpdate = Database['public']['Tables']['people']['Update'];

// Re-export so existing imports keep working.
export type { PersonFormValues, PersonPayload };

const nullablePersonStringFields = ['phone', 'email', 'national_id', 'address', 'notes'] as const;

/**
 * Validate a person payload at the service boundary. The form does
 * the same via zodResolver, but a hand-crafted call (future import
 * script, test) cannot bypass the schema.
 */
export function normalizePersonPayload(values: PersonFormValues | PersonPayload): PersonInsert {
  // Re-parse through the schema so the service boundary is enforced
  // even if the caller did not.
  const parsed = personSchema.parse(values);
  const fullName = parsed.full_name.trim();
  if (!fullName) throw new Error('الاسم الكامل مطلوب');

  const normalized: PersonInsert = {
    full_name: fullName,
    type: parsed.type,
  };

  for (const field of nullablePersonStringFields) {
    const raw = (parsed as unknown as Record<string, unknown>)[field];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      normalized[field as keyof PersonInsert] = (trimmed === '' ? null : trimmed) as never;
    } else {
      normalized[field as keyof PersonInsert] = null as never;
    }
  }

  return normalized;
}

function requirePersonData(data: Person | null, fallbackMessage: string): Person {
  if (!data) throw new Error(fallbackMessage);
  return data;
}

export async function listPeople(params: PeopleListParams): Promise<PaginatedPeople> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  let query = supabase
    .from('people')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  const trimmedSearch = params.search.trim();
  if (trimmedSearch) {
    const escaped = trimmedSearch.replaceAll('%', '\\%').replaceAll('_', '\\_');
    const term = `"%${escaped}%"`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term},national_id.ilike.${term}`);
  }

  if (params.type !== 'all') {
    query = query.eq('type', params.type);
  }

  const { data, count, error } = await query.returns<Person[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل الأشخاص');
  return { rows: data ?? [], count: count ?? 0 };
}

export async function getPerson(personId: string): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .is('deleted_at', null)
    .single()
    .returns<Person>();
  if (error) handleSupabaseError(error, 'تعذر تحميل بيانات الشخص');
  return requirePersonData(data, 'تعذر تحميل بيانات الشخص');
}

export type PersonDossierContract = Readonly<{
  id: string;
  reference: string | null;
  status: string;
  start_date: string;
  end_date: string;
  property_id: string;
  unit_id: string | null;
  properties: { id: string; title: string | null } | null;
  units: { id: string; unit_number: string | null } | null;
}>;

export type PersonDossierInvoice = Readonly<{
  id: string;
  reference: string | null;
  contract_id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
}>;

export type PersonDossierActivity = Readonly<{
  id: string;
  subject: string | null;
  body: string;
  status: string | null;
  created_at: string;
}>;

export type PersonDossier = Readonly<{
  person: Person;
  contracts: PersonDossierContract[];
  invoices: PersonDossierInvoice[];
  latestActivity: PersonDossierActivity[];
}>;

/** Targeted dossier loader; every related query is constrained by this person. */
export async function getPersonDossier(
  personId: string,
  options: { includeFinancial: boolean; includeActivity: boolean },
): Promise<PersonDossier> {
  const person = await getPerson(personId);
  const { data: contractsData, error: contractsError } = await (supabase as any)
    .from('contracts')
    .select('id,reference,status,start_date,end_date,property_id,unit_id,properties:property_id(id,title),units:unit_id(id,unit_number)')
    .eq('tenant_id', personId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (contractsError) handleSupabaseError(contractsError, 'تعذر تحميل عقود الشخص');
  const contracts = (contractsData ?? []) as PersonDossierContract[];
  const contractIds = contracts.map((contract) => contract.id);

  const [invoiceResult, activityResult] = await Promise.all([
    options.includeFinancial && contractIds.length > 0
      ? (supabase as any).from('invoices').select('id,reference,contract_id,due_date,amount,paid_amount,status').in('contract_id', contractIds).is('deleted_at', null).order('due_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    options.includeActivity
      ? (supabase as any).from('communication_records').select('id,subject,body,status,created_at').eq('related_entity_type', 'person').eq('related_entity_id', personId).is('deleted_at', null).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (invoiceResult.error) handleSupabaseError(invoiceResult.error, 'تعذر تحميل السياق المالي للشخص');
  if (activityResult.error) handleSupabaseError(activityResult.error, 'تعذر تحميل نشاط الشخص');
  return {
    person,
    contracts,
    invoices: (invoiceResult.data ?? []) as PersonDossierInvoice[],
    latestActivity: (activityResult.data ?? []) as PersonDossierActivity[],
  };
}

export async function createPerson(payload: PersonFormValues | PersonPayload): Promise<Person> {
  // Validate at the service boundary — a hand-crafted call cannot
  // skip the schema. Both FormValues (string) and Payload (typed)
  // are accepted, but the schema is the same source of truth.
  const { data, error } = await supabase
    .from('people')
    .insert(normalizePersonPayload(payload))
    .select('*')
    .single()
    .returns<Person>();
  if (error) handleSupabaseError(error, 'تعذر إنشاء الشخص');
  return requirePersonData(data, 'تعذر إنشاء الشخص');
}

export async function updatePerson(personId: string, payload: PersonFormValues | PersonPayload): Promise<Person> {
  const updatePayload: PersonUpdate = normalizePersonPayload(payload);
  const { data, error } = await supabase
    .from('people')
    .update(updatePayload)
    .eq('id', personId)
    .is('deleted_at', null)
    .select('*')
    .single()
    .returns<Person>();
  if (error) handleSupabaseError(error, 'تعذر تحديث بيانات الشخص');
  return requirePersonData(data, 'تعذر تحديث بيانات الشخص');
}

export async function softDeletePerson(personId: string): Promise<void> {
  const updatePayload: PersonUpdate = { deleted_at: new Date().toISOString() };
  const { error } = await supabase.from('people').update(updatePayload).eq('id', personId).is('deleted_at', null);
  if (error) handleSupabaseError(error, 'تعذر أرشفة الشخص');
}
