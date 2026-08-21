import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('global stylesheet imports', () => {
  it('keeps each CSS import as a real line so PostCSS can parse the entrypoint', () => {
    expect(source).not.toContain('\\n@import');
    expect(source).toContain("@import './app-density-contract.css';\n@import './design-system-foundation.css';");
  });
});
