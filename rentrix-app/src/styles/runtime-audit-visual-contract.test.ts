import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const visualWave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');
const dashboard = readFileSync(resolve(stylesDir, '../features/dashboard/dashboard-v2.css'), 'utf8');
const pageHeader = readFileSync(resolve(stylesDir, '../components/layout/page-header.tsx'), 'utf8');

describe('MALEK runtime-audit visual contract', () => {
  it('expresses Arena Magic & Beauty through controlled shared chrome without a palette fork', () => {
    expect(visualWave).toContain('MALEK visual system — Final unified layer');
    expect(visualWave).toContain('Magic & Beauty');
    expect(visualWave).toContain("[data-arena-world='magic-beauty']::before");
    expect(visualWave).toContain('radial-gradient');
  });

  it('keeps the existing semantic-token presentation scope without a raw palette fork', () => {
    expect(visualWave).toContain("[data-visual-wave='malek-pro']");
    expect(visualWave).toContain('hsl(var(--primary)');
    expect(visualWave).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('rejects decorative scaling and blur-heavy glass in operational workspaces', () => {
    expect(visualWave).not.toContain('transform: scale(');
    expect(visualWave).not.toMatch(/backdrop-filter:\s*blur\(/);
  });

  it('keeps reduced-motion protection', () => {
    expect(visualWave).toContain('@media (prefers-reduced-motion: reduce)');
    expect(visualWave).toContain('transition-duration: 0.01ms !important');
  });

  it('keeps Needs Attention operational while the shared shell owns the world ambience', () => {
    expect(dashboard).toContain("[data-dashboard-priority='attention']");
    expect(dashboard).toContain('border-inline-start: 3px solid');
    expect(dashboard).toContain('var(--warning-text)');
    expect(dashboard).not.toContain('radial-gradient');
  });

  it('keeps shared ownership of mobile page-header presentation', () => {
    expect(pageHeader).toContain("className={cn('min-w-0 space-y-2', className)}");
    expect(pageHeader).not.toContain('max-md:!rounded-none');
    expect(pageHeader).not.toContain('max-md:!border-0');
    expect(pageHeader).not.toContain('max-md:!bg-transparent');
    expect(pageHeader).not.toContain('max-md:!p-0');
  });
});
