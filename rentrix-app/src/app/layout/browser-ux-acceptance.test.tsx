// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthorizationContext } from '@/features/auth/permissions';

vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { userId: 'admin-1', email: 'admin@malek.test', role: 'ADMIN' },
  }),
}));
vi.mock('./notifications-menu', () => ({
  NotificationsMenu: () => <button type="button" aria-label="الإشعارات" className="min-h-11 min-w-11">تنبيهات</button>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, ...props }: { children: React.ReactNode; to: string; className?: string } & Record<string, unknown>) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/dashboard', search: {} }),
}));

import { NavigationLinks, MobileFloatingControl } from './layout-navigation-view';
import { EmptyState } from '@/components/empty-state';
import { DetailFields } from '@/components/ui/detail-fields';
import { PageHeader } from '@/components/layout/page-header';
import { PageHeaderActions } from '@/components/layout/page-header-actions';

vi.mock('@/components/ui/bottom-sheet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/bottom-sheet')>();
  return {
    ...actual,
    BottomSheet: ({ children }: { children: React.ReactNode }) => <div data-mock-bottom-sheet>{children}</div>,
  };
});

const adminAuth: AuthorizationContext = {
  userId: 'admin-1',
  email: 'admin@malek.test',
  role: 'ADMIN',
};

const sharedLabel = (key: string) => `label:${key}`;

describe('WP-06 / GAP-020 Browser & UX Acceptance Hardening', () => {
  describe('Navigation RTL & active state', () => {
    it('active nav item includes rtl variant for indicator (shadow flips in RTL)', () => {
      const html = renderToStaticMarkup(
        <NavigationLinks authorization={adminAuth} expanded sharedLabel={sharedLabel} />,
      );
      // The active descriptor should contain both LTR and RTL shadow variants
      // to ensure the indicator is on the logical start side in RTL.
      expect(html).toContain('shadow-[inset_3px_0_0_0');
      expect(html).toContain('rtl:shadow-[inset_-3px_0_0_0');
    });

    it('child nav items use logical border-s (RTL-aware)', () => {
      const html = renderToStaticMarkup(
        <NavigationLinks authorization={adminAuth} expanded sharedLabel={sharedLabel} />,
      );
      expect(html).toContain('border-s-2');
      expect(html).toContain('border-s-sidebar-border');
    });

    it('mobile floating control exposes accessible names and compact touch targets without duplicated menu', () => {
      const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
      const host = document.createElement('div');
      host.innerHTML = html;
      // Menu moved to top toolbar, bottom dock now has only 3 actions
      expect(host.querySelector('[data-mobile-dock-menu]')).toBeNull();
      expect(host.querySelector('[data-mobile-dock-quick-add]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
      const labeled = host.querySelectorAll('button[aria-label]');
      expect(labeled.length).toBeGreaterThanOrEqual(3);
      for (const btn of Array.from(labeled)) {
        expect(btn.className).toMatch(/min-h-(10|11)/);
        expect(btn.className).toMatch(/min-w-(10|11)/);
      }
    });

    it('mobile floating control container has bottom safe-area padding and slimmer height', () => {
      const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
      expect(html).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom');
      expect(html).toContain('data-mobile-floating-control');
      expect(html).toContain('rounded-2xl');
    });
  });

  describe('Overflow & break-words hardening', () => {
    it('PageHeader title and description use break-words and overflow-wrap anywhere', () => {
      const html = renderToStaticMarkup(
        <PageHeader title="عنوان طويل جداً جداً جداً قد يسبب تجاوز العرض في الموبايل إذا لم يتم كسر الكلمات" description="وصف طويل جداً يحتوي على نص عربي مختلط مع EnglishLongUnbrokenStringThatCouldOverflowIfNotHandledProperly" />,
      );
      expect(html).toContain('break-words');
      expect(html).toContain('[overflow-wrap:anywhere]');
      expect(html).toContain('overflow-hidden');
    });

    it('DetailFields values use break-words to prevent horizontal overflow', () => {
      const html = renderToStaticMarkup(
        <DetailFields fields={[{ label: 'الملاحظات', value: 'نص طويل جداً جداً مع كلمات طويلة مثل Supercalifragilisticexpialidocious وتجربة عربية طويلة' }]} />,
      );
      expect(html).toContain('break-words');
      expect(html).toContain('[overflow-wrap:anywhere]');
      expect(html).toContain('min-w-0');
    });

    it('EmptyState has rtl dir and overflow-safe markup', () => {
      const html = renderToStaticMarkup(<EmptyState title="لا توجد سجلات" description="لم يتم العثور على أي نتائج في هذا القسم" />);
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('min-w-0');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('break-words');
      expect(html).toContain('data-empty-state');
    });
  });

  describe('PageHeaderActions mobile overflow guard', () => {
    it('actions rail clamps to viewport to prevent 320px overflow', () => {
      const html = renderToStaticMarkup(
        <PageHeaderActions
          primaryAction={<button type="button">إنشاء عقد</button>}
          secondaryActions={<><button type="button">تصدير CSV</button><button type="button">طباعة</button></>}
        />,
      );
      // Must clamp width on mobile
      expect(html).toContain('max-w-[min(62vw,18rem)]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('data-page-actions');
      expect(html).toContain('data-secondary-actions-desktop');
      expect(html).toContain('data-secondary-overflow-trigger');
    });

    it('mobile overflow trigger has dialog semantics and 44px target', () => {
      const html = renderToStaticMarkup(
        <PageHeaderActions secondaryActions={<button type="button">طباعة</button>} />,
      );
      const host = document.createElement('div');
      host.innerHTML = html;
      const trigger = host.querySelector('button[aria-label="إجراءات إضافية"]');
      expect(trigger).not.toBeNull();
      expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger?.className).toContain('min-h-11');
      expect(trigger?.className).toContain('min-w-11');
    });
  });

  describe('Mobile drawer scroll lock', () => {
    it('drawer component source includes overflow hidden lock and data attribute', async () => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const filePath = path.resolve(process.cwd(), 'src/app/layout/app-shell.tsx');
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain("document.body.style.overflow = 'hidden'");
      expect(content).toContain('document.documentElement.style.overflow = \'hidden\'');
      expect(content).toContain('data-mobile-drawer');
    });
  });
});
