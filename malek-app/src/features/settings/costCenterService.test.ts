import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

const FIXTURE_COMPANY_ID = '00000000-0000-4000-8000-0000000000c1';

describe('costCenterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes optional property and parent fields in write payloads', async () => {
    const { costCenterPayload } = await import('./costCenterService');

    expect(costCenterPayload({
      name: '  صيانة برج النخيل  ',
      property_id: '  ',
      parent_id: '',
      is_active: true,
    }, FIXTURE_COMPANY_ID)).toEqual({
      name: 'صيانة برج النخيل',
      property_id: null,
      parent_id: null,
      is_active: true,
      company_id: FIXTURE_COMPANY_ID,
    });
  });

  it('loads non-archived cost centers ordered by creation date', async () => {
    const rows = [{ id: 'cost-1', name: 'تشغيل', property_id: null, parent_id: null, is_active: true, created_at: '2026-06-01', updated_at: null, deleted_at: null }];
    const returns = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ returns }));
    const is = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is }));
    supabaseMock.from.mockReturnValue({ select });

    const { listCostCenters } = await import('./costCenterService');

    await expect(listCostCenters()).resolves.toEqual(rows);
    expect(supabaseMock.from).toHaveBeenCalledWith('cost_centers');
    expect(select).toHaveBeenCalledWith('*');
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('rejects blank names and self-parenting before writing', async () => {
    const { saveCostCenter } = await import('./costCenterService');

    await expect(saveCostCenter({ name: ' ', property_id: '', parent_id: '', is_active: true }, FIXTURE_COMPANY_ID)).rejects.toThrow('اسم مركز التكلفة مطلوب.');
    await expect(saveCostCenter({ name: 'تشغيل', property_id: '', parent_id: 'cost-1', is_active: true }, FIXTURE_COMPANY_ID, 'cost-1')).rejects.toThrow('لا يمكن جعل مركز التكلفة تابعاً لنفسه.');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  // WP-DB0: cost_centers RLS requires company_id = current_company_id(), so a
  // write without an active company must fail closed in the client rather than
  // reaching the database and being rejected there.
  it('refuses to write without an active company', async () => {
    const { saveCostCenter, ACTIVE_COMPANY_REQUIRED_ERROR } = await import('./costCenterService');

    await expect(saveCostCenter({ name: 'تشغيل', property_id: '', parent_id: '', is_active: true }, '')).rejects.toThrow(ACTIVE_COMPANY_REQUIRED_ERROR);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('stamps the active company on insert payloads', async () => {
    const { costCenterPayload } = await import('./costCenterService');

    expect(costCenterPayload({ name: 'تشغيل', property_id: '', parent_id: '', is_active: true }, FIXTURE_COMPANY_ID)).toEqual({
      name: 'تشغيل',
      property_id: null,
      parent_id: null,
      is_active: true,
      company_id: FIXTURE_COMPANY_ID,
    });
  });
});
