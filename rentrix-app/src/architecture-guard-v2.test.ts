import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('architecture guard v2 contract', () => {
  const guard = readFileSync(
    resolve(import.meta.dirname, '../../scripts/check-architecture.mjs'),
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

  it('freezes presentation service debt and blocks new cross-feature service imports', () => {
    expect(guard).toContain('presentationServiceDebtAllowList');
    expect(guard).toContain('isCrossFeatureServiceImport');
    expect(guard).toContain('presentation components must use a feature hook');
  });

  it('keeps the existing app, Supabase, page-size, and cycle guards', () => {
    expect(guard).toContain('getAppBoundaryViolation');
    expect(guard).toContain('presentation components must not import Supabase directly');
    expect(guard).toContain('pages must stay below 650 lines');
    expect(guard).toContain('findCycles');
  });
});
