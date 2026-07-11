import { describe, expect, it } from 'vitest';
import * as ui from './index';

describe('shared design system barrel', () => {
  it('exports the required product UX primitives', () => {
    const required = [
      'Button',
      'IconButton',
      'Card',
      'StatCard',
      'Badge',
      'StatusBadge',
      'DataTable',
      'MobileCard',
      'SearchInput',
      'FilterBar',
      'DatePicker',
      'Modal',
      'Drawer',
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
      expect(ui[name], `${name} should be exported from components/ui`).toBeTypeOf('function');
    }
  });
});
