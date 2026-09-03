import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('maintenance list display architecture', () => {
  const source = readFileSync(resolve(import.meta.dirname, './maintenance-list.tsx'), 'utf8');

  it('uses shared EntityTable with status as the mobile work-queue datum', () => {
    expect(source).toContain('EntityTable');
    expect(source).not.toContain('mobileVisibleSecondaryKey="status"');
    expect(source).toContain('priority: "identity"');
    expect(source).toContain('priority: "primary"');
    expect(source).toContain('priority: "actions"');
    expect(source).toContain('data-maintenance-list');
  });

it('keeps the mobile hierarchy operational without lengthening the card', () => {
    // Issue (identity) → location (supporting) → status (badge) → priority +
    // attention (primary facts) → ownership (compact secondary line).
    expect(source).toContain('mobileBadgeKey="status"');
    expect(source).toContain('mobileSupportingKey="location"');
    expect(source).toContain('mobilePrimaryMetaKeys={["priority", "attention"]}');
    expect(source).toContain('mobileSecondaryMetaKeys={["provider"]}');
  });

  it('shows request age inside the attention datum', () => {
    expect(source).toContain('منذ {attention.ageDays} يوم');
  });

  it('carries the assignee inside the ownership cell instead of adding a card row', () => {
    expect(source).toContain('row.assigned_to || row.technician_name');
    expect(source).toContain('الفني: ');
    // Ownership stays one question, so the register keeps a single column.
    expect(source.match(/header: "مزود الخدمة"/g)).toHaveLength(1);
  });

  it('shares one status-action permission rule with the details overlay', () => {
    expect(source).toContain('canAccess(getMaintenanceStatusActionPermission(status))');
  });
});
