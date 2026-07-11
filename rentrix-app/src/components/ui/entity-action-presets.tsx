import {
  Download,
  ExternalLink,
  FileDown,
  FileText,
  MessageCircle,
  Pencil,
  Printer,
  RefreshCw,
  Share2,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActionMenuItem } from './action-menu';

type BaseActionOptions = {
  onView?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onWhatsApp?: () => void;
  disabled?: boolean;
};

/**
 * Canonical product action presets so entity pages expose the same verbs
 * (View / Edit / Print / PDF / Export / Share / WhatsApp / Renew / Terminate / Pay).
 */
export function buildPropertyActions(options: BaseActionOptions): ActionMenuItem[] {
  return [
    action('view', 'عرض', <ExternalLink className="size-4" />, options.onView, options.disabled),
    action('edit', 'تعديل', <Pencil className="size-4" />, options.onEdit, options.disabled),
    action('print', 'طباعة', <Printer className="size-4" />, options.onPrint, options.disabled),
    action('pdf', 'تصدير PDF', <FileDown className="size-4" />, options.onPdf, options.disabled),
    action('export', 'تصدير', <Download className="size-4" />, options.onExport, options.disabled),
    action('share', 'مشاركة', <Share2 className="size-4" />, options.onShare, options.disabled),
  ].filter(Boolean) as ActionMenuItem[];
}

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

export function buildInvoiceActions(
  options: BaseActionOptions & {
    onPay?: () => void;
    onSend?: () => void;
  },
): ActionMenuItem[] {
  return [
    action('pdf', 'تصدير PDF', <FileDown className="size-4" />, options.onPdf, options.disabled),
    action('print', 'طباعة', <Printer className="size-4" />, options.onPrint, options.disabled),
    action('send', 'إرسال', <Share2 className="size-4" />, options.onSend, options.disabled),
    action('pay', 'تسجيل دفعة', <WalletCards className="size-4" />, options.onPay, options.disabled),
  ].filter(Boolean) as ActionMenuItem[];
}

export function buildReceiptActions(options: BaseActionOptions): ActionMenuItem[] {
  return [
    action('print', 'طباعة', <Printer className="size-4" />, options.onPrint, options.disabled),
    action('pdf', 'تصدير PDF', <FileDown className="size-4" />, options.onPdf, options.disabled),
    action('share', 'مشاركة', <Share2 className="size-4" />, options.onShare, options.disabled),
  ].filter(Boolean) as ActionMenuItem[];
}

export function buildReportActions(options: BaseActionOptions & { onExcel?: () => void }): ActionMenuItem[] {
  return [
    action('pdf', 'تصدير PDF', <FileText className="size-4" />, options.onPdf, options.disabled),
    action('excel', 'تصدير Excel', <Download className="size-4" />, options.onExcel, options.disabled),
    action('print', 'طباعة', <Printer className="size-4" />, options.onPrint, options.disabled),
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
