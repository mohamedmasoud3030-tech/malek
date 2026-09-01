import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const visualWave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');
const dashboard = readFileSync(resolve(stylesDir, '../features/dashboard/dashboard-v2.css'), 'utf8');

describe('MALEK Magic City presentation contract', () => {
  it('keeps the existing malek-pro scope as the only presentation wave', () => {
    expect(visualWave).toContain("[data-visual-wave='malek-pro']");
    expect(visualWave).toContain('Magic City / مدينة السحر والجمال');
  });

  it('derives ambience from semantic tokens instead of introducing a raw palette', () => {
    expect(visualWave).toContain('radial-gradient');
    expect(visualWave).toContain('hsl(var(--primary)');
    expect(visualWave).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('does not regress into decorative scaling or blur-heavy glass cards', () => {
    expect(visualWave).not.toContain('transform: scale(');
    expect(visualWave).not.toMatch(/backdrop-filter:\s*blur\(/);
  });

  it('keeps reduced-motion protection', () => {
    expect(visualWave).toContain('@media (prefers-reduced-motion: reduce)');
    expect(visualWave).toContain('transition-duration: 0.01ms !important');
  });

  it('treats Needs Attention as an elevated operational beacon', () => {
    expect(dashboard).toContain("[data-dashboard-priority='attention']");
    expect(dashboard).toContain('border-inline-start: 3px solid');
    expect(dashboard).toContain('var(--shadow-card)');
  });
});
