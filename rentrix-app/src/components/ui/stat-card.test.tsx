import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard — خلية القياس المالية الموحدة', () => {
  it('renders label, value, and optional sub', () => {
    const html = renderToStaticMarkup(<StatCard label="المحصّل" value="500 ر.ع" sub="هذا الشهر" />);
    expect(html).toContain('المحصّل');
    expect(html).toContain('500 ر.ع');
    expect(html).toContain('هذا الشهر');
  });

  it('maps every tone through the semantic status tokens', () => {
    const cases = [
      ['success', 'bg-success-bg', 'text-success'],
      ['warning', 'bg-warning-bg', 'text-warning'],
      ['danger', 'bg-danger-bg', 'text-danger'],
      ['info', 'bg-info-bg', 'text-info'],
    ] as const;
    for (const [tone, bg, text] of cases) {
      const html = renderToStaticMarkup(<StatCard label="x" value={1} tone={tone} />);
      expect(html, `${tone} background`).toContain(bg);
      expect(html, `${tone} value color`).toContain(text);
      expect(html, `${tone} data hook`).toContain(`data-tone="${tone}"`);
    }
  });

  it('contains no raw palette colors that ignore the app theme toggle', () => {
    for (const tone of ['default', 'success', 'warning', 'danger', 'info'] as const) {
      const html = renderToStaticMarkup(<StatCard label="x" value={1} tone={tone} />);
      expect(html).not.toMatch(/emerald-|amber-|rose-|sky-/);
      expect(html).not.toContain('dark:bg-');
    }
  });
});
