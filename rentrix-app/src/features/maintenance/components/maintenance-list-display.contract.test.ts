import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('maintenance list display architecture', () => {
  const source = readFileSync(resolve(import.meta.dirname, './maintenance-list.tsx'), 'utf8');

  it('uses shared EntityTable with status as the mobile work-queue datum', () => {
    expect(source).toContain('EntityTable');
    expect(source).toContain('mobileVisibleSecondaryKey="status"');
    expect(source).toContain('priority: "identity"');
    expect(source).toContain('priority: "primary"');
    expect(source).toContain('priority: "actions"');
    expect(source).toContain('data-maintenance-list');
  });
});
