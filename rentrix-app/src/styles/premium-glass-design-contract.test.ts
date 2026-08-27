import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * MALEK premium glass — material & lighting design contract.
 *
 * The premium surface system (styles/premium-glass.css + the glass token block
 * in styles/tokens.css) is a *material* layer: it decides how a surface catches
 * light and how deep it sits. It must stay a single shared system, must not
 * become a second competing theme, and must stay cheap enough for phones.
 *
 * These assertions are file-level on purpose: they lock the contract that no
 * component test can see (token presence per theme, blur budget, overlay
 * opacity, reduced-motion / forced-colour / print fallbacks) without asserting
 * a single Tailwind class on a live component.
 */
function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const tokens = source('styles/tokens.css');
const glass = source('styles/premium-glass.css');
const globals = source('styles/globals.css');
const shell = source('app/layout/app-shell.tsx');
const nav = source('app/layout/layout-navigation-view.tsx');
const notifications = source('app/layout/notifications-menu.tsx');
const login = source('features/auth/login-page.tsx');

/** Every glass token that a primitive consumes, for both themes. */
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

/**
 * Collect every declaration block opened by `selector`.
 * tokens.css legitimately repeats `:root` (spacing, light palette, glass), so a
 * single-match lookup would read the wrong block.
 */
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

/** Collect the property names declared inside one CSS rule body. */
function declarations(rule: string): string[] {
  const body = rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'));
  return body
    .split(';')
    .map((entry) => entry.split(':')[0].trim())
    .filter((name) => name.length > 0 && !name.startsWith('--'));
}

/** All rule bodies whose selector list mentions the given fragment. */
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
    // The material layer must sit after the earlier visual layers so it wins
    // the cascade without needing !important.
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
    // 210–235° is the MALEK navy band; a neutral grey/black would be ~0 or absent.
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
    // Attribute opt-in mirrors the class API so features can pick a level
    // without importing a competing utility set.
    for (const level of ['base', 'card', 'elevated', 'strong']) {
      expect(glass).toContain(`[data-glass-level='${level}']`);
    }
  });

  it('does not introduce a second theme system', () => {
    // No re-declaration of the canonical colour/shadow/radius tokens: the
    // material layer may only consume them.
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
    // Chrome must be see-through or the ambient layer is invisible.
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
    // The highlight itself is an inset light line, not a bright outline.
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
    // Dense registers sit on the quiet base material…
    const dense = rulesFor(glass, '\\[data-entity-table-wrapper\\]')[0];
    expect(dense).toContain('var(--glass-surface-base)');
    expect(dense).not.toContain('backdrop-filter');
    // …while page headers and overlays are the elevated, blurred material.
    expect(rulesFor(glass, '\\[data-unified-surface=')[0]).toContain('var(--glass-surface-elevated)');
    expect(rulesFor(glass, '\\[data-mobile-dock-surface\\]')[0]).toContain('backdrop-filter');
  });

  it('gives interactive cards hover, pressed and selected states', () => {
    const states = glass;
    expect(states).toContain('[data-entity-card]:hover');
    expect(states).toContain('[data-entity-card][aria-selected=\'true\']');
    expect(states).toContain('@media (hover: none) and (pointer: coarse)');
    // The pressed state must survive the later-loaded ux-foundation reset, so
    // it is qualified by the shell.
    const pressed = rulesFor(glass, '\\[data-app-shell\\] \\[data-entity-card\\]:active')[0];
    expect(pressed, 'touch pressed state must stay on the glass material').toContain('inset');
  });
});

describe('premium glass — performance budget', () => {
  it('pays for backdrop-filter only on chrome and overlays, never on in-flow cards', () => {
    // Only real blur costs count; `backdrop-filter: none` is a fallback.
    const blurredSelectors = [...glass.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)].map(
      (match) => match[1],
    );
    expect(blurredSelectors.length).toBeGreaterThan(0);

    for (const selector of blurredSelectors) {
      // In-flow card markers must never appear in a blurred selector list.
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
    // Pseudo-elements that actually paint: the fixed page environment plus one
    // deliberate reflection line on the dock. Nothing per-card.
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
    for (const surface of ['[data-mobile-drawer]', '[data-mobile-quick-add-menu]', '[data-account-menu-panel]']) {
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
    // The ambient layer is decorative only: it must never intercept pointer
    // events or sit above content.
    const ambient = rulesFor(glass, 'body::before')[0];
    expect(ambient).toContain('pointer-events: none');
    expect(ambient).toContain('z-index: -1');
  });
});

describe('premium glass — #1595 mobile shell behaviour is untouched', () => {
  it('adds visual hooks without moving any behavioural hook', () => {
    // Dock: the new material hook sits beside the existing control hooks.
    expect(nav).toContain('data-mobile-dock-surface');
    for (const hook of [
      'data-mobile-floating-control',
      'data-mobile-dock-menu',
      'data-mobile-dock-search',
      'data-mobile-dock-quick-add',
      'data-mobile-dock-notifications',
      'data-mobile-dock-ai',
    ]) {
      expect(nav, `lost #1595 hook ${hook}`).toContain(hook);
    }
    // The dock still disappears entirely while the drawer is open.
    expect(nav).toContain('if (drawerOpen) {');
    // Safe-area clearance and the 44px grid are untouched.
    expect(nav).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]');
    expect(nav).toContain('size-11 min-h-11 min-w-11');

    // Header: still [ M ] MALEK, still no hamburger.
    expect(shell).toContain('data-header-brand-monogram');
    expect(shell).toContain('data-header-wordmark');
    expect(shell).not.toContain('data-mobile-menu-trigger');
    expect(shell).toContain('data-account-menu-panel');

    // Drawer still opens from the right in RTL at the #1595 size.
    expect(shell).toContain('left-auto right-0');
    expect(shell).toContain('w-[85vw] max-w-[20rem]');

    // Notifications keep the anchored mobile panel contract.
    expect(notifications).toContain('data-mobile-notifications-panel');
    expect(notifications).toContain('max-md:bottom-[calc(var(--mobile-floating-control-height');
    expect(notifications).toContain('max-md:max-h-[min(70dvh,28rem)]');
  });

  it('adds no new hardcoded z-index and no authentication change', () => {
    expect((glass.match(/z-index/g) ?? []).length).toBeLessThanOrEqual(1);
    // The login route still submits through the same handler; only classes moved.
    expect(login).toContain('await login(email, password)');
    expect(login).toContain('data-login-card');
    expect(login).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
