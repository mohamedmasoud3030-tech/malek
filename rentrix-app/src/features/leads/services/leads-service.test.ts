import { describe, expect, it, vi } from 'vitest';
import type { LeadFormValues } from '../types';
import { createLead, leadPayload, updateLead } from './leads-service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => ({ returns: async () => ({ data: null, error: null }) }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ returns: async () => ({ data: null, error: null }) }) }) }) }),
    }),
  },
}));

const baseValues: LeadFormValues = {
  name: ' أحمد علي ',
  phone: ' 0100000000 ',
  email: ' ahmed@example.com ',
  source: 'website',
  status: 'new',
  desired_unit_type: ' شقة ',
  min_budget: '500000',
  max_budget: '800000',
  notes: ' ملاحظة ',
};

describe('leads service payload normalization', () => {
  it('trims text fields and coerces numeric budget fields', () => {
    expect(leadPayload(baseValues)).toMatchObject({
      name: 'أحمد علي',
      phone: '0100000000',
      email: 'ahmed@example.com',
      source: 'website',
      status: 'new',
      desired_unit_type: 'شقة',
      min_budget: 500000,
      max_budget: 800000,
      notes: 'ملاحظة',
    });
  });

  it('converts blank optional fields to null', () => {
    expect(leadPayload({ ...baseValues, phone: '', email: '  ', desired_unit_type: '', notes: '' })).toMatchObject({
      phone: null,
      email: null,
      desired_unit_type: null,
      notes: null,
    });
  });

  it('converts blank budget fields to null instead of NaN', () => {
    expect(leadPayload({ ...baseValues, min_budget: '', max_budget: '  ' })).toMatchObject({
      min_budget: null,
      max_budget: null,
    });
  });

  it('assigns a fresh id on every payload build', () => {
    const first = leadPayload(baseValues);
    const second = leadPayload(baseValues);
    expect(first.id).toBeTruthy();
    expect(first.id).not.toEqual(second.id);
  });
});

describe('leads service validation', () => {
  it('rejects create when name is blank', async () => {
    await expect(createLead({ ...baseValues, name: '   ' })).rejects.toThrow('اسم العميل المحتمل مطلوب.');
  });

  it('allows create when name is provided', async () => {
    await expect(createLead(baseValues)).resolves.not.toThrow();
  });

  it('rejects update when name is blank', async () => {
    await expect(updateLead('lead-1', { ...baseValues, name: '' })).rejects.toThrow('اسم العميل المحتمل مطلوب.');
  });
});
