import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tableSource = readFileSync(new URL('./table.tsx', import.meta.url), 'utf8');
const entityTableSource = readFileSync(new URL('./entity-table.tsx', import.meta.url), 'utf8');

describe('canonical table visual contract', () => {
  it('keeps the common MALEK colored table skin authoritative across route scopes', () => {
    expect(tableSource).toContain('!bg-card !text-foreground');
    expect(tableSource).toContain('!bg-card border-b border-border/60');
    expect(tableSource).toContain('hover:!bg-muted/25');
    expect(tableSource).toContain('!font-extrabold');
  });

  it('preserves both Cards and Table as presentation options', () => {
    expect(entityTableSource).toContain("type ViewMode = 'cards' | 'table'");
    expect(entityTableSource).toContain("presentationMode === 'cards'");
    expect(entityTableSource).toContain('data-entity-table-wrapper');
  });
});
