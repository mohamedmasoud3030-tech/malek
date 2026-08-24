import { describe, expect, it, vi } from 'vitest';
import { preventSettingsUnload } from './settings-page';
import { isSettingsSectionId, resolveSettingsSection } from './settingsSections';

vi.mock('./useCompanySettings', () => ({
  useCompanySettings: () => ({ isLoading: true }),
  useUpdateCompanySettings: () => ({ isPending: false }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: null,
    authorizationDiagnostics: {},
    user: null,
  }),
}));

vi.mock('@/store/ui-store', () => ({
  useUiStore: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

describe('SettingsPage workflow helpers', () => {
  it('marks browser unload events as blocked when settings are dirty', () => {
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    preventSettingsUnload(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe('');
  });

  it('registers cost centers as a settings section', async () => {
    const { settingsSections } = await import('./settings-page');

    expect(settingsSections.map((section) => section.id)).toContain('cost-centers');
    expect(settingsSections.map((section) => section.label)).toContain('مراكز التكلفة');
  });

  it('accepts only canonical company-settings section ids and fails safe to office', () => {
    expect(isSettingsSectionId('documents')).toBe(true);
    expect(isSettingsSectionId('finance-readiness')).toBe(true);
    expect(isSettingsSectionId('users-permissions')).toBe(false);
    expect(resolveSettingsSection('documents')).toBe('documents');
    expect(resolveSettingsSection('not-a-section')).toBe('office');
    expect(resolveSettingsSection(null)).toBe('office');
  });
});
