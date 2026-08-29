// @vitest-environment happy-dom
/**
 * Rendered-DOM accessibility sweep over the approved primitive set.
 *
 * The repository already guards accessibility by *reading source text*
 * (`accessibility-baseline.test.ts`, `touch-target-floor.test.ts`). Those
 * checks cannot see what the browser actually builds — a dangling
 * `aria-describedby`, an `aria-controls` pointing at an unmounted panel, a
 * control whose accessible name silently absorbed its own error text.
 *
 * This suite renders each primitive and runs the real axe-core rule engine
 * over the resulting DOM, so those defects fail here instead of in front of a
 * screen-reader user. It complements, and does not replace, the Playwright
 * axe probes in `e2e/`, which cover full pages with real CSS.
 *
 * Scope note: colour-contrast rules need layout and computed styles, which the
 * test DOM does not provide, so they are excluded here and remain the job of
 * the browser-level probes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import axe from 'axe-core';
import { Home } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Dropdown } from './dropdown';
import { EntityForm } from './entity-form';
import { ErrorState } from './error-state';
import { FilterTabs } from './filter-tabs';
import { FormField } from './form-field';
import { IconButton } from './icon-button';
import { Input } from './input';
import { KpiCard } from './kpi-card';
import { LoadingState } from './loading-state';
import { SearchInput } from './search-input';
import { SectionTabPanel, SectionTabs } from './section-tabs';
import { Select } from './select';
import { EmptyState, NoPermissionState, OfflineState } from './state-surfaces';
import { StatusBadge } from './status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { TextAreaField, TextField } from './text-field';
import { ViewModeToggle } from './view-mode-toggle';

afterEach(cleanup);

/**
 * Rules that cannot produce a meaningful result without layout/computed style.
 * Everything else in the WCAG A/AA tag set stays enabled.
 */
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
  ['Button states', (
    <div>
      <Button>حفظ</Button>
      <Button loading>حفظ</Button>
      <Button disabled>حفظ</Button>
      <Button variant="danger">حذف</Button>
    </div>
  )],
  ['IconButton', <IconButton icon={<Home className="size-4" />} label="الرئيسية" />],
  ['SearchInput (empty and filled)', (
    <div>
      <SearchInput value="" onChange={() => {}} />
      <SearchInput value="بحث" onChange={() => {}} />
    </div>
  )],
  ['Dropdown', (
    <Dropdown
      label="الحالة"
      options={[{ id: 'a', label: 'نشط' }, { id: 'b', label: 'منتهٍ', disabled: true }]}
      value="a"
      onChange={() => {}}
    />
  )],
  ['FilterTabs', (
    <FilterTabs
      options={[{ value: 'all', label: 'الكل', count: 3 }, { value: 'active', label: 'نشط' }]}
      value="all"
      onChange={() => {}}
    />
  )],
  ['ViewModeToggle', <ViewModeToggle value="list" onChange={() => {}} />],
  ['SectionTabs with its panel', (
    <>
      <SectionTabs
        items={[{ id: 'a', label: 'نظرة عامة', icon: Home }, { id: 'b', label: 'المالية', icon: Home }]}
        activeId="a"
        onChange={() => {}}
        ariaLabel="أقسام"
      />
      <SectionTabPanel id="a" activeId="a">المحتوى</SectionTabPanel>
    </>
  )],
  ['SectionTabs with a shared panel', (
    <>
      <SectionTabs
        items={[{ id: 'a', label: 'أ', icon: Home }, { id: 'b', label: 'ب', icon: Home }]}
        activeId="a"
        onChange={() => {}}
        ariaLabel="أقسام"
        panelId="shared-panel"
      />
      <div id="shared-panel" role="tabpanel" aria-labelledby="section-tab-a">المحتوى</div>
    </>
  )],
  ['EntityForm with validation', (
    <EntityForm.Root>
      <EntityForm.Section title="بيانات العقد">
        <EntityForm.ErrorSummary message="تعذر حفظ العقد" />
        <EntityForm.Field label="رقم العقد" description="يجب أن يكون فريدًا." error="رقم العقد مطلوب">
          <Input />
        </EntityForm.Field>
        <EntityForm.Field label="الحالة">
          <Select><option>نشط</option></Select>
        </EntityForm.Field>
      </EntityForm.Section>
      <EntityForm.Actions submitLabel="حفظ" cancelLabel="إلغاء" onCancel={() => {}} />
    </EntityForm.Root>
  )],
  ['FormField variants', (
    <div>
      <FormField label="اسم العقار" htmlFor="pf-1" required error="مطلوب"><Input id="pf-1" /></FormField>
      <FormField label="الاسم" htmlFor="pf-2" hint="الاسم التجاري"><Input id="pf-2" /></FormField>
      <FormField label="القناة"><Select><option>واتساب</option></Select></FormField>
    </div>
  )],
  ['TextField variants', (
    <div>
      <TextField label="البريد" description="سيُستخدم للتنبيهات" />
      <TextField label="الهاتف" error="رقم غير صالح" />
      <TextField label="المبلغ" currency="OMR" inputMode="decimal" />
      <TextAreaField label="ملاحظات" description="اختياري" />
    </div>
  )],
  ['State surfaces', (
    <div>
      <EmptyState title="لا توجد بيانات" description="ابدأ بإضافة عقار" />
      <OfflineState title="غير متصل" description="تحقق من الاتصال" />
      <NoPermissionState title="لا صلاحية" description="تواصل مع المسؤول" />
      <ErrorState title="خطأ" description="حدث خطأ" />
      <LoadingState />
    </div>
  )],
  ['KpiCard', <KpiCard label="الإيراد" value="1,234.500 OMR" icon={Home} trend="up" trendValue="12%" />],
  ['Badges', <div><Badge>نشط</Badge><StatusBadge status="active" /></div>],
  ['Alert', <Alert><AlertTitle>تنبيه</AlertTitle><AlertDescription>وصف التنبيه</AlertDescription></Alert>],
  ['Card', (
    <Card>
      <CardHeader><CardTitle>عنوان</CardTitle></CardHeader>
      <CardContent>محتوى البطاقة</CardContent>
    </Card>
  )],
  ['Table', (
    <Table aria-label="سجل العقود">
      <TableHeader>
        <TableRow><TableHead>الاسم</TableHead><TableHead>الحالة</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        <TableRow><TableCell>عقد ١</TableCell><TableCell>نشط</TableCell></TableRow>
      </TableBody>
    </Table>
  )],
];

