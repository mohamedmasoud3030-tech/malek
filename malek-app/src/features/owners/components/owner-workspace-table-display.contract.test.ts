import { describe, expect, it } from 'vitest';
import { readSource } from '../../../test/read-source';

/**
 * Owner register mobile/desktop display contract (IA).
 * Desktop compares many ownership columns; mobile must surface identity +
 * active-contracts datum + actions via shared EntityTable priorities.
 */
describe('owner workspace table display architecture', () => {
  const source = readSource(import.meta.url, './owner-workspace-table.tsx');

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
    // The retired per-row detail column must stay out of the canonical directory.
    expect(source).not.toContain("priority: 'detail'");
    expect(source).not.toContain("mobileVisibleSecondaryKey=\"contracts\"");
  });

  it('keeps contextual owner actions without internal identifiers', () => {
    // Quick Preview + explicit full-file labels are unified across registers;
    // relationship management is not a directory row action.
    expect(source).toContain("label: 'معاينة سريعة'");
    expect(source).toContain("label: 'فتح الملف الكامل'");
    expect(source).toContain("label: 'تعديل'");
    expect(source).not.toContain("label: 'العلاقات'");
    expect(source).not.toContain('معرّف السجل');
  });
});
