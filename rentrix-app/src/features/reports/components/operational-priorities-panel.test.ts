import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OperationalPrioritiesPanel', () => {
  it('keeps the office overview decision-first and routes every priority to its owning workspace', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/reports/components/OperationalPrioritiesPanel.tsx'), 'utf8');

    expect(source).toContain('أولويات العمل الآن');
    expect(source).toContain("workspace: 'collections'");
    expect(source).toContain("workspace: 'leasing'");
    expect(source).toContain("workspace: 'operations'");
    expect(source).toContain("view: 'follow_up'");
    expect(source).toContain("view: 'occupancy'");
    expect(source).toContain("view: 'expiring'");
    expect(source).toContain("view: 'maintenance_analytics'");
  });
});
