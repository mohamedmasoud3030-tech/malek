import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let mockedPathname = '/contracts';

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockedPathname,
}));

import { PageIntroLine } from './page-intro-line';

describe('PageIntroLine — سطر الشرح أعلى الصفحة', () => {
  it('يعرض شرح الصفحة الحالية', () => {
    mockedPathname = '/contracts';
    const html = renderToStaticMarkup(<PageIntroLine />);
    expect(html).toContain('data-page-intro');
    expect(html).toContain('العقود');
  });

  it('لا يعرض شيئا في الصفحات اللي ملهاش شرح', () => {
    mockedPathname = '/login';
    const html = renderToStaticMarkup(<PageIntroLine />);
    expect(html).toBe('');
  });
});
