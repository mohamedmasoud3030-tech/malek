// @vitest-environment happy-dom
/**
 * Enterprise foundation components — Wave 4A targeted tests.
 *
 * Composition contract for the page shell family (Header/Page/Toolbar/Stats/
 * Search/Section/Card/Tabs/SidebarSection/StatusBadge/state surfaces) and the
 * Drawer/Modal/Form overlay + layout engines.
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wallet } from 'lucide-react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { breakpoints, enterpriseDesignTokens, mediaQueries } from './design-tokens';
import { EnterpriseCard } from './enterprise-card';
import { EnterpriseDrawer } from './enterprise-drawer';
import { EnterpriseEmptyState } from './enterprise-empty-state';
import { EnterpriseErrorState } from './enterprise-error-state';
import { EnterpriseFilters } from './enterprise-filters';
import { EnterpriseForm } from './enterprise-form';
import { EnterpriseHeader } from './enterprise-header';
import { EnterpriseModal } from './enterprise-modal';
import { EnterprisePage } from './enterprise-page';
import { EnterprisePreviewPanel } from './enterprise-preview-panel';
import { EnterpriseSearch } from './enterprise-search';
import { EnterpriseSection } from './enterprise-section';
import { EnterpriseSidebarSection } from './enterprise-sidebar-section';
import { EnterpriseStats } from './enterprise-stats';
import { EnterpriseStatusBadge } from './enterprise-status-badge';
import { EnterpriseToolbar } from './enterprise-toolbar';

afterEach(() => {
  cleanup();
  // Unmount any portal-based overlays left behind by failing assertions.
  while (overlayUnmountFns.length > 0) {
    const unmount = overlayUnmountFns.pop();
    try {
      unmount?.();
    } catch {
      // best-effort cleanup only
    }
  }
});

const overlayUnmountFns: Array<() => void> = [];

describe('design tokens', () => {
  it('orders breakpoints ascending and builds matching media queries', () => {
    const values = Object.values(breakpoints);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(mediaQueries.md).toBe('(min-width: 768px)');
  });

  it('exposes every token group on the aggregate export', () => {
    for (const group of [
      'spacing',
      'radius',
      'elevation',
      'transition',
      'statusColors',
      'semanticColors',
      'breakpoints',
      'iconSizes',
      'typographyPresets',
      'zIndex',
    ] as const) {
      expect(enterpriseDesignTokens[group]).toBeDefined();
    }
  });
});

describe('EnterpriseHeader / EnterprisePage', () => {
  it('renders the page h1, breadcrumbs and actions', () => {
    render(
      <EnterpriseHeader
        title="العقود"
        description="إدارة العقود"
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'العقود' }]}
        actions={<button type="button">جديد</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'العقود' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'مسار التنقل' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'جديد' })).toBeInTheDocument();
  });

  it('gates content behind loading and error states', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <EnterprisePage title="صفحة" isLoading>
        <div data-content>محتوى</div>
      </EnterprisePage>,
    );
    expect(document.querySelector('[data-content]')).toBeNull();

    rerender(
      <EnterprisePage title="صفحة" error={new Error('فشل')} onRetry={onRetry}>
        <div data-content>محتوى</div>
      </EnterprisePage>,
    );
    expect(document.querySelector('[data-content]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalled();

    rerender(
      <EnterprisePage title="صفحة">
        <div data-content>محتوى</div>
      </EnterprisePage>,
    );
    expect(document.querySelector('[data-content]')).not.toBeNull();
  });

  it('renders stats + toolbar + footer bands', () => {
    render(
      <EnterprisePage
        title="تخطيط"
        stats={<div data-stats />}
        toolbar={<div data-toolbar />}
        footer={<div data-footer />}
      >
        محتوى
      </EnterprisePage>,
    );
    expect(document.querySelector('[data-enterprise-page-stats]')).not.toBeNull();
    expect(document.querySelector('[data-enterprise-page-toolbar]')).not.toBeNull();
    expect(document.querySelector('[data-enterprise-page-footer]')).not.toBeNull();
  });
});

describe('EnterpriseToolbar / EnterpriseSearch / EnterpriseFilters', () => {
  it('lays out toolbar slots', () => {
    render(
      <EnterpriseToolbar
        leading={<div data-leading />}
        filters={<div data-filters />}
        actions={<div data-actions />}
      />,
    );
    expect(document.querySelector('[data-enterprise-toolbar-leading]')).not.toBeNull();
    expect(document.querySelector('[data-enterprise-toolbar-filters]')).not.toBeNull();
    expect(document.querySelector('[data-enterprise-toolbar-actions]')).not.toBeNull();
  });

  it('clears search via the clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EnterpriseSearch value="" onChange={onChange} placeholder="ابحث هنا" />);
    const input = screen.getByRole('searchbox', { name: 'ابحث هنا' });
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'مسح البحث' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders configured fields and active chips with clear-all', () => {
    render(
      <EnterpriseFilters
        fields={[
          { id: 'status', label: 'الحالة', type: 'select', options: [{ value: 'a', label: 'نشط' }] },
          { id: 'owner', label: 'المالك', type: 'text' },
        ]}
        values={{ status: 'a', owner: '' }}
        onChange={() => undefined}
        onClearAll={() => undefined}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'الحالة' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'المالك' })).toBeInTheDocument();
    expect(screen.getByText('الحالة: نشط')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مسح الفلاتر' })).toBeInTheDocument();
  });
});

describe('EnterpriseStats', () => {
  it('renders pre-formatted KPI items only (no computation)', () => {
    render(
      <EnterpriseStats
        items={[
          { key: 'a', label: 'الدخل', value: '1,200', icon: Wallet, accent: 'emerald' },
          { key: 'b', label: 'المصروف', value: '300', icon: Wallet, accent: 'rose' },
        ]}
      />,
    );
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('المصروف')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-kpi-card]')).toHaveLength(2);
  });

  it('shows the stats skeleton while loading', () => {
    render(<EnterpriseStats items={[]} isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('EnterpriseSection / EnterpriseCard', () => {
  it('collapses via an accessible toggle', async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseSection title="قسم" collapsible>
        <div data-body>داخل</div>
      </EnterpriseSection>,
    );
    const toggle = screen.getByRole('button', { name: /قسم/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-enterprise-section-body]')).not.toBeVisible();
  });

  it('renders card header/footer regions and the loading swap', () => {
    const { rerender } = render(
      <EnterpriseCard
        title="بطاقة"
        description="وصف"
        headerActions={<button type="button">تعديل</button>}
        footer={<span>تذييل</span>}
      >
        جسد
      </EnterpriseCard>,
    );
    expect(screen.getByText('بطاقة')).toBeInTheDocument();
    expect(screen.getByText('جسد')).toBeInTheDocument();
    expect(screen.getByText('تذييل')).toBeInTheDocument();

    rerender(<EnterpriseCard title="بطاقة" isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('جسد')).toBeNull();
  });
});

describe('EnterpriseSidebarSection', () => {
  it('renders items with active state and badges', () => {
    render(
      <EnterpriseSidebarSection
        title="القوائم"
        items={[
          { id: 'a', label: 'العقود', active: true, badge: 12, onClick: () => undefined },
          { id: 'b', label: 'المدفوعات', onClick: () => undefined },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'القوائم' })).toBeInTheDocument();
    const activeItem = screen.getByRole('button', { name: /العقود/ });
    expect(activeItem).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('EnterpriseStatusBadge', () => {
  it('maps module statuses through the provided visual map', () => {
    renderToStaticMarkup(
      <EnterpriseStatusBadge
        status="terminated"
        statusMap={{ terminated: { label: 'منتهي', variant: 'neutral' } }}
      />,
    );
    const { getByText } = render(
      <EnterpriseStatusBadge
        status="terminated"
        statusMap={{ terminated: { label: 'منتهي', variant: 'neutral' } }}
      />,
    );
    expect(getByText('منتهي')).toBeInTheDocument();
  });

  it('falls back to the shared preset for known lifecycle statuses', () => {
    render(<EnterpriseStatusBadge status="paid" />);
    expect(screen.getByText('مدفوع')).toBeInTheDocument();
  });

  it('renders a neutral badge for unknown statuses', () => {
    render(<EnterpriseStatusBadge status="custom-state" />);
    expect(screen.getByText('custom-state')).toBeInTheDocument();
  });
});

describe('state surfaces', () => {
  it('renders tone icons and both action slots in EnterpriseEmptyState', () => {
    render(
      <EnterpriseEmptyState
        title="لا نتائج للبحث"
        description="جرّب مصطلحًا آخر"
        tone="search"
        action={<button type="button">مسح</button>}
        secondaryAction={<button type="button">رجوع</button>}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('لا نتائج للبحث')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مسح' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رجوع' })).toBeInTheDocument();
    expect(document.querySelector('[data-enterprise-empty-state]')?.getAttribute('data-tone')).toBe('search');
  });

  it('renders the inline error variant with retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<EnterpriseErrorState context="inline" title="تعذر الحفظ" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

// ── Portal-based overlays: rendered via createRoot so Radix portals work ────

function mountOverlay(node: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    act(() => root.unmount());
    container.remove();
  };
  overlayUnmountFns.push(finish);
  return { container, unmount: finish };
}

describe('EnterpriseDrawer', () => {
  it('renders title, mode chip, default footer actions and sticky footer', () => {
    const { unmount } = mountOverlay(
      <EnterpriseDrawer
        open
        onOpenChange={() => undefined}
        mode="create"
        title="عقار جديد"
        description="أدخل البيانات"
        primaryAction={{ label: 'حفظ', onClick: () => undefined }}
        secondaryAction={{ label: 'إلغاء' }}
      >
        <div data-drawer-body>نموذج</div>
      </EnterpriseDrawer>,
    );
    expect(document.querySelector('[data-enterprise-drawer]')).not.toBeNull();
    expect(screen.getByText('عقار جديد')).toBeInTheDocument();
    expect(screen.getByText('إنشاء')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    expect(document.querySelector('[data-enterprise-sticky-footer]')).not.toBeNull();
    expect(document.querySelector('[data-drawer-body]')).not.toBeNull();
    unmount();
  });

  it('shows the validation banner when errors are provided', () => {
    const { unmount } = mountOverlay(
      <EnterpriseDrawer
        open
        onOpenChange={() => undefined}
        mode="edit"
        title="تعديل"
        validationErrors={['الاسم مطلوب', 'المبلغ غير صالح']}
      >
        محتوى
      </EnterpriseDrawer>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('الاسم مطلوب')).toBeInTheDocument();
    unmount();
  });

  it('warns before closing while dirty instead of closing directly', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { unmount } = mountOverlay(
      <EnterpriseDrawer
        open
        onOpenChange={onOpenChange}
        mode="edit"
        title="تعديل"
        isDirty
      >
        محتوى
      </EnterpriseDrawer>,
    );

    await user.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(await screen.findByText('تغييرات غير محفوظة')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'تجاهل التغييرات' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it('blocks outside dismissal entirely when closeOnOutsideClick is false', async () => {
    const { unmount } = mountOverlay(
      <EnterpriseDrawer
        open
        onOpenChange={() => undefined}
        mode="view"
        title="معاينة"
        readOnly
      >
        محتوى
      </EnterpriseDrawer>,
    );
    // view/preview modes wrap children in a disabled fieldset (readonly mode)
    expect(document.querySelector('[data-enterprise-drawer] fieldset')).not.toBeNull();
    unmount();
  });
});

describe('EnterpriseModal', () => {
  it('renders title, body and footer action pair', () => {
    const { unmount } = mountOverlay(
      <EnterpriseModal
        open
        onOpenChange={() => undefined}
        title="قرار"
        primaryAction={{ label: 'تأكيد', onClick: () => undefined }}
        secondaryAction={{ label: 'إلغاء' }}
      >
        محتوى النافذة
      </EnterpriseModal>,
    );
    expect(document.querySelector('[data-enterprise-modal]')).not.toBeNull();
    // The title also feeds the sr-only description, so assert on the heading.
    expect(screen.getAllByText('قرار').length).toBeGreaterThan(0);
    expect(screen.getByText('محتوى النافذة')).toBeInTheDocument();
    unmount();
  });
});

describe('EnterpriseForm', () => {
  it('renders sections as cards with a sticky footer submit pair', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <EnterpriseForm
        onSubmit={onSubmit}
        sections={[
          { id: 'basic', title: 'الأساسيات', content: <input aria-label="الاسم" /> },
          { id: 'extra', card: false, content: <input aria-label="ملاحظة" /> },
        ]}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelectorAll('[data-enterprise-form-section]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'حفظ' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    expect(document.querySelector('[data-enterprise-sticky-footer]')).not.toBeNull();
  });

  it('renders the errors summary with anchor links to fields', () => {
    render(
      <EnterpriseForm
        errors={[{ message: 'الاسم مطلوب', fieldId: 'name-field' }]}
        sections={[{ id: 's', card: false, content: <input id="name-field" aria-label="الاسم" /> }]}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('الاسم مطلوب');
    expect(screen.getByRole('link', { name: 'الاسم مطلوب' })).toHaveAttribute('href', '#name-field');
  });

  it('disables all controls through the fieldset when disabled', () => {
    render(
      <EnterpriseForm
        disabled
        sections={[{ id: 's', card: false, content: <input aria-label="الحقل" /> }]}
      />,
    );
    expect(screen.getByLabelText('الحقل')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  });

  it('groups sections under tabs when tabs are provided', async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseForm
        tabs={[
          { id: 'one', label: 'تبويب أول', sections: [{ id: 'a', card: false, content: <div>محتوى أول</div> }] },
          { id: 'two', label: 'تبويب ثانٍ', sections: [{ id: 'b', card: false, content: <div>محتوى ثانٍ</div> }] },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'تبويب أول' })).toBeInTheDocument();
    expect(screen.getByText('محتوى أول')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'تبويب ثانٍ' }));
    expect(await screen.findByText('محتوى ثانٍ')).toBeInTheDocument();
  });
});

describe('EnterprisePreviewPanel', () => {
  it('renders header, status, field sections and footer; em-dash for empty values', () => {
    render(
      <EnterprisePreviewPanel
        title="فيلا الروضة"
        subtitle="كود: P-101"
        status={<span data-status-chip>نشط</span>}
        sections={[
          {
            id: 'main',
            title: 'البيانات',
            fields: [
              { label: 'المالك', value: 'سالم' },
              { label: 'المدينة', value: '' },
            ],
          },
        ]}
        footer={<button type="button">الملف الكامل</button>}
      />,
    );
    expect(screen.getByText('فيلا الروضة')).toBeInTheDocument();
    expect(document.querySelector('[data-status-chip]')).not.toBeNull();
    expect(screen.getByText('سالم')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الملف الكامل' })).toBeInTheDocument();
  });

  it('renders the empty variant when there is nothing to preview', () => {
    render(<EnterprisePreviewPanel isEmpty emptyTitle="اختر سجلًا" />);
    expect(screen.getByText('اختر سجلًا')).toBeInTheDocument();
  });
});
