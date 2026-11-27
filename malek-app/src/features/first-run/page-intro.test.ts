import { describe, expect, it } from 'vitest';
import { PAGE_INTROS, resolvePageIntro } from './page-intro';

describe('resolvePageIntro — شرح سطر واحد لكل صفحة', () => {
  it('يعطي شرحا لكل صفحة رئيسية في النظام', () => {
    const mainRoutes = [
      '/dashboard',
      '/properties',
      '/lands',
      '/owners',
      '/tenants',
      '/people',
      '/leads',
      '/communication',
      '/contracts',
      '/financials',
      '/commissions',
      '/receipts',
      '/reports',
      '/ai-assistant',
      '/help',
      '/maintenance',
      '/service-providers',
      '/utilities',
      '/documents-vault',
      '/settings',
    ];
    for (const route of mainRoutes) {
      expect(resolvePageIntro(route), route).toBeTruthy();
    }
  });

  it('يغطي صفحات التفاصيل بشرح الصفحة الأم', () => {
    expect(resolvePageIntro('/properties/abc-123')).toBe(resolvePageIntro('/properties'));
    expect(resolvePageIntro('/contracts/c-9/edit')).toBe(resolvePageIntro('/contracts'));
    expect(resolvePageIntro('/settings/audit-log')).toBe(resolvePageIntro('/settings'));
  });

  it('يفضل البادئة الأطول للصفحات المتخصصة', () => {
    expect(resolvePageIntro('/properties/new')).toBe(
      PAGE_INTROS.find((entry) => entry.path === '/properties/new')?.intro,
    );
    expect(resolvePageIntro('/contracts/new')).toBe(
      PAGE_INTROS.find((entry) => entry.path === '/contracts/new')?.intro,
    );
  });

  it('لا يطابق على حدود جزئية من اسم المسار', () => {
    expect(resolvePageIntro('/propertiesx')).toBeNull();
  });

  it('يرجع null للصفحات خارج النظام فميظهرش سطر زيادة', () => {
    expect(resolvePageIntro('/login')).toBeNull();
    expect(resolvePageIntro('/')).toBeNull();
  });

  it('كل شرح جملة واحدة قصيرة بالعربي', () => {
    for (const entry of PAGE_INTROS) {
      expect(entry.path.startsWith('/')).toBe(true);
      expect(entry.intro.length).toBeLessThanOrEqual(90);
      expect(entry.intro).toMatch(/[؀-ۿ]/);
    }
  });
});
