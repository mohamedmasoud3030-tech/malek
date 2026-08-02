import { describe, expect, it } from 'vitest';
import {
  RESPONSIBLE_PARTY_VALUES,
  UTILITY_TYPE_VALUES,
  utilityBillFormSchema,
  utilityBillPayloadSchema,
  utilityMeterFormSchema,
  utilityMeterPayloadSchema,
} from './utility-schema';

const propertyId = '00000000-0000-4000-8000-000000000001';

const meterForm = {
  property_id: propertyId,
  unit_id: null,
  utility_type: 'electricity' as const,
  meter_number: ' ab  12- c ',
  account_number: ' account-1 ',
  provider_name: '',
  responsible_party: 'tenant' as const,
  is_active: true,
  notes: '',
};

const billPayload = {
  meter_id: null,
  property_id: propertyId,
  unit_id: null,
  bill_number: null,
  billing_period_start: '2026-07-01',
  billing_period_end: '2026-07-31',
  previous_reading: 10,
  current_reading: 20,
  consumption_units: 10,
  amount: 100,
  paid_amount: 0,
  due_date: '2026-08-01',
  responsible_party: 'tenant' as const,
  attachment_url: null,
  notes: null,
};

const billForm = {
  meter_id: null,
  property_id: propertyId,
  unit_id: null,
  bill_number: null,
  billing_period_start: '2026-07-01',
  billing_period_end: '2026-07-31',
  previous_reading: '10',
  current_reading: '20',
  consumption_units: '10',
  amount: '100',
  paid_amount: '0',
  due_date: '2026-08-01',
  responsible_party: 'tenant' as const,
  attachment_url: null,
  notes: null,
};

describe('utility meter form schema', () => {
  it('accepts every utility type and responsible party', () => {
    for (const utility_type of UTILITY_TYPE_VALUES) {
      expect(utilityMeterFormSchema.parse({ ...meterForm, utility_type }).utility_type).toBe(utility_type);
    }
    for (const responsible_party of RESPONSIBLE_PARTY_VALUES) {
      expect(utilityMeterFormSchema.parse({ ...meterForm, responsible_party }).responsible_party).toBe(responsible_party);
    }
  });

  it('removes formatting whitespace and canonicalizes meter numbers', () => {
    const value = utilityMeterFormSchema.parse(meterForm);
    expect(value.meter_number).toBe('AB12-C');
    expect(value.account_number).toBe('account-1');
  });

  it('defaults active state and accepts omitted optional values', () => {
    const value = utilityMeterFormSchema.parse({
      property_id: propertyId,
      utility_type: 'water',
      meter_number: 'M-1',
      account_number: 'A-1',
      responsible_party: 'company',
    });
    expect(value.is_active).toBe(true);
    expect(value.unit_id).toBeUndefined();
  });

  it('rejects invalid identifiers, required strings, and enums', () => {
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, property_id: 'bad' })).toThrow(/UUID/);
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, meter_number: '   ' })).toThrow(/رقم العداد/);
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, account_number: '   ' })).toThrow(/رقم الحساب/);
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, utility_type: 'steam' })).toThrow();
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, responsible_party: 'vendor' })).toThrow();
  });

  it('enforces meter text limits', () => {
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, meter_number: 'x'.repeat(65) })).toThrow();
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, account_number: 'x'.repeat(65) })).toThrow();
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, provider_name: 'x'.repeat(201) })).toThrow();
    expect(() => utilityMeterFormSchema.parse({ ...meterForm, notes: 'x'.repeat(2001) })).toThrow();
  });
});

describe('utility meter payload schema', () => {
  const payload = {
    property_id: propertyId,
    unit_id: null,
    utility_type: 'electricity' as const,
    meter_number: 'AB12-C',
    account_number: 'account-1',
    provider_name: null,
    responsible_party: 'tenant' as const,
    is_active: true,
    notes: null,
  };

  it('accepts a typed service payload', () => {
    expect(utilityMeterPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('rejects malformed service-boundary values', () => {
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, property_id: 'bad' })).toThrow();
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, meter_number: '' })).toThrow();
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, account_number: '' })).toThrow();
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, utility_type: 'steam' })).toThrow();
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, responsible_party: 'vendor' })).toThrow();
    expect(() => utilityMeterPayloadSchema.parse({ ...payload, is_active: 'yes' })).toThrow();
  });
});

