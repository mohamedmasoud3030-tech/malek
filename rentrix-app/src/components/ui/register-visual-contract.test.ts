import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDir = resolve(dirname(fileURLToPath(import.meta.url)));
const table = readFileSync(resolve(uiDir, 'table.tsx'), 'utf8');
const entityCard = readFileSync(resolve(uiDir, 'entity-card.tsx'), 'utf8');
const entityTable = readFileSync(resolve(uiDir, 'entity-table.tsx'), 'utf8');

describe('canonical register visual contract', () => {
  it('keeps natural-width horizontally scrollable tables instead of crushing columns', () => {
    expect(table).toContain('min-w-max');
    expect(entityTable).toContain('data-entity-table-scroll');
    expect(entityTable).toContain('قابلة للتمرير أفقياً');
    expect(entityTable).toContain('overscroll-x-contain touch-pan-x');
  });

  it('keeps sticky identity/actions desktop-only and lets the whole row move on phones', () => {
    expect(entityTable).toContain("priority === 'actions'");
    expect(entityTable).toContain('sticky end-0');
    expect(table).toContain('max-md:[&_[data-column-priority=identity]]:!static');
    expect(table).toContain('max-md:[&_[data-column-priority=actions]]:!static');
    expect(table).toContain('max-md:[&_[data-column-priority=identity]]:!min-w-0');
    expect(table).toContain('max-md:[&_[data-column-priority=actions]]:!min-w-0');
  });

  it('uses one dense shared row and column sizing contract without page-level reinflation', () => {
    expect(table).toContain("'[&_td]:h-9 [&_td]:py-1.5 [&_th]:h-9'");
    expect(table).toContain('max-md:[&_td]:!h-8');
    expect(table).toContain('max-md:[&_td]:!px-1.5');
    expect(table).toContain('max-md:[&_td]:!py-0.5');
    expect(table).toContain('max-md:[&_th]:!h-8');
    expect(table).toContain('text-[12px]');
    expect(table).toContain('[&_td+td]:border-s');
    expect(table).toContain('[&_th+th]:border-s');
    expect(table).not.toContain('sm:px-3.5');
    expect(entityTable).toContain("'h-9 px-2 py-1.5 align-middle text-[12px] sm:px-2.5'");
    expect(entityTable).toContain("'h-8 bg-muted/35 px-2 text-[11px]");
    expect(entityTable).not.toContain("'h-11 px-3 py-2 align-middle sm:px-3.5'");
    expect(entityTable).not.toContain('min-w-full text-[13px]');
  });

  it('keeps mobile cards compact, flat and non-overlapping', () => {
    expect(entityCard).toContain('p-2 text-start shadow-none');
    expect(entityCard).toContain('border-border/70');
    expect(entityCard).toContain('text-[13px]');
    expect(entityCard).toContain('min-h-9');
    expect(entityCard).toContain('[overflow-wrap:anywhere]');
    expect(entityCard).not.toContain('sm:text-[15px]');
    expect(entityTable).toContain('className="grid gap-1.5" data-entity-table-mobile-list');
    expect(entityTable).toContain('gap-x-2 gap-y-1');
    expect(entityTable).toContain('rounded-lg border border-border/60 bg-card p-1 shadow-none');
  });
});
