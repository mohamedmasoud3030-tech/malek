import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_TECHNICAL_BRAND_PREFIX } from './lib/brand';

describe('architecture guard v2 contract', () => {
  const guard = readFileSync(
    resolve(import.meta.dirname, '../scripts/check-architecture.mjs'),
    'utf8',
  );

  it('governs every feature instead of a focused subset', () => {
    expect(guard).toContain('featureDependencyAllowList');
    expect(guard).toContain('if (isFeatureFile(file))');
    expect(guard).not.toContain('focusedFeatureAllowList');
    expect(guard).not.toContain('isFocusedArchitectureFile');
  });

  it('defaults unknown features to no cross-feature dependencies', () => {
    expect(guard).toContain('featureDependencyAllowList.get(sourceFeature) ?? new Set()');
  });

  it('keeps presentation debt at zero and makes future debt entries self-cleaning', () => {
    expect(guard).toContain('const presentationServiceDebtAllowList = new Set([]);');
    expect(guard).toContain('const presentationDataPlaneDebtAllowList = new Set([]);');
    expect(guard).toContain('validateDebtAllowLists();');
    expect(guard).toContain('stale presentation data-plane debt allowlist entry');
    expect(guard).toContain('stale presentation service debt allowlist entry');
    expect(guard).not.toContain('features/financials/deposits/deposits-workspace.tsx');
    expect(guard).not.toContain('app/router/legacy-preview-redirect.tsx');
  });

  it('keeps financials independent from reports and removes the retired finance-hub edge', () => {
    expect(guard).toContain("['financials', new Set(['auth', 'contracts', 'properties', 'settings'])]");
    expect(guard).not.toContain("['finance-hub'");
  });

  it('blocks runtime cross-feature services including kebab-case service modules', () => {
    expect(guard).toContain('isCrossFeatureServiceImport');
    expect(guard).toContain('(?:[-.]service|Service)');
    expect(guard).toContain('presentation components must use a feature hook');
  });

  it('keeps the existing app, Supabase, page-size, and cycle guards', () => {
    expect(guard).toContain('getAppBoundaryViolation');
    expect(guard).toContain('presentation components must not import Supabase directly');
    expect(guard).toContain('pages must stay below 650 lines');
    expect(guard).toContain('findCycles');
  });
});

describe('production metadata source contract', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
  const productionUrl = 'https://malek-plus.vercel.app/';
  const retiredProductionHost = `${LEGACY_TECHNICAL_BRAND_PREFIX}app.vercel.app`;

  it('publishes only the Malek production host in canonical and social metadata', () => {
    expect(html).toContain(`<meta property="og:url" content="${productionUrl}" />`);
    expect(html).toContain(`<link rel="canonical" href="${productionUrl}" />`);
    expect(html).toContain(`<meta property="og:image" content="${productionUrl}opengraph.jpg" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${productionUrl}opengraph.jpg" />`);
    expect(html).not.toContain(retiredProductionHost);
  });
});