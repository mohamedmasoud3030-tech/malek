/** Lead status and source labels. */

import type { SemanticTone } from '@/components/ui/status-badge';
export const leadStatusLabels: Record<string, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهل',
  converted: 'تم التحويل',
  lost: 'مغلق',
  archived: 'مؤرشف',
};

export const leadSourceLabels: Record<string, string> = {
  walk_in: 'زيارة المكتب',
  phone: 'اتصال',
  referral: 'ترشيح',
  social: 'منصات اجتماعية',
  website: 'الموقع',
};

export const leadStatusTone: Record<string, SemanticTone> = {
  new: 'info',
  contacted: 'warning',
  qualified: 'success',
  converted: 'success',
  lost: 'danger',
  archived: 'neutral',
};