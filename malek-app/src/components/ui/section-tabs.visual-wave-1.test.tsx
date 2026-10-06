// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires an explicit act-capable test environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { SectionTabPanel, SectionTabs } from './section-tabs';

const items = [
  { id: 'overview', label: 'نظرة عامة', icon: () => null },
  { id: 'records', label: 'سجلات التشغيل', icon: () => null },
  { id: 'settings', label: 'الإعدادات', icon: () => null },
] as const;

describe('Visual Wave 1 — section-tabs keyboard and touch contract', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    document.documentElement.dir = 'rtl';
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.documentElement.dir = '';
  });

  it('provides one tab stop, 44px targets, and matching tab/panel identifiers', () => {
    act(() => {
      root.render(
        <>
          <SectionTabs items={items} activeId="overview" onChange={() => undefined} ariaLabel="أقسام أولى" />
          <SectionTabs items={items} activeId="records" onChange={() => undefined} ariaLabel="أقسام ثانية" />
        </>,
      );
    });

    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(2);
    expect(tabs.filter((tab) => tab.className.includes('min-h-11'))).toHaveLength(6);

    // In the one-panel-per-tab mode consumers mount only the active panel, so
    // only the active tab may advertise `aria-controls` — a reference to an
    // absent id is an `aria-valid-attr-value` failure (WCAG 4.1.2).
    for (const tab of tabs) {
      const controls = tab.getAttribute('aria-controls');
      if (tab.getAttribute('aria-selected') === 'true') {
        expect(controls).toBe(`section-panel-${tab.id.replace('section-tab-', '')}`);
      } else {
        expect(controls).toBeNull();
      }
    }
  });

  it('keeps aria-controls, tab ids and panel ids on one prefix', () => {
    act(() => {
      root.render(
        <>
          <SectionTabs items={items} activeId="overview" onChange={() => undefined} ariaLabel="أقسام" idPrefix="dossier" />
          <SectionTabPanel id="overview" activeId="overview" idPrefix="dossier">محتوى</SectionTabPanel>
        </>,
      );
    });

    const activeTab = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
    const panel = host.querySelector<HTMLDivElement>('[role="tabpanel"]');
    expect(activeTab?.id).toBe('dossier-tab-overview');
    expect(panel?.id).toBe('dossier-panel-overview');
    expect(activeTab?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.getAttribute('aria-labelledby')).toBe(activeTab?.id);
  });

  it('lets every tab reference a shared, always-rendered panel', () => {
    act(() => {
      root.render(
        <SectionTabs items={items} activeId="overview" onChange={() => undefined} ariaLabel="أقسام" panelId="shared-panel" />,
      );
    });

    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-controls')).toBe('shared-panel');
    }
  });

  it('moves focus and reports the visual-next tab with RTL arrows, Home, and End', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SectionTabs items={items} activeId="overview" onChange={onChange} ariaLabel="أقسام" />);
    });

    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    tabs[0]?.focus();
    act(() => {
      tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('records');
    expect(document.activeElement).toBe(tabs[1]);

    act(() => {
      tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('settings');
    expect(document.activeElement).toBe(tabs[2]);

    act(() => {
      tabs[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('overview');
    expect(document.activeElement).toBe(tabs[0]);
  });
});
