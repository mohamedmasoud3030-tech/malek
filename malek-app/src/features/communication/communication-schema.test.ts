import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_CHANNEL_VALUES,
  COMMUNICATION_DIRECTION_VALUES,
  COMMUNICATION_STATUS_VALUES,
  coerceCommunicationFormToPayload,
  communicationFormSchema,
  communicationPayloadSchema,
} from './communication-schema';

const validForm = {
  contact_name: 'محمود',
  contact_phone: '+968 9123-4567',
  contact_email: 'owner@example.com',
  channel: 'phone' as const,
  direction: 'inbound' as const,
  status: 'logged' as const,
  subject: 'متابعة عقد',
  body: 'تم التواصل مع العميل.',
  related_entity_type: 'owner',
  related_entity_id: '00000000-0000-4000-8000-000000000001',
};

const validPayload = {
  contact_name: 'محمود',
  contact_phone: '+968 9123-4567',
  contact_email: 'owner@example.com',
  channel: 'phone' as const,
  direction: 'inbound' as const,
  status: 'logged' as const,
  subject: 'متابعة عقد',
  body: 'تم التواصل مع العميل.',
  related_entity_type: 'owner',
  related_entity_id: '00000000-0000-4000-8000-000000000001',
};

describe('communicationFormSchema', () => {
  it('accepts every authoritative channel, direction, and status value', () => {
    for (const channel of COMMUNICATION_CHANNEL_VALUES) {
      expect(communicationFormSchema.parse({ ...validForm, channel }).channel).toBe(channel);
    }
    for (const direction of COMMUNICATION_DIRECTION_VALUES) {
      expect(communicationFormSchema.parse({ ...validForm, direction }).direction).toBe(direction);
    }
    for (const status of COMMUNICATION_STATUS_VALUES) {
      expect(communicationFormSchema.parse({ ...validForm, status }).status).toBe(status);
    }
  });

  it('trims text and converts blank optional values to null', () => {
    const result = communicationFormSchema.parse({
      ...validForm,
      contact_name: '  محمود  ',
      contact_phone: '',
      contact_email: '',
      subject: '   ',
      body: '  ملاحظة تشغيلية  ',
      related_entity_type: '   ',
      related_entity_id: null,
    });

    expect(result).toMatchObject({
      contact_name: 'محمود',
      contact_phone: null,
      contact_email: null,
      subject: null,
      body: 'ملاحظة تشغيلية',
      related_entity_type: null,
      related_entity_id: null,
    });
  });

  it('rejects missing required content and unsupported enums', () => {
    expect(() => communicationFormSchema.parse({ ...validForm, contact_name: '   ' })).toThrow(/اسم جهة التواصل/);
    expect(() => communicationFormSchema.parse({ ...validForm, body: '   ' })).toThrow(/محتوى التواصل/);
    expect(() => communicationFormSchema.parse({ ...validForm, channel: 'sms' })).toThrow();
    expect(() => communicationFormSchema.parse({ ...validForm, direction: 'sideways' })).toThrow();
    expect(() => communicationFormSchema.parse({ ...validForm, status: 'open' })).toThrow();
  });

  it('rejects malformed phone, email, uuid, and overlong values', () => {
    expect(() => communicationFormSchema.parse({ ...validForm, contact_phone: '123' })).toThrow(/الهاتف/);
    expect(() => communicationFormSchema.parse({ ...validForm, contact_email: 'not-an-email' })).toThrow(/البريد/);
    expect(() => communicationFormSchema.parse({ ...validForm, related_entity_id: 'not-a-uuid' })).toThrow(/UUID/);
    expect(() => communicationFormSchema.parse({ ...validForm, contact_name: 'x'.repeat(121) })).toThrow(/120/);
    expect(() => communicationFormSchema.parse({ ...validForm, subject: 'x'.repeat(201) })).toThrow(/200/);
    expect(() => communicationFormSchema.parse({ ...validForm, body: 'x'.repeat(8001) })).toThrow(/8000/);
    expect(() => communicationFormSchema.parse({ ...validForm, related_entity_type: 'x'.repeat(65) })).toThrow(/64/);
  });
});

describe('communicationPayloadSchema', () => {
  it('accepts a fully typed payload and nullable optional fields', () => {
    expect(communicationPayloadSchema.parse(validPayload)).toEqual(validPayload);
    expect(communicationPayloadSchema.parse({
      ...validPayload,
      contact_phone: null,
      contact_email: null,
      subject: null,
      related_entity_type: null,
      related_entity_id: null,
    })).toMatchObject({ contact_phone: null, contact_email: null, subject: null });
  });

  it('rejects malformed service-boundary values', () => {
    expect(() => communicationPayloadSchema.parse({ ...validPayload, contact_name: '' })).toThrow();
    expect(() => communicationPayloadSchema.parse({ ...validPayload, contact_phone: 'bad' })).toThrow();
    expect(() => communicationPayloadSchema.parse({ ...validPayload, contact_email: 'bad' })).toThrow();
    expect(() => communicationPayloadSchema.parse({ ...validPayload, status: 'open' })).toThrow();
    expect(() => communicationPayloadSchema.parse({ ...validPayload, related_entity_id: 'bad' })).toThrow();
  });
});

describe('coerceCommunicationFormToPayload', () => {
  it('normalizes optional and required values for persistence', () => {
    const parsed = communicationFormSchema.parse({
      ...validForm,
      contact_name: '  محمود  ',
      contact_phone: '',
      contact_email: '',
      subject: '  ',
      body: '  تم التواصل  ',
      related_entity_type: '  ',
      related_entity_id: null,
    });

    expect(coerceCommunicationFormToPayload(parsed)).toEqual({
      contact_name: 'محمود',
      contact_phone: null,
      contact_email: null,
      channel: 'phone',
      direction: 'inbound',
      status: 'logged',
      subject: null,
      body: 'تم التواصل',
      related_entity_type: null,
      related_entity_id: null,
    });
  });
});
