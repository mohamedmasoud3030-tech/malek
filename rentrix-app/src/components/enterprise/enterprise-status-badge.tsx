/**
 * EnterpriseStatusBadge — Enterprise UX Foundation (Wave 4A)
 *
 * Visual status pill for ANY module. Modules map their domain enum values to
 * visual presets (icon + tone) through `statusMap`; nothing here hard-codes
 * business statuses. Falls back to the shared `StatusBadgePill` presets when
 * the status matches one of the Wave 3 lifecycle presets, and to a neutral
 * badge with a humanized label otherwise.
 */

import { createElement } from 'react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge, StatusBadgePill, statusPresets, type BadgeStatus, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface EnterpriseStatusVisual {
  /** Label shown to the user. Defaults to the raw status text. */
  label?: string;
  /** Badge tone from the design system palette. */
  variant?: BadgeVariant;
  /** Leading status icon — status is never communicated by color alone. */
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  /** Show a colored leading dot instead of (or alongside) an icon. */
  dot?: boolean;
}

export interface EnterpriseStatusBadgeProps {
  status: string;
  /** Module-provided visual map: `{ paid: { label: 'مدفوع', variant: 'success', icon: Wallet } }`. */
  statusMap?: Record<string, EnterpriseStatusVisual>;
  /** Override the resolved label. */
  label?: string;
  className?: string;
  /** Fallback badge variant when the status is unknown. */
  fallbackVariant?: BadgeVariant;
}

function isPresetStatus(status: string): status is BadgeStatus {
  return Object.prototype.hasOwnProperty.call(statusPresets, status);
}

export function EnterpriseStatusBadge({
  status,
  statusMap,
  label,
  className,
  fallbackVariant = 'neutral',
}: EnterpriseStatusBadgeProps) {
  const mapped = statusMap?.[status];

  if (!mapped && isPresetStatus(status) && label === undefined) {
    return <StatusBadgePill status={status} className={className} />;
  }

  const variant = mapped?.variant ?? fallbackVariant;
  const resolvedLabel = label ?? mapped?.label ?? status;
  const Icon = mapped?.icon;

  return (
    <Badge
      data-enterprise-status-badge
      data-status={status}
      variant={variant}
      dot={mapped?.dot === true && !Icon}
      className={cn(className)}
    >
      {Icon ? createElement(Icon, { className: 'size-3' }) : null}
      {resolvedLabel}
    </Badge>
  );
}
