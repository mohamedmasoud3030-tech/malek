import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tableSource = readFileSync(new URL('./entity-table.tsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('./entity-card.tsx', import.meta.url), 'utf8');

describe('EntityTable mobile row summaries', () => {
  it('supports an explicit shared mobile hierarchy contract', () => {
    expect(tableSource).toContain('mobileSupportingKey?: string;');
    expect(tableSource).toContain('mobilePrimaryMetaKeys?: readonly string[];');
    expect(tableSource).toContain('mobileSecondaryMetaKeys?: readonly string[];');
  });

  it('falls back to a small set of useful loaded columns when a register does not opt in explicitly', () => {
    expect(tableSource).toContain('function selectDefaultMobileMetaColumns');
    expect(tableSource).toContain('.slice(0, 3)');
  });

  it('keeps mobile card text readable instead of clipping everything to one line', () => {
    expect(tableSource).toContain('data-entity-table-mobile-supporting');
    expect(cardSource).toContain('line-clamp-2');
    expect(cardSource).toContain('[overflow-wrap:anywhere]');
  });
});
