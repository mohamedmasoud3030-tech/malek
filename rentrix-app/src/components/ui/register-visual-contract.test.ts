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
  });

  it('keeps actions as the final sticky desktop column', () => {
    expect(entityTable).toContain("priority === 'actions'");
    expect(entityTable).toContain('sticky end-0');
  });

  it('uses one crisp shared row and column sizing contract', () => {
    expect(table).toContain("'[&_td]:h-11 [&_td]:py-2 [&_th]:h-10'");
    expect(table).toContain('text-[13px]');
    expect(table).toContain('[&_td+td]:border-s');
    expect(table).toContain('[&_th+th]:border-s');
  });

  it('keeps cards available but flatter and easier to scan', () => {
    expect(entityCard).toContain('shadow-none');
    expect(entityCard).toContain('border-border/90');
    expect(entityCard).toContain('text-[14px]');
    expect(entityCard).toContain('min-h-10');
  });
});