describe('utility bill form schema', () => {
  it('coerces numeric strings and blank optional numbers', () => {
    const value = utilityBillFormSchema.parse({
      ...billForm,
      previous_reading: '',
      current_reading: null,
      consumption_units: undefined,
      amount: '100.5',
      paid_amount: '',
      notes: '  note  ',
    });

    expect(value.previous_reading).toBeNull();
    expect(value.current_reading).toBeNull();
    expect(value.consumption_units).toBeNull();
    expect(value.amount).toBe(100.5);
    expect(value.paid_amount).toBeNull();
    expect(value.notes).toBe('note');
  });

  it('accepts every responsible party', () => {
    for (const responsible_party of RESPONSIBLE_PARTY_VALUES) {
      expect(utilityBillFormSchema.parse({ ...billForm, responsible_party }).responsible_party).toBe(responsible_party);
    }
  });

  it('rejects invalid, zero, and negative positive-number inputs', () => {
    expect(() => utilityBillFormSchema.parse({ ...billForm, amount: '' })).toThrow(/المبلغ/);
    expect(() => utilityBillFormSchema.parse({ ...billForm, amount: '0' })).toThrow(/أكبر من صفر/);
    expect(() => utilityBillFormSchema.parse({ ...billForm, previous_reading: 'invalid' })).toThrow();
    expect(() => utilityBillFormSchema.parse({ ...billForm, current_reading: '-1' })).toThrow(/أكبر من صفر/);
    expect(() => utilityBillFormSchema.parse({ ...billForm, consumption_units: '0' })).toThrow(/أكبر من صفر/);
    expect(() => utilityBillFormSchema.parse({ ...billForm, paid_amount: '-1' })).toThrow(/سالبة/);
  });

  it('validates due dates precisely', () => {
    expect(() => utilityBillFormSchema.parse({ ...billForm, due_date: '02-08-2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => utilityBillFormSchema.parse({ ...billForm, due_date: '2026-02-30' })).toThrow(/تاريخ غير صحيح/);
    expect(utilityBillFormSchema.parse({ ...billForm, due_date: '2024-02-29' }).due_date).toBe('2024-02-29');
  });

  it('rejects an inverted billing period', () => {
    expect(() => utilityBillFormSchema.parse({
      ...billForm,
      billing_period_start: '2026-08-01',
      billing_period_end: '2026-07-31',
    })).toThrow(/نهاية فترة/);
  });

  it('rejects a current reading below the previous reading', () => {
    expect(() => utilityBillFormSchema.parse({ ...billForm, previous_reading: '20', current_reading: '19' })).toThrow(/القراءة الحالية/);
  });

  it('rejects a paid amount above the bill amount', () => {
    expect(() => utilityBillFormSchema.parse({ ...billForm, amount: '100', paid_amount: '101' })).toThrow(/يتجاوز/);
    expect(utilityBillFormSchema.parse({ ...billForm, amount: '100', paid_amount: '100' }).paid_amount).toBe(100);
  });
});

describe('utility bill payload schema', () => {
  it('accepts a valid typed payload and nullable readings', () => {
    expect(utilityBillPayloadSchema.parse(billPayload)).toEqual(billPayload);
    expect(utilityBillPayloadSchema.parse({
      ...billPayload,
      billing_period_start: null,
      billing_period_end: null,
      previous_reading: null,
      current_reading: null,
      consumption_units: null,
      paid_amount: null,
    })).toMatchObject({ previous_reading: null, current_reading: null, paid_amount: null });
  });

  it('rejects invalid identifiers, dates, amounts, and readings', () => {
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, property_id: 'bad' })).toThrow();
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, due_date: '2026-02-30' })).toThrow(/تاريخ غير صحيح/);
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, amount: 0 })).toThrow();
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, previous_reading: -1 })).toThrow();
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, current_reading: -1 })).toThrow();
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, consumption_units: -1 })).toThrow();
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, paid_amount: -1 })).toThrow();
  });

  it('rejects an inverted billing period', () => {
    expect(() => utilityBillPayloadSchema.parse({
      ...billPayload,
      billing_period_start: '2026-08-01',
      billing_period_end: '2026-07-31',
    })).toThrow(/نهاية فترة/);
  });

  it('rejects a lower current reading', () => {
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, previous_reading: 20, current_reading: 19 })).toThrow(/القراءة الحالية/);
  });

  it('rejects paid amount above the bill amount', () => {
    expect(() => utilityBillPayloadSchema.parse({ ...billPayload, paid_amount: 101 })).toThrow(/يتجاوز/);
    expect(utilityBillPayloadSchema.parse({ ...billPayload, paid_amount: 100 }).paid_amount).toBe(100);
  });
});
