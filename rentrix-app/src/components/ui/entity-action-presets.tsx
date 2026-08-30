import {
  FileDown,
  MessageCircle,
  Printer,
  RefreshCw,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActionMenuItem } from './action-menu';

type BaseActionOptions = {
  onPrint?: () => void;
  onPdf?: () => void;
  onShare?: () => void;
  onWhatsApp?: () => void;
  disabled?: boolean;
};

/**
 * Canonical product action presets so entity pages expose the same verbs.
 * Only add a preset once a second page genuinely needs the same verb set.
 */
export function buildContractActions(
  options: BaseActionOptions & {
    onRenew?: () => void;
    onTerminate?: () => void;
  },
): ActionMenuItem[] {
  return [
    action('print', 'طباعة العقد', <Printer className="size-4" />, options.onPrint, options.disabled),
    action('pdf', 'تصدير PDF', <FileDown className="size-4" />, options.onPdf, options.disabled),
    action('whatsapp', 'واتساب', <MessageCircle className="size-4" />, options.onWhatsApp, options.disabled),
    action('renew', 'تجديد', <RefreshCw className="size-4" />, options.onRenew, options.disabled),
    action('terminate', 'إنهاء العقد', <ShieldAlert className="size-4" />, options.onTerminate, options.disabled, true),
    action('share', 'مشاركة', <Share2 className="size-4" />, options.onShare, options.disabled),
  ].filter(Boolean) as ActionMenuItem[];
}

function action(
  id: string,
  label: string,
  icon: ReactNode,
  onSelect?: () => void,
  disabled?: boolean,
  destructive = false,
): ActionMenuItem | null {
  if (!onSelect) return null;
  return {
    id,
    label,
    icon,
    onSelect,
    disabled,
    destructive,
  };
}
