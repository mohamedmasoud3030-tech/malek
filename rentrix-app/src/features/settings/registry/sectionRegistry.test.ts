import { describe, expect, it } from 'vitest';
import {
  getCompanySettingsSectionFieldOwners,
  getSettingsSection,
  getVisibleSettingsSections,
  isSettingsSectionId,
  resolveSettingsSection,
  settingsSectionRegistry,
  settingsSections,
} from './sectionRegistry';
import type { SettingsSectionId } from './types';
import {
  companySettingsDraftFields,
  companySettingsSectionDraftFields,
  type CompanySettingsDraftField,
} from '../form/sectionDrafts';

const canonicalSectionIds = [
  'office',
  'identity',
  'documents',
  'finance-readiness',
  'cost-centers',
  'payment-terms',
  'notifications',
  'system',
] as const;

const routineSectionIds = ['office', 'identity', 'documents', 'notifications', 'system'] as const;

describe('settings section registry', () => {
  it('registers exactly the eight supported settings sections in stable order', () => {
    expect(settingsSectionRegistry.map((section) => section.id)).toEqual([...canonicalSectionIds]);
    expect(settingsSections.map((section) => section.id)).toEqual([...canonicalSectionIds]);
  });

  it('keeps routine navigation focused while specialist setup remains registered', () => {
    expect(getVisibleSettingsSections().map((section) => section.id)).toEqual([...routineSectionIds]);
    expect(settingsSectionRegistry.filter((section) => !section.showInPrimaryNavigation).map((section) => section.id))
      .toEqual(['finance-readiness', 'cost-centers', 'payment-terms']);
    for (const id of ['finance-readiness', 'cost-centers', 'payment-terms'] as const) {
      expect(getSettingsSection(id)).toBeDefined();
    }
  });

  it('keeps stable Arabic labels, descriptions, and icons on the compatibility surface', () => {
    const byId = new Map(settingsSections.map((section) => [section.id, section]));

    expect(byId.get('cost-centers')?.label).toBe('مراكز التكلفة');
    expect(byId.get('payment-terms')?.label).toBe('شروط السداد');
    expect(byId.get('documents')?.label).toBe('المستندات والضريبة');
    expect(byId.get('notifications')?.label).toBe('الإشعارات والتنبيهات');
    expect(byId.get('system')?.label).toBe('المظهر والواجهة');

    for (const section of settingsSections) {
      expect(section.description.length).toBeGreaterThan(0);
      expect(section.icon).toBeTruthy();
    }
  });

  it('resolves sections by id and fails safe to office for unknown values', () => {
    expect(getSettingsSection('office')?.label).toBe('بيانات المكتب');
    expect(getSettingsSection('not-a-section' as SettingsSectionId)).toBeUndefined();
    expect(isSettingsSectionId('documents')).toBe(true);
    expect(isSettingsSectionId('users-permissions')).toBe(false);
    expect(resolveSettingsSection('documents')).toBe('documents');
    expect(resolveSettingsSection('finance-readiness')).toBe('finance-readiness');
    expect(resolveSettingsSection('payment-terms')).toBe('payment-terms');
    expect(resolveSettingsSection('not-a-section')).toBe('office');
    expect(resolveSettingsSection(null)).toBe('office');
  });

  it('lazily loads each section component without throwing at registry time', () => {
    for (const section of settingsSectionRegistry) {
      expect(section.component).toBeTypeOf('object');
      expect(section.component.$$typeof).toBeDefined();
    }
  });

  it('owns every persisted company-settings draft field through exactly one section', () => {
    const owners = getCompanySettingsSectionFieldOwners();
    const ownedFields = Object.keys(owners) as CompanySettingsDraftField[];

    expect(ownedFields.sort()).toEqual([...companySettingsDraftFields].sort());

    const allRegistryFields = settingsSectionRegistry.flatMap((section) => section.fields);
    const duplicateFields = allRegistryFields.filter(
      (field, index) => allRegistryFields.indexOf(field) !== index,
    );
    expect(duplicateFields).toEqual([]);
  });

  it('maps form sections to their historical field slices', () => {
    expect([...settingsSectionRegistry.find((section) => section.id === 'office')?.fields ?? []]).toEqual([
      ...companySettingsSectionDraftFields.office,
    ]);
    expect([...settingsSectionRegistry.find((section) => section.id === 'identity')?.fields ?? []]).toEqual([
      ...companySettingsSectionDraftFields.identity,
    ]);
    expect([...settingsSectionRegistry.find((section) => section.id === 'documents')?.fields ?? []]).toEqual([
      ...companySettingsSectionDraftFields.documents,
    ]);
    expect([...settingsSectionRegistry.find((section) => section.id === 'notifications')?.fields ?? []]).toEqual([
      ...companySettingsSectionDraftFields.notifications,
    ]);
  });

  it('leaves non-form sections without draft fields', () => {
    for (const id of ['finance-readiness', 'cost-centers', 'payment-terms', 'system'] as const) {
      expect(getSettingsSection(id)?.fields).toEqual([]);
      expect(getSettingsSection(id)?.kind).not.toBe('form');
    }
  });
});
