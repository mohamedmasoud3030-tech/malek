import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Design tokens contract — يحمي بنية نظام التصميم الموحد:
 *
 * 1. tokens.css هو المصدر المركزي الوحيد للتوكنات (ألوان/ظلال/أنصال/accents).
 * 2. جسر Tailwind v4 (@theme inline) يولّد فئات النظام دون مراجع ذاتية
 *    (مرجع ذاتي مثل `--color-border: hsl(var(--color-border))` يكسر var()
 *    ويتلف فئات الشفافية إلى hsl(hsl(...)) في بناء الإنتاج).
 * 3. dark: variant مربوط بمبدّل التطبيق [data-theme='dark'] وليس ثيم النظام.
 * 4. لا يوجد tailwind.config.js ميت يوحي بأنه مصدر الحقيقة.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const tokens = readFileSync(resolve(stylesDir, 'tokens.css'), 'utf8');
const globals = readFileSync(resolve(stylesDir, 'globals.css'), 'utf8');
const productPalette = readFileSync(resolve(stylesDir, 'product-palette.css'), 'utf8');

function block(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start < 0) return '';
  const end = source.indexOf('}', start);
  return source.slice(start, end);
}

const themeBridge = (() => {
  const start = tokens.indexOf('@theme inline {');
  const end = tokens.indexOf('\n}', start);
  return tokens.slice(start, end);
})();

describe('design tokens — single source of truth', () => {
  it('tokens.css defines the core palette in BOTH light and dark scopes', () => {
    const lightRoot = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf("[data-theme='dark']"));
    const darkRoot = tokens.slice(tokens.indexOf("[data-theme='dark']"));

    // Palette/shadow tokens are theme-dependent and must exist in both scopes.
    for (const name of ['--color-bg', '--color-card', '--color-primary', '--color-success-text', '--shadow-card', '--tone-emerald']) {
      expect(lightRoot, `light token ${name}`).toContain(`${name}:`);
      expect(darkRoot, `dark token ${name}`).toContain(`${name}:`);
    }

    // Radius + typography are shared across themes and defined once in light scope.
    expect(lightRoot).toContain('--radius:');
    expect(lightRoot).toContain('--radius-card:');
    expect(tokens).toContain("--font-sans: 'Cairo'");
  });

  it('globals.css imports tokens.css and stops redefining the palette', () => {
    expect(globals).toContain("@import './tokens.css';");
    for (const leaked of ['--color-primary:', '--color-success-text:', '--shadow-card:', '--radius-card:']) {
      expect(globals, `globals.css must not redefine ${leaked}`).not.toContain(leaked);
    }
  });

  it('product-palette.css consumes tokens instead of redefining them', () => {
    expect(productPalette).not.toContain('--tone-emerald:');
    expect(productPalette).not.toContain('--accent-foreground:');
    expect(productPalette).toContain('var(--tone-');
  });

  it('no dead tailwind.config.js remains to masquerade as the token source', () => {
    expect(existsSync(resolve(stylesDir, '../../tailwind.config.js'))).toBe(false);
  });
});

describe('tailwind v4 theme bridge', () => {
  it('registers the semantic colors, shadows, and radius scale utilities', () => {
    for (const key of [
      '--color-success', '--color-warning', '--color-danger', '--color-info', '--color-neutral',
      '--color-success-bg', '--color-danger-bg',
      '--shadow-card', '--shadow-card-hover', '--shadow-elevated',
      '--radius-lg', '--radius-xl', '--radius-2xl',
    ]) {
      expect(themeBridge, `bridge entry ${key}`).toContain(`${key}:`);
    }
  });

  it('never self-references a css variable inside its own theme key', () => {
    const selfRef = /--([\w-]+):\s*(?:hsl\(var\()?\s*var\(--\1\)\)?/;
    expect(selfRef.test(themeBridge)).toBe(false);
  });

  it('radius mapping restores the documented contract', () => {
    expect(themeBridge).toContain('--radius-lg: var(--radius);');
    expect(themeBridge).toContain('--radius-xl: var(--radius-card);');
    expect(themeBridge).toContain('--radius-2xl: var(--radius-elevated);');
  });
});

describe('dark mode contract', () => {
  it('dark variant targets the app theme attribute, not the OS preference', () => {
    expect(tokens).toContain("@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));");
  });
});
