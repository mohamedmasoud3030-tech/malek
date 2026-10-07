import { describe, expect, it } from 'vitest';
import {
  assertLeadStatusTransition,
  leadFormSchema,
  leadPayloadSchema,
  leadSourceSchema,
  leadStatusSchema,
} from './lead-schema';

const input = {
  name: 'Lead',
  phone: '',
  email: '',
  source: 'website' as const,
  status: 'new' as const,
  desired_unit_type: '',
  min_budget: '10',
  max_budget: '20',
  notes: '',
};

describe('lead schema', () => {
  it('accepts every supported source and status enum', () => {
    for (const source of ['walk_in', 'phone', 'referral', 'social', 'website'] as const) {
      expect(leadSourceSchema.parse(source)).toBe(source);
      expect(leadFormSchema.parse({ ...input, source }).source).toBe(source);
    }
    for (const status of ['new', 'contacted', 'qualified', 'converted', 'lost', 'archived'] as const) {
      expect(leadStatusSchema.parse(status)).toBe(status);
      expect(leadFormSchema.parse({ ...input, status }).status).toBe(status);
    }
  });

  it('normalizes optional text and budget values', () => {
    const parsed = leadPayloadSchema.parse({
      ...input,
      name: '  محمد  ',
      phone: '  +96891234567  ',
      email: '  lead@example.com  ',
      desired_unit_type: '  apartment  ',
      min_budget: '',
      max_budget: '2500.5',
      notes: '  interested  ',
    });

    expect(parsed).toEqual({
      name: 'محمد',
      phone: '+96891234567',
      email: 'lead@example.com',
      source: 'website',
      status: 'new',
      desired_unit_type: 'apartment',
      min_budget: null,
      max_budget: 2500.5,
      notes: 'interested',
    });
  });

  it('requires a name and rejects malformed email', () => {
    expect(() => leadPayloadSchema.parse({ ...input, name: '   ' })).toThrow(/اسم العميل/);
    expect(() => leadPayloadSchema.parse({ ...input, email: 'not-an-email' })).toThrow(/البريد/);
  });

  it('rejects unsupported enums and unknown properties', () => {
    expect(() => leadPayloadSchema.parse({ ...input, source: 'unknown' })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, status: 'pending' })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, unexpected: true })).toThrow();
  });

  it('rejects invalid and negative budget values', () => {
    expect(() => leadPayloadSchema.parse({ ...input, min_budget: 'not-a-number' })).toThrow(/الميزانية/);
    expect(() => leadPayloadSchema.parse({ ...input, max_budget: '-1' })).toThrow(/الميزانية/);
  });

  it('rejects a maximum budget below the minimum', () => {
    expect(() => leadPayloadSchema.parse({ ...input, min_budget: '21', max_budget: '20' })).toThrow(/الحد الأقصى/);
    expect(leadPayloadSchema.parse({ ...input, min_budget: '20', max_budget: '20' })).toMatchObject({ min_budget: 20, max_budget: 20 });
  });

  it('enforces text length limits', () => {
    expect(() => leadPayloadSchema.parse({ ...input, name: 'x'.repeat(161) })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, phone: 'x'.repeat(33) })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, desired_unit_type: 'x'.repeat(101) })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, notes: 'x'.repeat(2001) })).toThrow();
  });
});

describe('lead status transitions', () => {
  it('permits the supported forward, terminal, and idempotent transitions', () => {
    expect(() => assertLeadStatusTransition('new', 'contacted')).not.toThrow();
    expect(() => assertLeadStatusTransition('contacted', 'qualified')).not.toThrow();
    expect(() => assertLeadStatusTransition('qualified', 'converted')).not.toThrow();
    expect(() => assertLeadStatusTransition('converted', 'archived')).not.toThrow();
    expect(() => assertLeadStatusTransition('lost', 'archived')).not.toThrow();
    expect(() => assertLeadStatusTransition('archived', 'archived')).not.toThrow();
    expect(() => assertLeadStatusTransition('new', 'new')).not.toThrow();
  });

  it('rejects backward or otherwise unsupported transitions', () => {
    expect(() => assertLeadStatusTransition('converted', 'new')).toThrow(/غير مسموح/);
    expect(() => assertLeadStatusTransition('archived', 'contacted')).toThrow(/غير مسموح/);
    expect(() => assertLeadStatusTransition('lost', 'qualified')).toThrow(/غير مسموح/);
  });
});
