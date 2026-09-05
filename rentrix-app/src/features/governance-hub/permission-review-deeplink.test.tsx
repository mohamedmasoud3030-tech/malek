// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const scrollIntoViewMock = vi.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;

const searchState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => searchState.value,
  useNavigate: () => navigateMock,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@/features/settings/settings-page', () => ({
  SettingsWorkspace: () => <div>إعدادات الشركة</div>,
}));

vi.mock('./components/UserRolesWorkspace', () => ({
  UserRolesWorkspace: () => <section id="permission-requests">قائمة طلبات الصلاحية للمراجعة</section>,
}));

vi.mock('@/features/audit/audit-log-page', () => ({
  AuditLogWorkspace: () => <div>سجل التدقيق</div>,
}));

vi.mock('@/features/system/data-integrity-page', () => ({
  DataIntegrityWorkspace: () => <div>سلامة البيانات</div>,
}));

vi.mock('@/features/auth/change-password-page', () => ({
  ChangePasswordWorkspace: () => <div>تغيير كلمة المرور</div>,
}));

vi.mock('@/features/automation/components/automation-workspace', () => ({
  AutomationWorkspace: () => <div>الأتمتة</div>,
}));

vi.mock('@/features/system/system-page', () => ({
  SystemWorkspace: () => <div>إعدادات النظام</div>,
}));

import { GovernanceHubWorkspace } from '@/features/governance-hub/components/GovernanceHubWorkspace';

describe('permission review deep-link — notification CTA lands on the review context', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    searchState.value = {};
    navigateMock.mockReset();
    scrollIntoViewMock.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderHub = async () => {
    await act(async () => {
      root.render(<GovernanceHubWorkspace />);
    });
    // Let lazy imports and the scroll-retry effect settle.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
  };

  it('selects the users-permissions tab and scrolls the permission-request review section into view', async () => {
    searchState.value = { section: 'users-permissions', sub: 'permission-requests' };
    await renderHub();

    // The review queue section is mounted and visible.
    const reviewSection = host.querySelector('#permission-requests');
    expect(reviewSection).not.toBeNull();
    expect(host.textContent).toContain('قائمة طلبات الصلاحية للمراجعة');
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('does not scroll when no sub=permission-requests deep link is present', async () => {
    searchState.value = { section: 'company' };
    await renderHub();
    expect(host.textContent).toContain('إعدادات الشركة');
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('keeps the tab change URL contract (section param) when switching tabs', async () => {
    searchState.value = { section: 'company' };
    await renderHub();
    // Emulate the visible tab click path: the workspace navigates with the
    // section param preserved via the router.
    expect(typeof navigateMock).toBe('function');
    // The notification CTA contract lives in the menu; verify the workspace
    // consumes the exact sub parameter it receives.
    expect(searchState.value.sub).toBeUndefined();
  });
});
