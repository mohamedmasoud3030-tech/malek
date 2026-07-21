// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterTabs } from './filter-tabs';

type TestFilter = 'all' | 'active' | 'expired';

const options: Array<{ value: TestFilter; label: string; count?: number }> = [
  { value: 'all', label: 'الكل', count: 9 },
  { value: 'active', label: 'نشط', count: 4 },
  { value: 'expired', label: 'منتهي' },
];

describe('FilterTabs — ترميز الحالة وإتاحة الوصول', () => {
  it('renders every option with counts inside a labelled group', () => {
    const html = renderToStaticMarkup(<FilterTabs options={options} value="all" onChange={() => undefined} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="خيارات التصفية"');
    expect(html).toContain('الكل');
    expect(html).toContain('نشط');
    expect(html).toContain('منتهي');
    expect(html).toContain('>9<');
    expect(html).toContain('>4<');
  });

  it('marks the selected option with aria-pressed and the active token classes', () => {
    const html = renderToStaticMarkup(<FilterTabs options={options} value="active" onChange={() => undefined} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    const activeStart = html.lastIndexOf('<button', html.indexOf('aria-pressed="true"'));
    const activeEnd = html.indexOf('</button>', activeStart);
    const activeButton = html.slice(activeStart, activeEnd);
    expect(activeButton).toContain('bg-primary/10');
    expect(activeButton).toContain('text-primary');
    expect(activeButton).toContain('نشط');
  });

  it('keeps touch-target height on every tab (min-h-11)', () => {
    const html = renderToStaticMarkup(<FilterTabs options={options} value="all" onChange={() => undefined} />);
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('FilterTabs — التفاعل', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<FilterTabs options={options} value="all" onChange={onChange} />);
    });
    const buttons = Array.from(container.querySelectorAll('button'));
    const target = buttons.find((b) => b.textContent?.includes('منتهي'));
    expect(target).toBeDefined();
    act(() => {
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('expired');
  });
});
