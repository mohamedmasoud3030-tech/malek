import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree, ShieldAlert, type LucideIcon } from 'lucide-react';
import {
  companySettingsSectionDraftFields,
  type CompanySettingsDraftField,
  type CompanySettingsSectionDraftId,
} from '../form/sectionDrafts';
import type { SettingsSectionId, SettingsSectionKind } from './types';

/**
 * Declarative Settings catalogue — metadata only.
 *
 * This module is a leaf: it must never import a section component, so leaf
 * components (SectionCard, the workspace nav) can read the catalogue without
 * closing a module cycle back through the lazy component registry. The
 * component side lives in `sectionRegistry.ts`.
 *
 * All sections remain supported; `showInPrimaryNavigation` only keeps
 * specialist setup out of the routine office-settings UI without deleting
 * deep links or the underlying capability.
 */
export type SettingsSectionDefinitionBase = Readonly<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  kind: SettingsSectionKind;
  fields: readonly CompanySettingsDraftField[];
  showInPrimaryNavigation: boolean;
}>;

export function isFormSection(id: SettingsSectionId): id is CompanySettingsSectionDraftId {
  return (companySettingsSectionDraftFields as Record<string, unknown>)[id] !== undefined;
}

export function draftFieldsFor(id: SettingsSectionId): readonly CompanySettingsDraftField[] {
  return isFormSection(id) ? companySettingsSectionDraftFields[id] : [];
}

export const settingsSectionCatalog: readonly SettingsSectionDefinitionBase[] = [
  {
    id: 'office',
    label: 'بيانات المكتب',
    description: 'هوية المكتب وبيانات التواصل والعنوان.',
    icon: Building2,
    kind: 'form',
    fields: draftFieldsFor('office'),
    showInPrimaryNavigation: true,
  },
  {
    id: 'identity',
    label: 'الهوية والطباعة',
    description: 'العملة واللغة والشعار وصيغ العرض.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('identity'),
    showInPrimaryNavigation: true,
  },
  {
    id: 'documents',
    label: 'المستندات والضريبة',
    description: 'بادئات المستندات وبيانات الضريبة المستخدمة في المستندات.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('documents'),
    showInPrimaryNavigation: true,
  },
  {
    id: 'finance-readiness',
    label: 'جاهزية المالية والضريبة',
    description: 'مراجعة متخصصة لإعدادات التشغيل المالي والضريبي.',
    icon: ShieldAlert,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'تصنيف المصروفات والتقارير تشغيلياً.',
    icon: FolderTree,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
  },
  {
    id: 'payment-terms',
    label: 'شروط السداد',
    description: 'قوالب جداول السداد المستخدمة في العقود.',
    icon: CalendarClock,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
  },
  {
    id: 'notifications',
    label: 'الإشعارات والتنبيهات',
    description: 'قنوات المتابعة المسجلة للمكتب.',
    icon: Bell,
    kind: 'form',
    fields: draftFieldsFor('notifications'),
    showInPrimaryNavigation: true,
  },
  {
    id: 'system',
    label: 'المظهر والواجهة',
    description: 'السمة ولغة الواجهة ومعاينة الأسطح.',
    icon: Cog,
    kind: 'system',
    fields: [],
    showInPrimaryNavigation: true,
  },
] as const;

export type SettingsSectionListItem = Pick<SettingsSectionDefinitionBase, 'id' | 'label' | 'description' | 'icon'>;

/** Full compatibility surface; callers choose whether to show routine-only sections. */
export const settingsSections: readonly SettingsSectionListItem[] = settingsSectionCatalog.map((section) => ({
  id: section.id,
  label: section.label,
  description: section.description,
  icon: section.icon,
}));

const settingsSectionIdSet = new Set<string>(settingsSectionCatalog.map((section) => section.id));

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && settingsSectionIdSet.has(value);
}

export function resolveSettingsSection(value: unknown, fallback: SettingsSectionId = 'office'): SettingsSectionId {
  return isSettingsSectionId(value) ? value : fallback;
}
