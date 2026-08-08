import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * MALEK visual wave — contrast contract for operational register tables.
 *
 * The reference specifies a soft gray table header (not the dark command bar
 * used in earlier explorations). The operational thead/th block must pin its
 * background/color explicitly so generic page-polish rules do not leak.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const visualWave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');

const operationalThBlock = (() => {
  const opener = "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead th {";
  const start = visualWave.indexOf(opener);
  if (start < 0) return '';
  let depth = 0;
  let end = start;
  for (let i = start; i < visualWave.length; i += 1) {
    if (visualWave[i] === '{') depth += 1;
    if (visualWave[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return visualWave.slice(start, end);
})();

describe('malek-pro operational table header contrast', () => {
  it('uses a soft gray sticky header behind register tables', () => {
    expect(visualWave).toContain(
      "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead {",
    );
    const theadStart = visualWave.indexOf(
      "[data-operational-route='true'] [data-visual-wave='malek-pro'] [data-entity-table] thead {",
    );
    const theadBlock = visualWave.slice(theadStart, visualWave.indexOf('}', theadStart));
    expect(theadBlock).toContain('background: hsl(var(--muted)');
  });

  it('pins explicit readable text on the header (no page-polish leak)', () => {
    expect(operationalThBlock).not.toBe('');
    expect(operationalThBlock).toContain('background: transparent');
    expect(operationalThBlock).toContain('color: hsl(var(--foreground)');
  });
});
