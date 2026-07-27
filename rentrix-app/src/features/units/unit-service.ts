import { getCrudWriteErrorMessage, type CrudWriteAction } from '@/lib/data/crud-write-error';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { Unit } from '@/types/domain';
import { normalizeUnitStatus, type UnitPayload } from './unit-schema';

type UnitInsert = Database['public']['Tables']['units']['Insert'];
type UnitUpdate = Database['public']['Tables']['units']['Update'];
type DatabaseWriteError = Readonly<{ code?: string; message?: string; details?: string }>;
type NumericLike = number | string | null | undefined;
type UnitWithLegacyRent = Omit<Unit, 'rent_amount'> & {
  rent_amount: NumericLike;
  rent_default?: NumericLike;
  rent?: NumericLike;
  min_rent?: NumericLike;
};

function toFiniteNumber(value: NumericLike): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveUnitRentAmount(
  unit: Pick<UnitWithLegacyRent, 'rent_amount' | 'rent_default' | 'rent'>,
): number | null {
  const canonicalRent = toFiniteNumber(unit.rent_amount);
  if (canonicalRent !== null && canonicalRent !== 0) return canonicalRent;

  const legacyDefaultRent = toFiniteNumber(unit.rent_default);
  if (legacyDefaultRent !== null && legacyDefaultRent > 0) return legacyDefaultRent;

  const legacyRent = toFiniteNumber(unit.rent);
  if (legacyRent !== null && legacyRent > 0) return legacyRent;

  return canonicalRent;
}

export function normalizeUnitPayload(propertyId: string, payload: UnitPayload): UnitInsert {
  return { ...payload, property_id: propertyId };
}

export function getUnitWriteErrorMessage(action: CrudWriteAction, error: unknown): string {
  const databaseError = error as DatabaseWriteError | null;
  const message = databaseError?.message ?? (error instanceof Error ? error.message : String(error ?? ''));
  if (
    databaseError?.code === '23505'
    || message.includes('units_property_unit_number_active_uidx')
  ) {
    return 'يوجد بالفعل وحدة بنفس الرقم داخل هذا العقار. استخدم رقماً مختلفاً أو عدّل الوحدة الموجودة.';
  }

  return getCrudWriteErrorMessage({
    action,
    entityPlural: 'الوحدات',
    error: message ? new Error(message) : error,
  });
}

export function normalizeUnitRecord(unit: UnitWithLegacyRent): Unit {
  return {
    ...unit,
    rent_amount: resolveUnitRentAmount(unit),
    status: normalizeUnitStatus(String(unit.status)),
  };
}

export async function listUnits(): Promise<Unit[]> {
  const { rows } = await fetchAllRows<UnitWithLegacyRent>(() => supabase
    .from('units')
    .select('*')
    .is('deleted_at', null)
    .order('property_id', { ascending: true })
    .order('unit_number', { ascending: true }) as any);
  return rows.map(normalizeUnitRecord);
}

export async function listUnitsByProperty(propertyId: string): Promise<Unit[]> {
  const { rows } = await fetchAllRows<UnitWithLegacyRent>(() => supabase
    .from('units')
    .select('*')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('unit_number', { ascending: true }) as any);
  return rows.map(normalizeUnitRecord);
}

export async function createUnit(propertyId: string, payload: UnitPayload): Promise<Unit> {
  const insertPayload = normalizeUnitPayload(propertyId, payload);
  const { data, error } = await supabase
    .from('units')
    .insert(insertPayload)
    .select('*')
    .single()
    .returns<UnitWithLegacyRent>();
  if (error) throw new Error(getUnitWriteErrorMessage('create', error));
  return normalizeUnitRecord(data);
}

export async function updateUnit(unitId: string, payload: UnitPayload): Promise<Unit> {
  const updatePayload: UnitUpdate = payload;
  const { data, error } = await supabase
    .from('units')
    .update(updatePayload)
    .eq('id', unitId)
    .is('deleted_at', null)
    .select('*')
    .single()
    .returns<UnitWithLegacyRent>();
  if (error) throw new Error(getUnitWriteErrorMessage('update', error));
  return normalizeUnitRecord(data);
}

export async function softDeleteUnit(unitId: string): Promise<void> {
  const [contractsResult, maintenanceResult] = await Promise.all([
    // Any contract row is historical evidence, including a soft-deleted legacy
    // row, so archival must not hide the unit from that history.
    supabase.from('contracts').select('id').eq('unit_id', unitId).limit(1),
    supabase
      .from('maintenance_records')
      .select('id')
      .eq('unit_id', unitId)
      .in('status', ['open', 'in_progress'])
      .is('deleted_at', null)
      .limit(1),
  ]);

  if (contractsResult.error || maintenanceResult.error) {
    throw new Error('تعذر التحقق من ارتباطات الوحدة قبل الأرشفة. أعد المحاولة.');
  }
  if ((contractsResult.data ?? []).length > 0) {
    throw new Error('لا يمكن أرشفة وحدة مرتبطة بعقد محفوظ؛ يجب الحفاظ على الوحدة للسجل والتقارير.');
  }
  if ((maintenanceResult.data ?? []).length > 0) {
    throw new Error('لا يمكن أرشفة الوحدة مع طلب صيانة مفتوح أو قيد التنفيذ.');
  }

  const updatePayload: UnitUpdate = { deleted_at: new Date().toISOString() };
  const { error } = await supabase.from('units').update(updatePayload).eq('id', unitId).is('deleted_at', null);
  if (error) throw new Error(getUnitWriteErrorMessage('archive', error));
}
