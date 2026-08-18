/** Land status and category labels. */

export const landStatusLabels: Record<string, string> = {
  available: 'متاحة',
  reserved: 'محجوزة',
  sold: 'مباعة',
  archived: 'مؤرشفة',
};

export const landCategoryLabels: Record<string, string> = {
  residential: 'سكني',
  commercial: 'تجاري',
  agricultural: 'زراعي',
  investment: 'استثماري',
};

export const landStatusTone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  available: 'success',
  reserved: 'warning',
  sold: 'info',
  archived: 'neutral',
};