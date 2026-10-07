/** Communication channel, direction, and status labels. */

import type { SemanticTone } from '@/components/ui/status-badge';
export const communicationChannelLabels: Record<string, string> = {
  phone: 'هاتف',
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  meeting: 'اجتماع',
  note: 'ملاحظة تشغيلية',
};

export const communicationDirectionLabels: Record<string, string> = {
  inbound: 'وارد',
  outbound: 'صادر',
  internal: 'تشغيلي',
};

export const communicationStatusLabels: Record<string, string> = {
  logged: 'مسجل',
  follow_up: 'متابعة مطلوبة',
  resolved: 'مغلق',
  archived: 'مؤرشف',
};

export const communicationStatusTone: Record<string, SemanticTone> = {
  logged: 'info',
  follow_up: 'warning',
  resolved: 'success',
  archived: 'neutral',
};