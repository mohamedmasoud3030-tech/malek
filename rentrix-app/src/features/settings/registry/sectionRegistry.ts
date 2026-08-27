import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree, ShieldAlert, type LucideIcon } from 'lucide-react';
import {
  companySettingsSectionDraftFields,
  type CompanySettingsDraftField,
  type CompanySettingsSectionDraftId,
} from '../form/sectionDrafts';
import type { SettingsSectionId, SettingsSectionKind, SettingsSectionRenderProps } from './types';

/**
 * Declarative Settings registry. All sections remain supported; the primary
 * navigation flag keeps specialist setup out of the routine office-settings UI
 * without deleting deep links or the underlying capability.
 */
export type SettingsSectionDefinition = Readonly<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  kind: SettingsSectionKind;
  fields: readonly CompanySettingsDraftField[];
  component: LazyExoticComponent<ComponentType<SettingsSectionRenderProps>>;
  showInPrimaryNavigation: boolean;
  featureFlag?: string;
  migration?: (legacyDraft: unknown) => unknown;
}>;

function isFormSection(id: SettingsSectionId): id is CompanySettingsSectionDraftId {
  return (companySettingsSectionDraftFields as Record<string, unknown>)[id] !== undefined;
}

function draftFieldsFor(id: SettingsSectionId): readonly CompanySettingsDraftField[] {
  return isFormSection(id) ? companySettingsSectionDraftFields[id] : [];
}

export const settingsSectionRegistry: readonly SettingsSectionDefinition[] = [
  {
    id: 'office',
    label: 'بيانات المكتب',
    description: 'هوية المكتب وبيانات التواصل والعنوان.',
    icon: Building2,
    kind: 'form',
    fields: draftFieldsFor('office'),
    showInPrimaryNavigation: true,
    component: lazy(() => import('../sections/OfficeSection').then((module) => ({ default: module.OfficeSection }))),
  },
  {
    id: 'identity',
    label: 'الهوية والطباعة',
    description: 'العملة واللغة والشعار وصيغ العرض.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('identity'),
    showInPrimaryNavigation: true,
    component: lazy(() => import('../sections/IdentitySection').then((module) => ({ default: module.IdentitySection }))),
  },
  {
    id: 'documents',
    label: 'المستندات والضريبة',
    description: 'بادئات المستندات وبيانات الضريبة المستخدمة في المستندات.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('documents'),
    showInPrimaryNavigation: true,
    component: lazy(() => import('../sections/DocumentsSection').then((module) => ({ default: module.DocumentsSection }))),
  },
  {
    id: 'finance-readiness',
    label: 'جاهزية المالية والضريبة',
    description: 'مراجعة متخصصة لإعدادات التشغيل المالي والضريبي.',
    icon: ShieldAlert,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
    component: lazy(() => import('../sections/FinanceReadinessSection').then((module) => ({ default: module.SettingsFinanceReadinessSection }))),
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'تصنيف المصروفات والتقارير تشغيلياً.',
    icon: FolderTree,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
    component: lazy(() => import('../sections/CostCentersSection').then((module) => ({ default: module.CostCentersSection }))),
  },
  {
    id: 'payment-terms',
    label: 'شروط السداد',
    description: 'قوالب جداول السداد المستخدمة في العقود.',
    icon: CalendarClock,
    kind: 'operations',
    fields: [],
    showInPrimaryNavigation: false,
    component: lazy(() => import('../sections/PaymentTermsSection').then((module) => ({ default: module.PaymentTermsSection }))),
  },
  {
    id: 'notifications',
    label: 'الإشعارات والتنبيهات',
    description: 'قنوات المتابعة المسجلة للمكتب.',
    icon: Bell,
    kind: 'form',
    fields: draftFieldsFor('notifications'),
    showInPrimaryNavigation: true,
    component: lazy(() => import('../sections/NotificationsSection').then((module) => ({ default: module.NotificationsSection }))),
  },
  {
    id: 'system',
    label: 'المظهر والواجهة',
    description: 'السمة ولغة الواجهة ومعاينة الأسطح.',
    icon: Cog,
    kind: 'system',
    fields: [],
    showInPrimaryNavigation: true,
    component: lazy(() => import('../sections/SystemSection').then((module) => ({ default: module.SystemSection }))),
  },
] as const;

export type SettingsSectionRegistry = ReadonlyArray<SettingsSectionDefinition>;

export function getSettingsSection(id: SettingsSectionId): SettingsSectionDefinition | undefined {
  return settingsSectionRegistry.find((section) => section.id === id);
}

export function getVisibleSettingsSections(): readonly SettingsSectionDefinition[] {
  return settingsSectionRegistry.filter((section) => section.showInPrimaryNavigation);
}

export function getSettingsSectionDraftFields(id: SettingsSectionId): readonly CompanySettingsDraftField[] {
  return getSettingsSection(id)?.fields ?? [];
}

export function getCompanySettingsSectionFieldOwners(): Readonly<Record<CompanySettingsDraftField, SettingsSectionId>> {
  const owners = {} as Record<CompanySettingsDraftField, SettingsSectionId>;

  for (const section of settingsSectionRegistry) {
    for (const field of section.fields) {
      owners[field] = section.id;
    }
  }

  return owners;
}

export type SettingsSectionListItem = Pick<SettingsSectionDefinition, 'id' | 'label' | 'description' | 'icon'>;

/** Full compatibility surface; callers choose whether to show routine-only sections. */
export const settingsSections: readonly SettingsSectionListItem[] = settingsSectionRegistry.map((section) => ({
  id: section.id,
  label: section.label,
  description: section.description,
  icon: section.icon,
}));

const settingsSectionIdSet = new Set<string>(settingsSectionRegistry.map((section) => section.id));

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && settingsSectionIdSet.has(value);
}

export function resolveSettingsSection(value: unknown, fallback: SettingsSectionId = 'office'): SettingsSectionId {
  return isSettingsSectionId(value) ? value : fallback;
}
