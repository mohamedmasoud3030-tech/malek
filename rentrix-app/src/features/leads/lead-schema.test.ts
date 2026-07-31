import { describe, expect, it } from 'vitest';
import { assertLeadStatusTransition, leadPayloadSchema } from './lead-schema';

const input = { name: 'Lead', phone: '', email: '', source: 'website', status: 'new', desired_unit_type: '', min_budget: '10', max_budget: '20', notes: '' };
describe('lead schema', () => {
  it('requires valid contact enums and a valid budget range', () => {
    expect(() => leadPayloadSchema.parse({ ...input, source: 'unknown' })).toThrow();
    expect(() => leadPayloadSchema.parse({ ...input, min_budget: '21' })).toThrow(/الحد الأقصى/);
  });
  it('does not permit a converted lead to become new again', () => {
    expect(() => assertLeadStatusTransition('converted', 'new')).toThrow(/غير مسموح/);
  });
});
