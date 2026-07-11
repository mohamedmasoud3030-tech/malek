// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { automationRulesCatalog, automationTemplatePreviews } from './automation-catalog';
import { AutomationCenterView } from './components/automation-center-view';

describe('Automation Center catalog', () => {
  it('covers contract, rent, owner, and maintenance automation surfaces', () => {
    const categories = new Set(automationRulesCatalog.map((rule) => rule.category));
    expect(categories.has('contracts')).toBe(true);
    expect(categories.has('rent')).toBe(true);
    expect(categories.has('owners')).toBe(true);
    expect(categories.has('maintenance')).toBe(true);
    expect(automationTemplatePreviews.length).toBeGreaterThan(0);
  });
});

describe('AutomationCenterView', () => {
  it('renders the product-facing automation center shell', () => {
    const html = renderToStaticMarkup(<AutomationCenterView />);
    expect(html).toContain('مركز الأتمتة');
    expect(html).toContain('تذكير انتهاء العقود');
    expect(html).toContain('قوالب الإشعارات');
  });
});
