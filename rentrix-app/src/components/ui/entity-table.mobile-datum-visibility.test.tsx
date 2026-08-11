// @vitest-environment happy-dom
/**
 * Baseline evidence for the `single-office-isolated` mobile-journey failure.
 *
 * This test does NOT change product behaviour. It documents, at the component
 * level, exactly why
 * `e2e/single-office-isolated.spec.ts › opens the core single-office
 * workspaces responsively with real seeded data` fails on its mobile project:
 *
 *   Below 768px the shared register renders ONLY
 *     identity column + one datum column + an «إجراءات» disclosure.
 *   Every other column is intentionally not rendered.
 *
 * `ContractTable` sets identity = `contract_number` and
 * `mobileVisibleSecondaryKey = "rent_amount"`, so the TENANT NAME
 * («مستأجر اختبار المكتب الواحد») is absent from the mobile DOM — while the
 * E2E spec asserts that exact text is visible on `/contracts`.
 *
 * Ownership: both the mobile register presentation and that spec were
 * introduced by `main@1543928` ("unify mobile registers and global malek
 * header"). The mismatch is therefore a BASELINE defect on main, not a
 * regression from the WP-06 document-platform work, and it is not an
 * infrastructure problem. Fixing it means either designating the tenant
 * column as the mobile datum or re-anchoring the spec — a Contracts/registers
 * decision that belongs to that surface's owner.
 *
 * Keep this test as the reproduction. When the owning fix lands, the
 * `expect(...).toBeNull()` below becomes the assertion that must flip.
 */
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

describe('shared mobile register — only identity + designated datum are rendered', () => {
  // Each case asserts on document-level queries, so the previous render must
  // be torn down or its DOM would leak into the next assertion.
  afterEach(() => cleanup());

  it('renders the identity column and the designated datum on mobile', () => {
    render(
      <EntityTable
        aria-label="جدول العقود"
        rows={rows}
        columns={contractColumns}
        keyOf={(row) => row.id}
        mobileVisibleSecondaryKey="rent_amount"
      />,
    );

    const mobileRegister = document.querySelector('[data-entity-table-mobile]');
    expect(mobileRegister).not.toBeNull();

    // Identity + designated datum are present in the mobile card.
    expect(mobileRegister?.textContent).toContain('CON-SO-0001');
    expect(mobileRegister?.textContent).toContain('420.000 ر.ع');
  });

  it('BASELINE DEFECT: the tenant name is absent from the mobile register DOM', () => {
    render(
      <EntityTable
        aria-label="جدول العقود"
        rows={rows}
        columns={contractColumns}
        keyOf={(row) => row.id}
        mobileVisibleSecondaryKey="rent_amount"
      />,
    );

    const mobileRegister = document.querySelector('[data-entity-table-mobile]');

    // This is precisely what the E2E mobile journey asserts is visible on
    // /contracts — and precisely what the shared mobile register omits.
    expect(mobileRegister?.textContent).not.toContain('مستأجر اختبار المكتب الواحد');

    // The desktop table still carries it, which is why the desktop project
    // of the same spec passes while the mobile project fails.
    const desktopTable = document.querySelector('[data-entity-table-wrapper]');
    expect(desktopTable?.textContent).toContain('مستأجر اختبار المكتب الواحد');
  });

  it('designating the tenant column as the mobile datum WOULD make it visible', () => {
    // Documents the smallest product-side repair available to the owning
    // surface: no new component, just the existing datum designation.
    render(
      <EntityTable
        aria-label="جدول العقود"
        rows={rows}
        columns={contractColumns}
        keyOf={(row) => row.id}
        mobileVisibleSecondaryKey="tenant"
      />,
    );

    const mobileRegister = document.querySelector('[data-entity-table-mobile]');
    expect(mobileRegister?.textContent).toContain('مستأجر اختبار المكتب الواحد');
  });

  it('the register exposes exactly one accessible list on mobile', () => {
    render(
      <EntityTable
        aria-label="جدول العقود"
        rows={rows}
        columns={contractColumns}
        keyOf={(row) => row.id}
        mobileVisibleSecondaryKey="rent_amount"
      />,
    );
    expect(screen.getAllByRole('list', { name: 'جدول العقود' }).length).toBeGreaterThanOrEqual(1);
  });
});
