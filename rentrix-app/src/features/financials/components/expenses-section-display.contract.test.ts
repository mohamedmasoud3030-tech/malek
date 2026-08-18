import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('expenses section display architecture', () => {
  const source = readFileSync(resolve(import.meta.dirname, './expenses-section.tsx'), 'utf8');

  it('surfaces amount as the mobile primary money datum', () => {
    expect(source).toContain('EntityTable');
    expect(source).toContain("mobileVisibleSecondaryKey=\"amount\"");
    expect(source).toContain("priority: 'identity'");
    expect(source).toContain("priority: 'primary'");
    expect(source).toContain("priority: 'actions'");
  });
});
