import { describe, expect, it } from 'vitest';
import { parseChecklistDefinition, parseChecklistResponses } from './contract-evidence-service';

describe('contract evidence client contract', () => {
  it('accepts only named checklist definitions with explicit required semantics', () => {
    expect(parseChecklistDefinition([
      { code: 'walls', label_ar: 'الجدران', required: true },
      { code: 4, label_ar: 'invalid', required: true },
    ])).toEqual([{ code: 'walls', label_ar: 'الجدران', required: true }]);
  });

  it('drops unknown condition values instead of presenting them as trusted evidence', () => {
    expect(parseChecklistResponses([
      { code: 'walls', condition: 'DAMAGED', note: 'كسر' },
      { code: 'floor', condition: 'CALLER_DEFINED', note: '' },
    ])).toEqual([{ code: 'walls', condition: 'DAMAGED', note: 'كسر' }]);
  });
});
