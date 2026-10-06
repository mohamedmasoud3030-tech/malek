import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./ContractDetailWorkspace.tsx', import.meta.url), 'utf8');

describe('ContractDetailWorkspace desktop composition', () => {
  it('keeps related contract overview surfaces side by side on wide screens', () => {
    expect(source).toContain('data-contract-overview-composition');
    expect(source).toContain('xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]');
  });

  it('uses the desktop width for evidence and documents instead of stacking them', () => {
    expect(source).toContain('data-contract-documents-composition');
    expect(source).toContain('xl:grid-cols-2');
    expect(source).toContain('xl:col-span-2');
  });
});
