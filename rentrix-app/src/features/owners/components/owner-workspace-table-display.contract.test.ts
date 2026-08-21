import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Owner register mobile/desktop display contract (IA).
 * Desktop compares many ownership columns; mobile surfaces identity plus
 * contact/property/status context and actions via shared EntityTable priorities.
 */
describe('owner workspace table display architecture', () => {
  const source = readFileSync(resolve(import.meta.dirname, './owner-workspace-table.tsx'), 'utf8');

  it('uses the shared EntityTable foundation (not a page-local mobile card)', () => {
    expect(source).toContain("from '@/components/ui/entity-table'");
    expect(source).toContain('data-owner-workspace-table');
    expect(source).not.toContain('ContractMobileCard');
    expect(source).not.toContain('renderMobileCard');
  });

  it('declares column priorities for the shared mobile register card', () => {
    expect(source).toContain("priority: 'identity'");
    expect(source).toContain("priority: 'primary'");
    expect(source).toContain("priority: 'actions'");
    expect(source).toContain("priority: 'detail'");
    expect(source).toContain('mobileVisibleSecondaryKeys={["contact", "property_count", "status"]}');
  });

  it('keeps contextual owner actions without internal identifiers', () => {
    expect(source).toContain("label: 'التفاصيل'");
    expect(source).toContain("label: 'العلاقات'");
    expect(source).toContain("label: 'تعديل'");
    expect(source).not.toContain('معرّف السجل');
  });
});
