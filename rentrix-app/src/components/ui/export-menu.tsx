import type { LucideIcon } from 'lucide-react';
import { ActionMenu } from './action-menu';

export type ExportMenuItem = Readonly<{
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}>;

/**
 * One export affordance per register. Formats live inside a shared menu so a
 * page never grows a competing row of export buttons; «تصدير» is the single
 * visible action.
 */
export function ExportMenu({
  items,
  label = 'تصدير',
  disabled = false,
}: Readonly<{
  items: readonly ExportMenuItem[];
  label?: string;
  disabled?: boolean;
}>) {
  const available = items.filter((item) => !item.disabled);
  if (available.length === 0) return null;

  return (
    <ActionMenu
      variant="labeled"
      label={label}
      disabled={disabled}
      align="end"
      items={available.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        onClick: item.onClick,
      }))}
    />
  );
}
