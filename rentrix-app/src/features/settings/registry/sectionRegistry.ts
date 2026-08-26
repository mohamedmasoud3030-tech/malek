import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree, ShieldAlert, type LucideIcon } from 'lucide-react';
import {
  companySettingsSectionDraftFields,
  type CompanySettingsDraftField,
  type CompanySettingsSectionDraftId,
} from '../form/sectionDrafts';
import type { SettingsSectionId, SettingsSectionKind, SettingsSectionRenderProps } from './types';

/**
 * WP-D D.1 — declarative settings section registry.
 *
 * Replaces the old static `settingsSections.ts` array as the single source of
 * truth for the Settings workspace: section identity (id/label/description/
 * icon), ownership kind, owned draft fields, and the lazily-loaded section
 * component. `settings-page.tsx` composes the workspace by iterating this
 * registry (D.5); navigation, deep links, and summary tiles consume the
 * compatibility `settingsSections` export below.
 *
 * Each entry supports the plan's extensibility seams without enabling them
 * today: `featureFlag` (gate a section behind a flag) and `migration`
 * (translate a legacy whole-record draft into a section slice).
 */
export type SettingsSectionDefinition = Readonly<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  kind: SettingsSectionKind;
  /** Company-settings draft fields owned by this section (empty for non-form sections). */
  fields: readonly CompanySettingsDraftField[];
  component: LazyExoticComponent<ComponentType<SettingsSectionRenderProps>>;
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
    component: lazy(() => import('../sections/OfficeSection').then((module) => ({ default: module.OfficeSection }))),
  },
  {
    id: 'identity',
    label: 'الهوية والطباعة',
    description: 'العملة واللغة والشعار وصيغ العرض.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('identity'),
    component: lazy(() => import('../sections/IdentitySection').then((module) => ({ default: module.IdentitySection }))),
  },
  {
    id: 'documents',
    label: 'المستندات والضريبة',
    description: 'بادئات المستندات والبيانات الضريبية المرجعية؛ السياسة الضريبية الفعلية تُحسم من السلطات المعتمدة حسب التاريخ.',
    icon: FileSignature,
    kind: 'form',
    fields: draftFieldsFor('documents'),
    component: lazy(() => import('../sections/DocumentsSection').then((module) => ({ default: module.DocumentsSection }))),
  },
  {
    id: 'finance-readiness',
    label: 'جاهزية المالية والضريبة',
    description: 'السلطة الضريبية المعتمدة حسب التاريخ (إيجار وأتعاب)، فترات محاسبية، ودليل الحسابات — فشل مغلق عند النقص.',
    icon: ShieldAlert,
    kind: 'operations',
    fields: [],
    component: lazy(() => import('../sections/FinanceReadinessSection').then((module) => ({ default: module.SettingsFinanceReadinessSection }))),
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'تصنيف المصروفات والتقارير تشغيلياً.',
    icon: FolderTree,
    kind: 'operations',
    fields: [],
    component: lazy(() => import('../sections/CostCentersSection').then((module) => ({ default: module.CostCentersSection }))),
  },
  {
    id: 'payment-terms',
    label: 'شروط السداد',
    description: 'قوالب جداول السداد المستخدمة في العقود.',
    icon: CalendarClock,
    kind: 'operations',
    fields: [],
    component: lazy(() => import('../sections/PaymentTermsSection').then((module) => ({ default: module.PaymentTermsSection }))),
  },
  {
    id: 'notifications',
    label: 'الإشعارات والتنبيهات',
    description: 'قنوات المتابعة المسجلة للمكتب.',
    icon: Bell,
    kind: 'form',
    fields: draftFieldsFor('notifications'),
    component: lazy(() => import('../sections/NotificationsSection').then((module) => ({ default: module.NotificationsSection }))),
  },
  {
    id: 'system',
    label: 'المظهر والواجهة',
    description: 'السمة ولغة الواجهة ومعاينة الأسطح.',
    icon: Cog,
    kind: 'system',
    fields: [],
    component: lazy(() => import('../sections/SystemSection').then((module) => ({ default: module.SystemSection }))),
  },
] as const;

export type SettingsSectionRegistry = ReadonlyArray<SettingsSectionDefinition>;

export function getSettingsSection(id: SettingsSectionId): SettingsSectionDefinition | undefined {
  return settingsSectionRegistry.find((section) => section.id === id);
}

export function getSettingsSectionDraftFields(id: SettingsSectionId): readonly CompanySettingsDraftField[] {
  return getSettingsSection(id)?.fields ?? [];
}

/**
 * Field ownership contract: every persisted company-settings field maps to the
 * section that owns it. Consumers (validation, dirty tracking, section
 * persistence) derive ownership from this instead of duplicating field lists.
 */
export function getCompanySettingsSectionFieldOwners(): Readonly<Record<CompanySettingsDraftField, SettingsSectionId>> {
  const owners = {} as Record<CompanySettingsDraftField, SettingsSectionId>;

  for (const section of settingsSectionRegistry) {
    for (const field of section.fields) {
      owners[field] = section.id;
    }
  }

  return owners;
}

/* ------------------------------------------------------------------ */
/* Compatibility surface (previously `settingsSections.ts`)           */
/* ------------------------------------------------------------------ */

export type SettingsSectionListItem = Pick<SettingsSectionDefinition, 'id' | 'label' | 'description' | 'icon'>;

/** Navigation/label shape — identical to the historical `settingsSections`. */
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
