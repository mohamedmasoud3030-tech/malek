// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import axe from 'axe-core';
import { Home } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { EntityCard } from './entity-card';
import { EntityForm } from './entity-form';
import { ErrorState } from './error-state';
import { FilterTabs } from './filter-tabs';
import { Input } from './input';
import { KpiCard } from './kpi-card';
import { LoadingState } from './loading-state';
import { SearchInput } from './search-input';
import { SectionTabPanel, SectionTabs } from './section-tabs';
import { Select } from './select';
import { EmptyState, NoPermissionState, OfflineState } from './state-surfaces';
import { StatusBadge } from './status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Textarea } from './textarea';

afterEach(cleanup);
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'target-size'] as const;

async function expectNoViolations(ui: ReactElement) {
  const { container } = render(ui);
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
  });
  const report = results.violations.map((violation) => {
    const nodes = violation.nodes.map((node) => `      ${node.html}`).join('\n');
    return `  ${violation.id} (${violation.impact}): ${violation.help}\n${nodes}`;
  });
  expect(report.join('\n'), `axe violations:\n${report.join('\n')}`).toBe('');
}

const cases: ReadonlyArray<readonly [string, ReactElement]> = [
  ['Button', <div><Button>حفظ</Button><Button loading>حفظ</Button><Button variant="danger">حذف</Button></div>],
  ['SearchInput', <SearchInput value="بحث" onChange={() => {}} />],
  ['FilterTabs', <FilterTabs options={[{ value: 'all', label: 'الكل' }, { value: 'active', label: 'نشط' }]} value="all" onChange={() => {}} />],
  ['SectionTabs', <><SectionTabs items={[{ id: 'a', label: 'نظرة عامة', icon: Home }]} activeId="a" onChange={() => {}} ariaLabel="أقسام" /><SectionTabPanel id="a" activeId="a">المحتوى</SectionTabPanel></>],
  ['SectionTabs icon-less rail', <><SectionTabs items={[{ id: 'period', label: 'المستحق والتحصيل' }, { id: 'arrears', label: 'المتأخرات والأعمار' }]} activeId="period" onChange={() => {}} ariaLabel="أجزاء التقرير" idPrefix="report-product" /><SectionTabPanel id="period" activeId="period" idPrefix="report-product">المحتوى</SectionTabPanel></>],
  ['EntityForm', <EntityForm.Root><EntityForm.Section title="بيانات"><EntityForm.Field label="رقم العقد" description="فريد" error="مطلوب"><Input /></EntityForm.Field><EntityForm.Field label="الحالة"><Select><option>نشط</option></Select></EntityForm.Field><EntityForm.Field label="ملاحظات"><Textarea /></EntityForm.Field></EntityForm.Section><EntityForm.Actions submitLabel="حفظ" onCancel={() => {}} /></EntityForm.Root>],
  ['EntityFormField', <EntityForm.Root><EntityForm.Field label="اسم العقار" required error="مطلوب" hint="بيانات السجل"><Input /></EntityForm.Field></EntityForm.Root>],
  ['States', <div><EmptyState title="لا توجد بيانات" description="لا توجد سجلات متاحة حاليًا" /><OfflineState title="غير متصل" description="تحقق من اتصال الشبكة ثم أعد المحاولة" /><NoPermissionState title="لا صلاحية" description="ليس لديك صلاحية لعرض هذا المحتوى" /><ErrorState title="خطأ" /><LoadingState /></div>],
  ['KpiCard', <KpiCard label="الإيراد" value="1,234.500 OMR" icon={Home} />],
  ['Badges', <div><Badge>نشط</Badge><StatusBadge tone="success">نشط</StatusBadge></div>],
  ['Alert', <Alert><AlertTitle>تنبيه</AlertTitle><AlertDescription>وصف</AlertDescription></Alert>],
  ['Card', <Card><CardHeader><CardTitle>عنوان</CardTitle></CardHeader><CardContent>محتوى</CardContent></Card>],
  ['EntityCard', <EntityCard id="p-1" name="برج الواحة" type="property" onClick={() => undefined} secondaryAction={{ label: 'تعديل', icon: Home, onClick: () => undefined, ariaLabel: 'تعديل السجل' }} />],
  ['Table', <Table aria-label="سجل"><TableHeader><TableRow><TableHead>الاسم</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>سجل ١</TableCell></TableRow></TableBody></Table>],
];

describe('axe — active shared primitives', () => {
  for (const [name, ui] of cases) it(name, async () => expectNoViolations(ui));
});

describe('axe — entity cards avoid nested controls', () => {
  it('keeps primary activation and row actions as siblings', () => {
    const { container } = render(<EntityCard id="p-1" name="برج الواحة" type="property" onClick={() => undefined} secondaryAction={{ label: 'تعديل', icon: Home, onClick: () => undefined, ariaLabel: 'تعديل السجل' }} />);
    const controls = Array.from(container.querySelectorAll('button, a[href], [role="button"]'));
    expect(controls).toHaveLength(2);
    for (const control of controls) expect(control.querySelector('button, a[href], [role="button"]')).toBeNull();
  });
});