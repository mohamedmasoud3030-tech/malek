import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * MALEK visual wave — contrast contract for the operational command tables.
 *
 * The operational redesign renders register table headers as a dark command
 * bar. The generic page-polish `thead th` rule (muted background + muted
 * grey text) previously leaked into that bar, producing washed-out headers
 * (muted text on a milky muted/0.4 overlay) in both themes. The operational
 * `thead th` block must therefore pin its own background/color explicitly.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const visualWave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');

const operationalThBlock = (() => {
  const opener = "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead th {";
  const start = visualWave.indexOf(opener);
  if (start < 0) return '';
  const end = visualWave.indexOf('}', start);
  return visualWave.slice(start, end);
})();

describe('malek-pro operational table header contrast', () => {
  it('uses a dark command header bar behind the register tables', () => {
    expect(visualWave).toContain(
      "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead {",
    );
    const theadStart = visualWave.indexOf(
      "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead {",
    );
    const theadBlock = visualWave.slice(theadStart, visualWave.indexOf('}', theadStart));
    expect(theadBlock).toContain('background: hsl(222 32% 16%)');
  });

  it('pins explicit readable text on the dark header (no page-polish leak)', () => {
    expect(operationalThBlock).not.toBe('');
    expect(operationalThBlock).toContain('background: transparent');
    expect(operationalThBlock).toContain('color: rgb(248 250 252 / 0.92)');
    expect(operationalThBlock).toContain('border-bottom-color: rgb(255 255 255 / 0.08)');
  });
});
