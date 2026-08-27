import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * MALEK premium glass — material & lighting design contract.
 *
 * The premium surface system (styles/premium-glass.css + the glass token block
 * in styles/tokens.css) is a material layer. It must stay a single shared
 * system, must not become a second theme, and must stay cheap enough for phones.
 */
function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const tokens = source('styles/tokens.css');
const glass = source('styles/premium-glass.css');
const globals = source('styles/globals.css');
const shell = source('app/layout/app-shell.tsx');
const nav = source('app/layout/layout-navigation-view.tsx');
const bottomSheet = source('components/ui/bottom-sheet.tsx');
const notifications = source('app/layout/notifications-menu.tsx');
const login = source('features/auth/login-page.tsx');

const REQUIRED_TOKENS = [
  '--glass-blur',
  '--glass-blur-elevated',
  '--glass-blur-strong',
  '--glass-surface',
  '--glass-surface-elevated',
  '--glass-surface-strong',
  '--glass-surface-base',
  '--glass-surface-gradient',
  '--glass-surface-gradient-elevated',
  '--glass-border',
  '--glass-border-strong',
  '--glass-rim',
  '--glass-highlight',
  '--glass-edge-light',
  '--glass-edge-light-elevated',
  '--glass-sheen',
  '--glass-sheen-soft',
  '--glass-shadow',
  '--glass-shadow-elevated',
  '--glass-shadow-overlay',
  '--premium-page-base',
  '--premium-page-ambient',
  '--premium-login-ambient',
] as const;

function block(css: string, selector: string): string {
  const needle = `${selector} {`;
  const chunks: string[] = [];
  let cursor = css.indexOf(needle);
  while (cursor !== -1) {
    let depth = 0;
    for (let index = cursor; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          chunks.push(css.slice(cursor, index + 1));
          break;
        }
      }
    }
    cursor = css.indexOf(needle, cursor + needle.length);
  }
  expect(chunks.length, `${selector} block missing from tokens.css`).toBeGreaterThan(0);
  return chunks.join('\n');
}

function declarations(rule: string): string[] {
  const body = rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'));
  return body
    .split(';')
    .map((entry) => entry.split(':')[0].trim())
    .filter((name) => name.length > 0 && !name.startsWith('--'));
}

function rulesFor(css: string, fragment: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`([^{}]*${fragment}[^{}]*)\\{([^{}]*)\\}`, 'g');
  for (const match of css.matchAll(pattern)) out.push(match[0]);
  return out;
}

