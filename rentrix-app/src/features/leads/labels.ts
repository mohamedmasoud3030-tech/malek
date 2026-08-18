/** Lead status and source labels. */

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

export const leadStatusTone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  new: 'info',
  contacted: 'warning',
  qualified: 'success',
  converted: 'success',
  lost: 'danger',
  archived: 'neutral',
};