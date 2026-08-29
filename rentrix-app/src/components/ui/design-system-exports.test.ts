import { describe, expect, it } from 'vitest';
import * as ui from './index';

const REACT_COMPONENT_MARKERS: readonly symbol[] = [
  Symbol.for('react.forward_ref'),
  Symbol.for('react.memo'),
];

/**
 * A required primitive is a valid React component whether it is authored as
 * a plain function or wrapped in forwardRef/memo (for example DataTable is
 * the memoized EntityTable alias). Both shapes are legitimate public React
 * surfaces; only exports that are neither would violate the barrel contract.
 */
function isReactComponent(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null || !('$$typeof' in value)) return false;
  return REACT_COMPONENT_MARKERS.includes((value as { $$typeof: symbol }).$$typeof);
}

describe('shared design system barrel', () => {
  it('exports the required product UX primitives', () => {
    const required = [
      'Button',
      'IconButton',
      'Card',
      'Badge',
      'StatusBadge',
      'DataTable',
      'MobileCard',
      'SearchInput',
      'FilterBar',
      'DatePicker',
      'Dialog',
      'BottomSheet',
      'ConfirmDialog',
      'EmptyState',
      'LoadingState',
      'ErrorState',
      'ActionMenu',
      'Dropdown',
      'FormField',
      'KpiCard',
      'SectionHeader',
    ] as const;

    for (const name of required) {
      expect(isReactComponent(ui[name]), `${name} should be a React component exported from components/ui`).toBe(true);
    }
  });

  it('does not expose superseded duplicate primitives', () => {
    for (const name of ['Modal', 'Drawer', 'InlineStatCard', 'StatCard']) {
      expect(name in ui, `${name} should not be part of the public UI surface`).toBe(false);
    }
  });
});
