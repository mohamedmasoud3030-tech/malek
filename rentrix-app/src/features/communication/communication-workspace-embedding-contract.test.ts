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

  it('delegates embedded-vs-standalone shell ownership to EmbeddableWorkspace', () => {
    expect(source).toContain("import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';");
    expect(source).toContain('<EmbeddableWorkspace');
    expect(source).toContain('embedded={embedded}');
    expect(source).toContain('workspaceName="communication"');
    expect(source).not.toContain('if (embedded)');
    expect(source).not.toContain('<PageLayout');
    expect(source).not.toContain('<PageHeader');
  });

  it('keeps create access available when embedded', () => {
    expect(source).toContain('primaryAction={createAction}');
    expect(source).toContain('onCreate={openCreate}');
  });
});
