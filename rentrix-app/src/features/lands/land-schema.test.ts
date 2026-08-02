import { describe, expect, it, vi } from 'vitest';
import {
  LAND_CATEGORY_VALUES,
  LAND_STATUS_VALUES,
  coerceFormToPayload,
  landArchiveSchema,
  landFilterSchema,
  landFormSchema,
  landPayloadSchema,
} from './land-schema';

const validForm = {
  plot_no: 'A-12',
  name: 'أرض النخيل',
  location: 'مسقط',
  area: '500',
  owner_id: 'owner-1',
  purchase_price: '100000',
  owner_price: '90000',
  commission: '5000',
  category: 'residential' as const,
  status: 'available' as const,
  notes: 'ملاحظة',
};

const validPayload = {
  plot_no: 'A-12',
  name: 'أرض النخيل',
  location: 'مسقط',
  area: 500,
  owner_id: 'owner-1',
  purchase_price: 100000,
  owner_price: 90000,
  commission: 5000,
  category: 'residential' as const,
  status: 'available' as const,
  notes: 'ملاحظة',
};

describe('landFormSchema', () => {
  it('accepts all supported categories and statuses', () => {
    for (const category of LAND_CATEGORY_VALUES) {
      expect(landFormSchema.parse({ ...validForm, category }).category).toBe(category);
    }
    for (const status of LAND_STATUS_VALUES) {
      expect(landFormSchema.parse({ ...validForm, status }).status).toBe(status);
    }
  });

  it('requires at least a name or plot number after trimming', () => {
    expect(() => landFormSchema.parse({ ...validForm, name: ' ', plot_no: ' ' })).toThrow(/اسم الأرض أو رقم القطعة/);
    expect(landFormSchema.parse({ ...validForm, name: '', plot_no: '  A-9  ' }).plot_no).toBe('A-9');
    expect(landFormSchema.parse({ ...validForm, name: '  أرض  ', plot_no: '' }).name).toBe('أرض');
  });

  it('trims optional text and applies default numeric strings', () => {
    const parsed = landFormSchema.parse({
      plot_no: '  P-1 ',
      name: '',
      location: '  صحار  ',
      owner_id: '  owner-2  ',
      category: 'commercial',
      status: 'reserved',
      notes: '  note  ',
    });

    expect(parsed).toMatchObject({
      plot_no: 'P-1',
      location: 'صحار',
      owner_id: 'owner-2',
      area: '',
      purchase_price: '',
      owner_price: '',
      commission: '',
      notes: 'note',
    });
  });

  it('rejects unsupported enums and overlong text', () => {
    expect(() => landFormSchema.parse({ ...validForm, category: 'industrial' })).toThrow();
    expect(() => landFormSchema.parse({ ...validForm, status: 'deleted' })).toThrow();
    expect(() => landFormSchema.parse({ ...validForm, plot_no: 'x'.repeat(65) })).toThrow(/64/);
    expect(() => landFormSchema.parse({ ...validForm, name: 'x'.repeat(121) })).toThrow(/120/);
    expect(() => landFormSchema.parse({ ...validForm, location: 'x'.repeat(201) })).toThrow();
    expect(() => landFormSchema.parse({ ...validForm, notes: 'x'.repeat(2001) })).toThrow();
  });
});

describe('coerceFormToPayload', () => {
  it('converts valid numeric strings and blank optional text', () => {
    const parsed = landFormSchema.parse({
      ...validForm,
      plot_no: '',
      location: '',
      owner_id: '',
      area: ' 500.5 ',
      purchase_price: '',
      owner_price: '',
      commission: '0',
      notes: '',
    });

    expect(coerceFormToPayload(parsed)).toEqual({
      plot_no: null,
      name: 'أرض النخيل',
      location: null,
      area: 500.5,
      owner_id: null,
      purchase_price: null,
      owner_price: null,
      commission: 0,
      category: 'residential',
      status: 'available',
      notes: null,
    });
  });

  it('collects invalid and negative numeric field issues', () => {
    const addIssue = vi.fn();
    const ctx = { addIssue, path: [] } as unknown as Parameters<typeof coerceFormToPayload>[1];
    const parsed = landFormSchema.parse({
      ...validForm,
      area: 'not-a-number',
      purchase_price: '-1',
      owner_price: 'Infinity',
      commission: '-5',
    });
    const payload = coerceFormToPayload(parsed, ctx);

    expect(Number.isNaN(payload.area)).toBe(true);
    expect(Number.isNaN(payload.purchase_price)).toBe(true);
    expect(Number.isNaN(payload.owner_price)).toBe(true);
    expect(Number.isNaN(payload.commission)).toBe(true);
    expect(addIssue).toHaveBeenCalledTimes(4);
    expect(addIssue).toHaveBeenCalledWith(expect.objectContaining({ path: ['area'] }));
    expect(addIssue).toHaveBeenCalledWith(expect.objectContaining({ path: ['purchase_price'] }));
  });
});

describe('landPayloadSchema', () => {
  it('accepts a valid typed payload and nullable values', () => {
    expect(landPayloadSchema.parse(validPayload)).toEqual(validPayload);
    expect(landPayloadSchema.parse({
      ...validPayload,
      plot_no: null,
      location: null,
      area: null,
      owner_id: null,
      purchase_price: null,
      owner_price: null,
      commission: null,
      notes: null,
    })).toMatchObject({ purchase_price: null, owner_price: null, commission: null });
  });

  it('rejects negative numeric values', () => {
    expect(() => landPayloadSchema.parse({ ...validPayload, area: -1 })).toThrow();
    expect(() => landPayloadSchema.parse({ ...validPayload, purchase_price: -1 })).toThrow();
    expect(() => landPayloadSchema.parse({ ...validPayload, owner_price: -1 })).toThrow();
    expect(() => landPayloadSchema.parse({ ...validPayload, commission: -1 })).toThrow();
  });

  it('rejects owner price above a positive purchase price', () => {
    expect(() => landPayloadSchema.parse({ ...validPayload, purchase_price: 100, owner_price: 101 })).toThrow(/سعر المالك/);
    expect(landPayloadSchema.parse({ ...validPayload, purchase_price: 0, owner_price: 100 }).owner_price).toBe(100);
  });

  it('rejects commission above a positive purchase price', () => {
    expect(() => landPayloadSchema.parse({ ...validPayload, purchase_price: 100, commission: 101 })).toThrow(/العمولة/);
    expect(landPayloadSchema.parse({ ...validPayload, purchase_price: 0, commission: 100 }).commission).toBe(100);
  });
});

describe('land archive and filter schemas', () => {
  it('validates archive identifiers', () => {
    expect(landArchiveSchema.parse({ id: 'land-1' })).toEqual({ id: 'land-1' });
    expect(() => landArchiveSchema.parse({ id: '' })).toThrow(/معرف الأرض/);
  });

  it('applies filter defaults and validates supported statuses', () => {
    expect(landFilterSchema.parse({})).toEqual({ query: '', status: 'all' });
    expect(landFilterSchema.parse({ query: 'plot', status: 'sold' })).toEqual({ query: 'plot', status: 'sold' });
    expect(() => landFilterSchema.parse({ query: '', status: 'deleted' })).toThrow();
    expect(() => landFilterSchema.parse({ query: 'x'.repeat(201), status: 'all' })).toThrow();
  });
});