describe('axe — approved primitive set renders without WCAG A/AA violations', () => {
  for (const [name, ui] of cases) {
    it(name, async () => {
      await expectNoViolations(ui);
    });
  }
});

describe('axe — ARIA relationships resolve to rendered elements', () => {
  /**
   * `aria-controls`, `aria-describedby` and `aria-labelledby` referencing an
   * absent id fail silently: the browser exposes nothing and the user simply
   * never hears the error, hint or relationship. axe only flags a subset of
   * these, so the references are verified directly.
   */
  const relationshipCases: ReadonlyArray<readonly [string, ReactElement]> = [
    ['errored EntityForm field', (
      <EntityForm.Field label="المبلغ" description="بالريال" error="قيمة غير صالحة"><Input /></EntityForm.Field>
    )],
    ['errored TextField', <TextField label="البريد" description="وصف" error="بريد غير صالح" />],
    ['warning TextField', <TextField label="الهاتف" description="وصف" warning="تحقق من الرقم" />],
    ['FormField with hint', <FormField label="الاسم" htmlFor="rel-1" hint="تلميح"><Input id="rel-1" /></FormField>],
    ['lazily mounted tab panels', (
      <>
        <SectionTabs
          items={[{ id: 'a', label: 'أ', icon: Home }, { id: 'b', label: 'ب', icon: Home }]}
          activeId="a"
          onChange={() => {}}
          ariaLabel="أقسام"
        />
        <SectionTabPanel id="a" activeId="a">المحتوى</SectionTabPanel>
      </>
    )],
  ];

  for (const [name, ui] of relationshipCases) {
    it(`${name} has no dangling references`, () => {
      const { container } = render(ui);

      for (const attribute of ['aria-controls', 'aria-describedby', 'aria-labelledby']) {
        for (const element of Array.from(container.querySelectorAll(`[${attribute}]`))) {
          const ids = element.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? [];
          for (const id of ids) {
            expect(
              container.querySelector(`#${CSS.escape(id)}`),
              `${attribute}="${id}" on <${element.tagName.toLowerCase()}> references a missing element`,
            ).not.toBeNull();
          }
        }
      }
    });
  }
});
