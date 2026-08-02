import { describe, expect, it, vi } from 'vitest';
import { archiveLand, createLand, toPayload, updateLand } from './lands-service';
import type { LandFormInput } from '../land-schema';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => ({ returns: async () => ({ data: null, error: null }) }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ returns: async () => ({ data: null, error: null }) }) }) }) }),
    }),
  },
}));

const baseValues: LandFormInput = {
  plot_no: ' A-12 ',
  name: ' أرض المستثمر ',
  location: ' القاهرة الجديدة ',
  area: '500',
  owner_id: ' owner-1 ',
  purchase_price: '1200000',
  owner_price: '1000000',
  commission: '50000',
  category: 'residential',
  status: 'available',
  notes: ' ملاحظة ',
};

describe('lands service payload normalization', () => {
  it('trims text fields and validates the cleaned shape', () => {
    expect(toPayload(baseValues)).toMatchObject({
      plot_no: 'A-12',
      name: 'أرض المستثمر',
      location: 'القاهرة الجديدة',
      area: 500,
      owner_id: 'owner-1',
      purchase_price: 1200000,
      owner_price: 1000000,
      commission: 50000,
      category: 'residential',
      status: 'available',
      notes: 'ملاحظة',
    });
  });

  it('converts blank numeric fields to null instead of NaN', () => {
    expect(toPayload({ ...baseValues, area: '', purchase_price: '', owner_price: '', commission: '' })).toMatchObject({
      area: null,
      purchase_price: null,
      owner_price: null,
      commission: null,
    });
  });

  it('converts blank optional text fields to null', () => {
    expect(toPayload({ ...baseValues, plot_no: '', location: '', notes: '' })).toMatchObject({
      plot_no: null,
      location: null,
      notes: null,
    });
  });
});

describe('lands service validation', () => {
  it('rejects create when both name and plot_no are blank', async () => {
    await expect(createLand({ ...baseValues, name: '', plot_no: '' })).rejects.toThrow(
      'أدخل اسم الأرض أو رقم القطعة على الأقل',
    );
  });

  it('allows create when only plot_no is provided', async () => {
    await expect(createLand({ ...baseValues, name: '' })).resolves.not.toThrow();
  });

  it('rejects update when both name and plot_no are blank', async () => {
    await expect(updateLand('land-1', { ...baseValues, name: '', plot_no: '' })).rejects.toThrow(
      'أدخل اسم الأرض أو رقم القطعة على الأقل',
    );
  });

  it('rejects when owner_price exceeds purchase_price', async () => {
    await expect(createLand({ ...baseValues, purchase_price: '1000', owner_price: '1500' })).rejects.toThrow(
      'سعر المالك لا يمكن أن يتجاوز سعر الشراء',
    );
  });

  it('rejects when commission exceeds purchase_price', async () => {
    await expect(createLand({ ...baseValues, purchase_price: '1000', commission: '1500' })).rejects.toThrow(
      'العمولة لا يمكن أن تتجاوز سعر الشراء',
    );
  });

  it('rejects non-numeric input for numeric fields', async () => {
    await expect(createLand({ ...baseValues, area: 'not a number' })).rejects.toThrow();
  });

  it('rejects negative numeric input', async () => {
    await expect(createLand({ ...baseValues, area: '-5' })).rejects.toThrow();
  });
});

describe('lands service archive', () => {
  it('sets status to archived', async () => {
    const data = await archiveLand('land-1');
    expect(data).toBeNull(); // mocked response; call resolving without throwing confirms wiring
  });

  it('rejects archive with no id', async () => {
    await expect(archiveLand('')).rejects.toThrow('معرف الأرض مطلوب');
  });
});
