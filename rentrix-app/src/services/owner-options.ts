import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

export type OwnerOption = Readonly<{
  id: string;
  full_name: string;
  display_name: string | null;
  name: string;
}>;

/**
 * Shared-neutral lookup seam for controls that only need to present active
 * owners by human-readable name. Business owner workflows stay inside the
 * owners feature; consumers outside that feature never import its hooks or
 * services directly.
 */
export async function listOwnerOptions(): Promise<OwnerOption[]> {
  try {
    const { rows } = await fetchAllRows<OwnerOption>(() => supabase
      .from('owners')
      .select('id, full_name, display_name, name')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .order('id', { ascending: true })
      .returns<OwnerOption[]>());
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل قائمة الملاك');
    throw error;
  }
}