describe('premium glass — one shared material system', () => {
  it('is wired into the canonical stylesheet entry point', () => {
    expect(globals).toContain("@import './tokens.css';");
    expect(globals).toContain("@import './premium-glass.css';");
    expect(globals.indexOf("@import './tokens.css';")).toBeLessThan(
      globals.indexOf("@import './premium-glass.css';"),
    );
    expect(globals.indexOf("@import './malek-pro-visual-wave.css';")).toBeLessThan(
      globals.indexOf("@import './premium-glass.css';"),
    );
  });

  it('declares every glass token for BOTH the light and the deep-navy dark theme', () => {
    const light = block(tokens, ':root');
    const dark = block(tokens, "[data-theme='dark']");
    for (const token of REQUIRED_TOKENS) {
      expect(light, `light theme is missing ${token}`).toContain(`${token}:`);
      expect(dark, `dark theme is missing ${token}`).toContain(`${token}:`);
    }
  });

  it('keeps the dark foundation a deep navy, not a neutral black', () => {
    const dark = block(tokens, "[data-theme='dark']");
    const base = /--premium-page-base:\s*hsl\(([\d.]+)\s/.exec(dark);
    expect(base).not.toBeNull();
    const hue = Number(base?.[1]);
    expect(hue).toBeGreaterThanOrEqual(210);
    expect(hue).toBeLessThanOrEqual(235);
    expect(dark).toMatch(/--premium-page-ambient:[\s\S]*radial-gradient/);
  });

  it('keeps the light theme a cool white rather than a flat neutral', () => {
    const light = block(tokens, ':root');
    const base = /--premium-page-base:\s*hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/.exec(light);
    expect(base).not.toBeNull();
    const [, hue, saturation, lightness] = base as unknown as [string, string, string, string];
    expect(Number(hue)).toBeGreaterThanOrEqual(200);
    expect(Number(saturation)).toBeGreaterThan(0);
    expect(Number(lightness)).toBeGreaterThan(95);
  });

  it('exposes the documented surface hierarchy as reusable primitives', () => {
    for (const primitive of [
      '.surface-glass-base',
      '.surface-glass',
      '.surface-glass-elevated',
      '.surface-glass-strong',
      '.glass-rim',
      '.ambient-shadow',
      '.active-glow',
    ]) {
      expect(glass, `missing primitive ${primitive}`).toContain(primitive);
    }
    for (const level of ['base', 'card', 'elevated', 'strong']) {
      expect(glass).toContain(`[data-glass-level='${level}']`);
    }
  });

  it('does not introduce a second theme system', () => {
    for (const forbidden of [
      '--color-bg:',
      '--color-card:',
      '--color-primary:',
      '--color-text-primary:',
      '--radius-card:',
      '--shadow-card:',
    ]) {
      expect(glass, `premium-glass.css must not redefine ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('paints the page environment once, behind everything', () => {
    expect(glass).toContain('body::before');
    expect(glass).toContain('background-image: var(--premium-page-ambient)');
    expect(glass).toContain('position: fixed');
    expect(glass).toContain('[data-app-shell] main#main-content');
  });
});

describe('premium glass — reflection and hierarchy', () => {
  it('gives every glass level a top-edge specular highlight', () => {
    for (const level of ['base', 'card', 'elevated', 'strong']) {
      const rule = rulesFor(glass, `\\[data-glass-level='${level}'\\]`)[0];
      expect(rule, `no rule for glass level ${level}`).toBeTruthy();
      expect(declarations(rule)).toContain('box-shadow');
    }
    const light = block(tokens, ':root');
    expect(light).toMatch(/--glass-edge-light:\s*[\s\S]*inset 0 1px 0/);
  });

  it('carries a restrained sheen — a static gradient, never an animated streak', () => {
    expect(glass).toContain('var(--glass-sheen-soft)');
    expect(glass).toContain('var(--glass-sheen)');
    expect(glass).not.toMatch(/@keyframes[^{]*(shine|sweep|gloss)/i);
    expect(glass).not.toMatch(/animation:[^;]*(shine|sweep|gloss)/i);
  });

  it('does not treat every surface identically', () => {
    const dense = rulesFor(glass, '\\[data-entity-table-wrapper\\]')[0];
    expect(dense).toContain('var(--glass-surface-base)');
    expect(dense).not.toContain('backdrop-filter');
    expect(rulesFor(glass, '\\[data-unified-surface=')[0]).toContain('var(--glass-surface-elevated)');
    expect(rulesFor(glass, '\\[data-mobile-dock-surface\\]')[0]).toContain('backdrop-filter');
  });

  it('gives interactive cards hover, pressed and selected states', () => {
    expect(glass).toContain('[data-entity-card]:hover');
    expect(glass).toContain('[data-entity-card][aria-selected=\'true\']');
    expect(glass).toContain('@media (hover: none) and (pointer: coarse)');
    const pressed = rulesFor(glass, '\\[data-app-shell\\] \\[data-entity-card\\]:active')[0];
    expect(pressed, 'touch pressed state must stay on the glass material').toContain('inset');
  });
});

describe('premium glass — performance budget', () => {
  it('pays for backdrop-filter only on chrome and overlays, never on in-flow cards', () => {
    const blurredSelectors = [...glass.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)].map(
      (match) => match[1],
    );
    expect(blurredSelectors.length).toBeGreaterThan(0);

    for (const selector of blurredSelectors) {
      expect(selector, `card marker blurred: ${selector}`).not.toMatch(
        /\[data-(component-card|entity-card|mobile-card|kpi-card)\]/,
      );
      expect(selector, `dense register blurred: ${selector}`).not.toMatch(
        /\[data-(entity-table-wrapper|list-results)\]/,
      );
    }
  });

  it('caps blur radii at a mobile-safe budget', () => {
    const light = block(tokens, ':root');
    const dark = block(tokens, "[data-theme='dark']");
    for (const theme of [light, dark]) {
      for (const name of ['--glass-blur', '--glass-blur-elevated', '--glass-blur-strong']) {
        const value = Number(new RegExp(`${name}:\\s*([\\d.]+)px`).exec(theme)?.[1]);
        expect(Number.isFinite(value), `${name} is not a px value`).toBe(true);
        expect(value, `${name} exceeds the 32px mobile budget`).toBeLessThanOrEqual(32);
      }
    }
  });

  it('does not animate filters or add per-card pseudo-element trees', () => {
    expect(glass).not.toMatch(/transition:[^;]*(filter|backdrop-filter)/);
    expect(glass).not.toMatch(/animation:[^;]*filter/);
    const paintedPseudo = [...glass.matchAll(/::(?:before|after)\s*\{([^{}]*)\}/g)].filter((match) =>
      match[1].includes('content:'),
    );
    expect(paintedPseudo.map((match) => match[0])).toHaveLength(2);
  });
});

describe('premium glass — accessibility', () => {
  it('keeps text-bearing overlays on the strongest, least transparent surface', () => {
    const overlay = rulesFor(glass, '\\[data-mobile-notifications-panel\\]')[0];
    expect(overlay).toContain('var(--glass-surface-strong)');
    expect(overlay).toContain('backdrop-filter');
    for (const surface of ['[data-bottom-sheet]', '[data-mobile-quick-add-menu]', '[data-account-menu-panel]']) {
      expect(rulesFor(glass, surface.replace(/[[\]]/g, '\\$&'))[0]).toContain('var(--glass-surface-strong)');
    }
  });

  it('never stacks translucency inside an overlay', () => {
    const nested = rulesFor(glass, '\\[data-dialog-content\\] \\[data-component-card\\]')[0];
    expect(nested).toContain('backdrop-filter: none');
    expect(nested).toContain('hsl(var(--card))');
  });

  it('keeps a loud focus ring and a readable disabled state on buttons', () => {
    expect(rulesFor(glass, '\\[data-ui-button\\]:focus-visible')[0]).toContain('4px');
    const disabled = rulesFor(glass, '\\[data-ui-button\\]:disabled')[0];
    expect(disabled).toContain('background-image: none');
    expect(disabled).toContain('var(--opacity-disabled)');
  });

  it('falls back cleanly for reduced motion, forced colours and print', () => {
    expect(glass).toContain('@media (prefers-reduced-motion: reduce)');
    expect(glass).toContain('@media (forced-colors: active)');
    expect(glass).toContain('@media print');

    const reduced = glass.slice(glass.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('transform: none');

    const forced = glass.slice(
      glass.indexOf('@media (forced-colors: active)'),
      glass.indexOf('@media print'),
    );
    expect(forced).toContain('background-color: Canvas');
    expect(forced).toContain('backdrop-filter: none');
  });

  it('does not lean on contrast-destroying translucency for the ambient page', () => {
    const ambient = rulesFor(glass, 'body::before')[0];
    expect(ambient).toContain('pointer-events: none');
    expect(ambient).toContain('z-index: -1');
  });
});

describe('premium glass — target mobile shell behaviour', () => {
  it('keeps the shared utility dock and moves primary navigation to the shared bottom sheet', () => {
    expect(nav).toContain('data-mobile-dock-surface');
    for (const hook of [
      'data-mobile-floating-control',
      'data-mobile-dock-menu',
      'data-mobile-dock-search',
      'data-mobile-dock-quick-add',
      'data-mobile-dock-notifications',
      'data-mobile-dock-ai',
    ]) {
      expect(nav, `lost utility hook ${hook}`).toContain(hook);
    }
    expect(nav).toContain('if (drawerOpen) {');
    expect(nav).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]');
    expect(nav).toContain('size-11 min-h-11 min-w-11');

    expect(shell).toContain('data-header-brand-monogram');
    expect(shell).toContain('data-header-wordmark');
    expect(shell).not.toContain('data-mobile-menu-trigger');
    expect(shell).toContain('data-account-menu-panel');
    expect(shell).toContain("import { BottomSheet } from '@/components/ui/bottom-sheet'");
    expect(shell).toContain('data-mobile-nav-bottom-sheet');
    expect(shell).not.toContain('data-mobile-drawer');
    expect(shell).not.toContain('w-[85vw]');

    expect(bottomSheet).toContain('data-bottom-sheet');
    expect(bottomSheet).toContain('justify-end');
    expect(bottomSheet).toContain('w-full');
    expect(bottomSheet).toContain('rounded-t-3xl');
    expect(bottomSheet).toContain("document.body.style.overflow = 'hidden'");

    expect(notifications).toContain('data-mobile-notifications-panel');
    expect(notifications).toContain('max-md:bottom-[var(--mobile-dock-clearance');
    expect(notifications).toContain('max-md:max-h-[min(70dvh,28rem)]');
  });

  it('adds no new hardcoded z-index and no authentication change', () => {
    expect((glass.match(/z-index/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(login).toContain('await login(email, password)');
    expect(login).toContain('data-login-card');
    expect(login).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
