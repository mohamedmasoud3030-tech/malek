import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');

describe('global stylesheet imports', () => {
  it('keeps each CSS import as a real line so PostCSS can parse the entrypoint', () => {
    expect(source).not.toContain('\\n@import');
    expect(source).toContain("@import './app-density-contract.css';\n@import './design-system-foundation.css';");
    expect(source).toContain("@import './page-polish.css';\n@import './ux-foundation.css';");
  });

  it('loads the production style stack once through globals.css', () => {
    const globalStyleImports = entrySource.match(/import ['\"]@\/styles\//g) ?? [];

    expect(globalStyleImports).toHaveLength(1);
    expect(entrySource).toContain("import '@/styles/globals.css';");
    expect(entrySource).not.toContain("import '@/styles/page-polish.css';");
    expect(entrySource).not.toContain("import '@/styles/ux-foundation.css';");
  });
});
