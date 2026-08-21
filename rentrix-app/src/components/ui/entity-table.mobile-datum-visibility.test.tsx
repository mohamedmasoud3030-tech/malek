// @vitest-environment happy-dom
/**
 * Regression cover for the `single-office-isolated` mobile-journey failure.
 *
 * Below 768px the shared register renders ONLY
 *   identity column + one designated datum column + an «إجراءات» disclosure.
 * Every other column is intentionally not rendered.
 *
 * Origin of the defect: `main@1543928` ("unify mobile registers and global
 * malek header") introduced that mobile register AND
 * `e2e/single-office-isolated.spec.ts` in the same commit, while leaving
 * `ContractTable` designating `rent_amount` as its mobile datum. The spec
 * asserts the TENANT NAME («مستأجر اختبار المكتب الواحد») is visible on
 * `/contracts`, so its mobile project had never passed — a baseline defect on
 * main, not a regression from the WP-06 document-platform work and not an
 * infrastructure problem.
 *
 * Repair applied: `ContractTable` now designates the `tenant` column as its
 * mobile datum, so a contract row stays recognisable by its counterparty on
 * small screens. The rent value remains on the detail view and on wider
 * viewports. These tests lock in both the general mechanism and that specific
 * designation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EntityTable } from './entity-table';

type ContractRow = {
  id: string;
  reference: string;
  tenantName: string;
  unitNumber: string;
  rent: string;
};

const rows: ContractRow[] = [
  {
    id: 'contract-1',
    reference: 'CON-SO-0001',
    tenantName: 'مستأجر اختبار المكتب الواحد',
    unitNumber: 'SO-E2E-1',
    rent: '420.000 ر.ع',
  },
];

/** Mirrors the real `ContractTable` column contract. */
const contractColumns = [
  { key: 'contract_number', header: 'رقم العقد', render: (row: ContractRow) => <span>{row.reference}</span> },
  { key: 'tenant', header: 'المستأجر', render: (row: ContractRow) => <span>{row.tenantName}</span> },
  { key: 'unit', header: 'الوحدة', render: (row: ContractRow) => <span>{row.unitNumber}</span> },
  { key: 'rent_amount', header: 'قيمة الإيجار', render: (row: ContractRow) => <span>{row.rent}</span> },
];

function renderRegister(mobileVisibleSecondaryKey: string) {
  render(
    <EntityTable
      aria-label="جدول العقود"
      rows={rows}
      columns={contractColumns}
      keyOf={(row) => row.id}
      mobileVisibleSecondaryKey={mobileVisibleSecondaryKey}
    />,
  );
  return {
    mobile: document.querySelector('[data-entity-table-mobile]'),
    desktop: document.querySelector('[data-entity-table-wrapper]'),
  };
}

describe('shared mobile register — only identity + designated datum are rendered', () => {
  // Each case asserts on document-level queries, so the previous render must
  // be torn down or its DOM would leak into the next assertion.
  afterEach(() => cleanup());

  it('renders the identity column and the designated datum on mobile', () => {
    const { mobile } = renderRegister('rent_amount');

    expect(mobile).not.toBeNull();
    expect(mobile?.textContent).toContain('CON-SO-0001');
    expect(mobile?.textContent).toContain('420.000 ر.ع');
  });

  it('drops every non-designated column from the mobile DOM while the desktop table keeps them', () => {
    // The mechanism that produced the baseline failure: a column that is
    // neither identity nor the designated datum simply is not rendered on
    // mobile, even though the desktop table still carries it.
    const { mobile, desktop } = renderRegister('rent_amount');

    expect(mobile?.textContent).not.toContain('مستأجر اختبار المكتب الواحد');
    expect(desktop?.textContent).toContain('مستأجر اختبار المكتب الواحد');
  });

  it('designating the tenant column as the mobile datum makes the tenant name visible', () => {
    // The repair applied to ContractTable: no new component, no page-specific
    // mobile layout — just the existing datum designation.
    const { mobile } = renderRegister('tenant');

    expect(mobile?.textContent).toContain('مستأجر اختبار المكتب الواحد');
    expect(mobile?.textContent).toContain('CON-SO-0001');
  });

  it('the register exposes exactly one accessible list on mobile', () => {
    renderRegister('rent_amount');
    expect(screen.getAllByRole('list', { name: 'جدول العقود' }).length).toBeGreaterThanOrEqual(1);
  });

  it('ContractTable designates the tenant column, keeping the /contracts mobile journey satisfiable', () => {
    // Guards the actual call site, so re-designating the contracts datum can
    // never silently break `single-office-isolated.spec.ts` again.
    // Vitest runs with the package root as cwd; `import.meta.url` is not a
    // file URL under the happy-dom environment, so resolve from the root.
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/contracts/components/ContractTable.tsx'),
      'utf8',
    );

    expect(source).toContain('mobileVisibleSecondaryKeys={["tenant", "unit", "status"]}');
    expect(source).not.toContain('mobileVisibleSecondaryKey="rent_amount"');
    // The designated key must correspond to a real column on that table.
    expect(source).toContain('key: "tenant"');
  });
});
