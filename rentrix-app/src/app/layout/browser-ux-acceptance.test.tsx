// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
import { EmptyState } from '@/components/ui/state-surfaces';
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
    it('active nav item uses logical properties so the indicator state is RTL-safe', () => {
      const html = renderToStaticMarkup(
        <NavigationLinks authorization={adminAuth} expanded sharedLabel={sharedLabel} />,
      );
      // The active state is token-based (border + background + trailing dot),
      // expressed with logical utilities so it mirrors correctly in RTL.
      expect(html).toContain('data-active="true"');
      expect(html).toContain('bg-sidebar-accent');
      expect(html).toContain('ms-auto size-1.5');
    });

    it('child nav items use logical border-s (RTL-aware)', () => {
      const html = renderToStaticMarkup(
        <NavigationLinks authorization={adminAuth} expanded sharedLabel={sharedLabel} />,
      );
      expect(html).toContain('border-s-2');
      expect(html).toContain('border-s-sidebar-border');
    });

    it('mobile floating control exposes accessible names and compact touch targets with balanced tools', () => {
      const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(host.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-search]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-quick-add]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
      const labeled = host.querySelectorAll('button[aria-label]');
      expect(labeled.length).toBeGreaterThanOrEqual(4);
      for (const btn of Array.from(labeled)) {
        expect(btn.className).toMatch(/min-h-(10|11)/);
        expect(btn.className).toMatch(/min-w-(10|11)/);
      }
    });

    it('mobile floating control container has bottom safe-area padding and a compact pill', () => {
      const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
      expect(html).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom');
      expect(html).toContain('data-mobile-floating-control');
      expect(html).toContain('rounded-full');
    });

    it('mobile dock stays phone-only and yields to tablet/desktop chrome', () => {
      const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
      // The dock is hidden at the `md` breakpoint and above (tablet/desktop).
      expect(html).toContain('md:hidden');
    });
  });

  describe('Overflow & break-words hardening', () => {
    it('PageHeader title and description use break-words and overflow-wrap anywhere', () => {
      const html = renderToStaticMarkup(
        <PageHeader title="عنوان طويل جداً جداً جداً قد يسبب تجاوز العرض في الموبايل إذا لم يتم كسر الكلمات" description="وصف طويل جداً يحتوي على نص عربي مختلط مع EnglishLongUnbrokenStringThatCouldOverflowIfNotHandledProperly" />,
      );
      // The h1 truncates on one line (min-w-0 + truncate) and the supporting
      // description wraps anywhere so unbroken strings cannot overflow.
      expect(html).toContain('truncate');
      expect(html).toContain('[overflow-wrap:anywhere]');
    });

    it('DetailFields values use break-words to prevent horizontal overflow', () => {
      const html = renderToStaticMarkup(
        <DetailFields fields={[{ label: 'الملاحظات', value: 'نص طويل جداً جداً مع كلمات طويلة مثل Supercalifragilisticexpialidocious وتجربة عربية طويلة' }]} />,
      );
      expect(html).toContain('break-words');
      expect(html).toContain('[overflow-wrap:anywhere]');
      expect(html).toContain('min-w-0');
    });

    it('EmptyState keeps overflow-safe markup and inherits the document direction', () => {
      const html = renderToStaticMarkup(<EmptyState title="لا توجد سجلات" description="لم يتم العثور على أي نتائج في هذا القسم" />);
      expect(html).toContain('min-w-0');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('break-words');
      expect(html).toContain('data-empty-state');
      expect(html).not.toContain('dir="rtl"');
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
      expect(html).toContain('max-w-full');
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

  describe('Mobile navigation bottom-sheet contract', () => {
    it('AppShell uses the shared BottomSheet primitive rather than a side-drawer implementation', async () => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const shellPath = path.resolve(process.cwd(), 'src/app/layout/app-shell.tsx');
      const sheetPath = path.resolve(process.cwd(), 'src/components/ui/bottom-sheet.tsx');
      const [shell, sheet] = await Promise.all([
        fs.readFile(shellPath, 'utf8'),
        fs.readFile(sheetPath, 'utf8'),
      ]);

      expect(shell).toContain("import { BottomSheet } from '@/components/ui/bottom-sheet'");
      expect(shell).toContain('data-mobile-nav-bottom-sheet');
      expect(shell).not.toContain('data-mobile-drawer');
      expect(shell).not.toContain('w-[85vw]');
      expect(sheet).toContain("document.body.style.overflow = 'hidden'");
      expect(sheet).toContain("document.documentElement.style.overflow = 'hidden'");
      expect(sheet).toContain('data-bottom-sheet');
      expect(sheet).toContain('justify-end');
      expect(sheet).toContain('rounded-t-3xl');
    });
  });
});
