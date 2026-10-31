import { describe, expect, it } from 'vitest';
import { readSource } from '../../../test/read-source';

describe('expenses section display architecture', () => {
  const source = readSource(import.meta.url, './expenses-section.tsx');

  it('surfaces amount as the mobile primary money datum', () => {
    expect(source).toContain('EntityTable');
    expect(source).not.toContain("mobileVisibleSecondaryKey=\"amount\"");
    expect(source).toContain("priority: 'identity'");
    expect(source).toContain("priority: 'primary'");
    expect(source).toContain("priority: 'actions'");
  });
});
