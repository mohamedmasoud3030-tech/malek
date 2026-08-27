import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = readFileSync(new URL('./registry/sectionRegistry.ts', import.meta.url), 'utf8');

describe('settings product copy', () => {
  it('does not describe operator settings with implementation failure jargon', () => {
    expect(registry).not.toContain('فشل مغلق عند النقص');
  });
});
