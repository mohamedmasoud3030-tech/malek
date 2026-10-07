import { describe, expect, it } from 'vitest';
import {
  coerceOwnerFormToPayload,
  coerceOwnerUpdateToPayload,
  ownerFormSchema,
  ownerPayloadSchema,
  ownerUpdateSchema,
} from './owner-schema';

const validForm = {
  full_name: 'محمد أحمد',
  display_name: 'محمد',
  phone: '+968 9123-4567',
  email: 'owner@example.com',
  national_id: 'OM-1234/56',
  tax_number: 'TAX-100',
  address: 'مسقط',
  notes: 'مالك رئيسي',
  is_active: true,
};

const validPayload = {
  full_name: 'محمد أحمد',
  display_name: 'محمد',
  phone: '+968 9123-4567',
  email: 'owner@example.com',
  national_id: 'OM-1234/56',
  tax_number: 'TAX-100',
  address: 'مسقط',
  notes: 'مالك رئيسي',
  is_active: true,
};

describe('ownerFormSchema', () => {
  it('accepts and trims a complete owner form', () => {
    const parsed = ownerFormSchema.parse({
      ...validForm,
      full_name: '  محمد أحمد  ',
      display_name: '  محمد  ',
      phone: '  +968 9123-4567  ',
      email: '  owner@example.com  ',
      national_id: '  OM-1234/56  ',
      tax_number: '  TAX-100  ',
      address: '  مسقط  ',
      notes: '  مالك رئيسي  ',
    });

    expect(parsed).toEqual(validForm);
  });

  it('defaults active state and converts blank optional fields to null', () => {
    const parsed = ownerFormSchema.parse({
      full_name: 'محمد',
      display_name: '',
      phone: '',
      email: '',
      national_id: '',
      tax_number: '',
      address: '',
      notes: '',
    });

    expect(parsed).toEqual({
      full_name: 'محمد',
      display_name: null,
      phone: null,
      email: null,
      national_id: null,
      tax_number: null,
      address: null,
      notes: null,
      is_active: true,
    });
  });

  it('rejects missing or whitespace-only names', () => {
    expect(() => ownerFormSchema.parse({ ...validForm, full_name: '' })).toThrow(/اسم المالك/);
    expect(() => ownerFormSchema.parse({ ...validForm, full_name: '   ' })).toThrow(/اسم المالك/);
  });

  it('validates phone, email, and national id formats', () => {
    expect(() => ownerFormSchema.parse({ ...validForm, phone: '123' })).toThrow(/الهاتف/);
    expect(() => ownerFormSchema.parse({ ...validForm, email: 'owner-at-example' })).toThrow(/البريد/);
    expect(() => ownerFormSchema.parse({ ...validForm, national_id: 'x!' })).toThrow(/الهوية/);
    expect(ownerFormSchema.parse({ ...validForm, phone: '1234567' }).phone).toBe('1234567');
    expect(ownerFormSchema.parse({ ...validForm, national_id: 'ABCD' }).national_id).toBe('ABCD');
  });

  it('enforces all text length limits', () => {
    expect(() => ownerFormSchema.parse({ ...validForm, full_name: 'x'.repeat(121) })).toThrow(/120/);
    expect(() => ownerFormSchema.parse({ ...validForm, display_name: 'x'.repeat(121) })).toThrow(/120/);
    expect(() => ownerFormSchema.parse({ ...validForm, phone: '1'.repeat(33) })).toThrow();
    expect(() => ownerFormSchema.parse({ ...validForm, email: `${'x'.repeat(250)}@a.com` })).toThrow();
    expect(() => ownerFormSchema.parse({ ...validForm, national_id: 'A'.repeat(33) })).toThrow();
    expect(() => ownerFormSchema.parse({ ...validForm, tax_number: 'x'.repeat(65) })).toThrow(/64/);
    expect(() => ownerFormSchema.parse({ ...validForm, address: 'x'.repeat(501) })).toThrow(/500/);
    expect(() => ownerFormSchema.parse({ ...validForm, notes: 'x'.repeat(2001) })).toThrow(/2000/);
  });
});

