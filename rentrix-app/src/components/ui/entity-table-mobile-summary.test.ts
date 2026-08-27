import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./entity-table.tsx', import.meta.url), 'utf8');

describe('EntityTable mobile detail summaries', () => {
  it('falls back to two useful loaded columns when a register does not opt in explicitly', () => {
    expect(source).toContain("column !== identityColumn && column !== badgeColumn && column.resolvedPriority !== 'actions'");
    expect(source).toContain('.slice(0, 2)');
  });

  it('keeps external card details readable instead of clipping them to one line', () => {
    expect(source).toContain('line-clamp-2 break-words');
  });
});
