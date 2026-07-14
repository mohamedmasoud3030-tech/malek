import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree, ShieldCheck } from 'lucide-react';

// ── Section definitions ───────────────────────────────────────────────────────
//
// These drive both the in-page section nav and the actual content cards. Each
// section card is anchored by its id and renders only the persisted,
// editable fields. Non-persisted preferences stay informational.
export const settingsSections = [
  { id: 'office',      label: 'بيانات المكتب',        icon: Building2      },
  { id: 'identity',    label: 'الهوية والطباعة',      icon: FileSignature  },
  { id: 'documents',   label: 'العقود والفواتير',     icon: FileSignature  },
  { id: 'cost-centers', label: 'مراكز التكلفة',       icon: FolderTree     },
  { id: 'payment-terms', label: 'شروط السداد',        icon: CalendarClock  },
  { id: 'notifications', label: 'الإشعارات والتنبيهات', icon: Bell          },
  { id: 'security',    label: 'الأمان والحساب',       icon: ShieldCheck    },
  { id: 'role-simulator', label: 'محاكي الصلاحيات (Phase 6)', icon: Cog     },
  { id: 'system',      label: 'النظام والبيانات',     icon: Cog           },
] as const;

export type SettingsSectionId = (typeof settingsSections)[number]['id'];