describe('ownerPayloadSchema', () => {
  it('accepts a complete typed payload and nullable optional values', () => {
    expect(ownerPayloadSchema.parse(validPayload)).toEqual(validPayload);
    expect(ownerPayloadSchema.parse({
      ...validPayload,
      display_name: null,
      phone: null,
      email: null,
      national_id: null,
      tax_number: null,
      address: null,
      notes: null,
    })).toMatchObject({ display_name: null, phone: null, email: null, national_id: null });
  });

  it('rejects invalid service-boundary values', () => {
    expect(() => ownerPayloadSchema.parse({ ...validPayload, full_name: '' })).toThrow();
    expect(() => ownerPayloadSchema.parse({ ...validPayload, phone: 'bad' })).toThrow();
    expect(() => ownerPayloadSchema.parse({ ...validPayload, email: 'bad' })).toThrow();
    expect(() => ownerPayloadSchema.parse({ ...validPayload, national_id: '!' })).toThrow();
    expect(() => ownerPayloadSchema.parse({ ...validPayload, is_active: 'yes' })).toThrow();
  });
});

describe('coerceOwnerFormToPayload', () => {
  it('normalizes a parsed form into the persistence payload', () => {
    const parsed = ownerFormSchema.parse({
      ...validForm,
      display_name: '',
      phone: '',
      email: '',
      national_id: '',
      tax_number: '',
      address: '',
      notes: '',
    });

    expect(coerceOwnerFormToPayload(parsed)).toEqual({
      full_name: 'محمد أحمد',
      display_name: null,
      phone: null,
      email: null,
      national_id: null,
      tax_number: null,
      address: null,
      notes: null,
      is_active: true,
    });
  });
});

describe('ownerUpdateSchema', () => {
  const requiredNullableFields = {
    display_name: '',
    tax_number: '',
    address: '',
    notes: '',
  };

  it('accepts a complete update and trims supplied fields', () => {
    const parsed = ownerUpdateSchema.parse({
      full_name: '  محمد الجديد  ',
      display_name: '  محمد  ',
      phone: '  +968 9123-4567  ',
      email: '  updated@example.com  ',
      national_id: '  OM-9000  ',
      tax_number: '  TAX-2  ',
      address: '  صحار  ',
      notes: '  updated  ',
      is_active: false,
    });

    expect(parsed).toEqual({
      full_name: 'محمد الجديد',
      display_name: 'محمد',
      phone: '+968 9123-4567',
      email: 'updated@example.com',
      national_id: 'OM-9000',
      tax_number: 'TAX-2',
      address: 'صحار',
      notes: 'updated',
      is_active: false,
    });
  });

  it('allows optional update fields to be omitted while normalizing nullable text', () => {
    const parsed = ownerUpdateSchema.parse(requiredNullableFields);
    expect(parsed).toEqual({ display_name: null, tax_number: null, address: null, notes: null });
  });

  it('rejects explicitly supplied invalid update fields', () => {
    expect(() => ownerUpdateSchema.parse({ ...requiredNullableFields, phone: 'bad' })).toThrow(/الهاتف/);
    expect(() => ownerUpdateSchema.parse({ ...requiredNullableFields, email: 'bad' })).toThrow(/البريد/);
    expect(() => ownerUpdateSchema.parse({ ...requiredNullableFields, national_id: '!' })).toThrow(/الهوية/);
    expect(() => ownerUpdateSchema.parse({ ...requiredNullableFields, full_name: 'x'.repeat(121) })).toThrow(/120/);
  });
});

describe('coerceOwnerUpdateToPayload', () => {
  it('emits every explicitly supplied update field', () => {
    const parsed = ownerUpdateSchema.parse({
      full_name: 'محمد الجديد',
      display_name: 'محمد',
      phone: '+968 9123-4567',
      email: 'updated@example.com',
      national_id: 'OM-9000',
      tax_number: 'TAX-2',
      address: 'صحار',
      notes: 'updated',
      is_active: false,
    });

    expect(coerceOwnerUpdateToPayload(parsed)).toEqual({
      full_name: 'محمد الجديد',
      display_name: 'محمد',
      phone: '+968 9123-4567',
      email: 'updated@example.com',
      national_id: 'OM-9000',
      tax_number: 'TAX-2',
      address: 'صحار',
      notes: 'updated',
      is_active: false,
    });
  });

  it('does not invent omitted optional fields and clears explicit blank text', () => {
    const parsed = ownerUpdateSchema.parse({
      display_name: '',
      tax_number: '',
      address: '',
      notes: '',
    });

    expect(coerceOwnerUpdateToPayload(parsed)).toEqual({
      display_name: null,
      tax_number: null,
      address: null,
      notes: null,
    });
  });
});
