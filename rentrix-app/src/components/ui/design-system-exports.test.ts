import { describe, expect, it } from 'vitest';
import * as ui from './index';

const REACT_COMPONENT_MARKERS: readonly symbol[] = [
  Symbol.for('react.forward_ref'),
  Symbol.for('react.memo'),
];

function isReactComponent(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null || !('$$typeof' in value)) return false;
  return REACT_COMPONENT_MARKERS.includes((value as { $$typeof: symbol }).$$typeof);
}

describe('shared design system barrel', () => {
  it('exports the canonical product UX primitives', () => {
    const required = [
      'Button', 'Card', 'Badge', 'StatusBadge', 'DataTable', 'EntityTable', 'EntityCard',
      'SearchInput', 'FilterBar', 'Dialog', 'BottomSheet', 'ConfirmDialog', 'EmptyState',
      'LoadingState', 'ErrorState', 'ActionMenu', 'FormField', 'KpiCard', 'SectionHeader',
      'ResponsiveCardGrid',
    ] as const;

    for (const name of required) {
      expect(isReactComponent(ui[name]), `${name} should be exported from components/ui`).toBe(true);
    }
  });

  it('does not expose retired duplicate primitives', () => {
    for (const name of [
      'Modal', 'Drawer', 'InlineStatCard', 'StatCard', 'MobileCard', 'ViewModeToggle',
      'Dropdown', 'IconButton', 'DatePicker', 'FilePickerField', 'Spinner', 'TextField',
      'TextAreaField', 'PasswordField', 'Typography', 'WorkspaceNav',
    ]) {
      expect(name in ui, `${name} should not be part of the public UI surface`).toBe(false);
    }
  });
});
