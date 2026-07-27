import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('communication embeddable workspace contract', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'communication-page.tsx'), 'utf8');

  it('exports a reusable workspace and preserves the standalone route wrapper', () => {
    expect(source).toContain('export function CommunicationWorkspace');
    expect(source).toContain('export function CommunicationPage()');
    expect(source).toContain('return <CommunicationWorkspace />;');
  });

  it('renders embedded content without a nested page layout or page header', () => {
    expect(source).toContain('if (embedded)');

    const embeddedSection = source.match(
      /<section data-workspace="communication"[\s\S]*?<\/section>/,
    )?.[0];

    expect(embeddedSection).toBeDefined();
    expect(embeddedSection).not.toContain('<PageLayout');
    expect(embeddedSection).not.toContain('<PageHeader');
  });

  it('keeps create access available when embedded', () => {
    expect(source).toContain('<div className="flex justify-end">{createAction}</div>');
    expect(source).toContain('onCreate={openCreate}');
  });
});
